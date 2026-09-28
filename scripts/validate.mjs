import { spawn } from 'node:child_process'
import { existsSync, lstatSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep, win32 } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
export const repositoryRoot = resolve(dirname(scriptPath), '..')

const standardTestPattern = /\.test\.(?:mjs|ts)$/
const browserTestPattern = /\.browser\.cjs$/
const PROCESS_TERMINATION_GRACE_MS = 250
const PROCESS_FORCED_CLOSE_MS = 250

function duration(started) {
  return `${Date.now() - started}ms`
}

function commandLine(command, args) {
  return [command, ...args].map(value => JSON.stringify(String(value))).join(' ')
}

function writeLine(logger, method, value) {
  const target = logger?.[method] ?? logger?.log
  if (typeof target === 'function') target.call(logger, value)
}

function finish(logger, name, started, code, detail) {
  if (detail) writeLine(logger, 'error', detail)
  writeLine(logger, code === 0 ? 'log' : 'error', `${name} ${code === 0 ? 'PASS' : 'FAIL'} ${duration(started)}`)
  return code
}

function pathKey(path) {
  return process.platform === 'win32' ? path.toLowerCase() : path
}

function isInside(parent, child) {
  const rel = relative(parent, child)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

function assertSafeRelativePath(input) {
  if (typeof input !== 'string' || input.length === 0) throw new Error('A non-empty relative test filename is required.')
  if (isAbsolute(input)) throw new Error(`Absolute test paths are not accepted: ${input}`)
  if (input.split(/[\\/]+/).includes('..')) throw new Error(`Path traversal is not accepted: ${input}`)
}

export function validateSelectedTests(inputs, {
  root = repositoryRoot,
  pattern = standardTestPattern,
  label = '.test.mjs or .test.ts',
  exactly,
} = {}) {
  if (exactly !== undefined && inputs.length !== exactly) throw new Error(`Exactly ${exactly} test filename${exactly === 1 ? '' : 's'} required.`)
  if (inputs.length === 0) throw new Error('At least one explicit test filename is required.')

  const testsDirectory = realpathSync(resolve(root, 'tests'))
  const selected = []
  const seen = new Set()

  for (const input of inputs) {
    assertSafeRelativePath(input)
    if (!pattern.test(input)) throw new Error(`Unsupported test filename (expected ${label}): ${input}`)
    const candidate = resolve(root, input)
    if (!existsSync(candidate)) throw new Error(`Test file does not exist: ${input}`)
    if (!lstatSync(candidate).isFile()) throw new Error(`Test path is not a file: ${input}`)
    const actual = realpathSync(candidate)
    if (!isInside(testsDirectory, actual)) throw new Error(`Test path resolves outside tests/: ${input}`)
    const key = pathKey(actual)
    if (seen.has(key)) throw new Error(`Duplicate test filename: ${input}`)
    seen.add(key)
    selected.push(actual)
  }
  return selected
}

export function discoverStandardTests(root = repositoryRoot) {
  const testsDirectory = realpathSync(resolve(root, 'tests'))
  const found = new Map()

  function visit(directory) {
    const entries = readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, 'en'))
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile() && standardTestPattern.test(entry.name)) {
        const actual = realpathSync(path)
        if (!isInside(testsDirectory, actual)) throw new Error(`Discovered test resolves outside tests/: ${path}`)
        found.set(pathKey(actual), actual)
      }
    }
  }

  visit(testsDirectory)
  return [...found.values()].sort((left, right) => {
    const leftRelative = relative(testsDirectory, left).split(sep).join('/')
    const rightRelative = relative(testsDirectory, right).split(sep).join('/')
    return leftRelative.localeCompare(rightRelative, 'en')
  })
}

export function runProcess(command, args, {
  cwd = repositoryRoot,
  env = process.env,
  stdout = process.stdout,
  stderr = process.stderr,
  detached = false,
  signal,
  timeoutMs,
  terminationGraceMs = PROCESS_TERMINATION_GRACE_MS,
  forcedCloseMs = PROCESS_FORCED_CLOSE_MS,
  requestGracefulTermination = child => child.kill('SIGTERM'),
  requestForcedTermination = child => child.kill('SIGKILL'),
} = {}) {
  return new Promise(resolveResult => {
    let stdoutText = ''
    let stderrText = ''
    let completed = false
    let exitCode = null
    let exitSignal = null
    let spawnError
    let terminationError
    let terminalReason
    let forced = false
    let forceCloseExpired = false
    let streamsDetached = false
    let timeoutTimer
    let graceTimer
    let forcedCloseTimer
    const childEnv = { ...env }
    delete childEnv.NODE_TEST_CONTEXT
    let child

    const clearTimers = () => {
      clearTimeout(timeoutTimer)
      clearTimeout(graceTimer)
      clearTimeout(forcedCloseTimer)
    }
    const stopAcceptingOutput = () => {
      if (streamsDetached) return
      streamsDetached = true
      child?.stdout?.off('data', onStdout)
      child?.stderr?.off('data', onStderr)
      child?.stdout?.destroy()
      child?.stderr?.destroy()
    }
    const removeListeners = () => {
      signal?.removeEventListener('abort', onAbort)
      child?.off('error', onError)
      child?.off('exit', onExit)
      child?.off('close', onClose)
      child?.stdout?.off('data', onStdout)
      child?.stderr?.off('data', onStderr)
    }
    const complete = (closeCode, closeSignal) => {
      if (completed) return
      completed = true
      clearTimers()
      removeListeners()
      const rawExitCode = Number.isInteger(exitCode) ? exitCode : Number.isInteger(closeCode) ? closeCode : null
      const rawSignal = exitSignal ?? closeSignal ?? null
      const interrupted = terminalReason !== undefined
      const code = interrupted
        ? rawExitCode !== null && rawExitCode !== 0 ? rawExitCode : 1
        : rawExitCode !== null ? rawExitCode : spawnError ? 1 : rawSignal ? 1 : 1
      resolveResult({
        code,
        exitCode: rawExitCode,
        signal: rawSignal,
        stdout: stdoutText,
        stderr: stderrText,
        error: spawnError ?? terminationError,
        terminalReason,
        timedOut: terminalReason === 'timeout',
        cancelled: terminalReason === 'aborted',
        forced,
        forceCloseExpired,
        streamsDetached,
      })
    }
    const escalate = () => {
      if (completed || forced) return
      forced = true
      try {
        requestForcedTermination(child)
      } catch (error) {
        terminationError ??= error
      }
      forcedCloseTimer = setTimeout(() => {
        if (completed) return
        forceCloseExpired = true
        stopAcceptingOutput()
        child?.unref()
        complete(null, null)
      }, Math.max(0, forcedCloseMs))
    }
    const beginTermination = (reason, error) => {
      if (completed || terminalReason !== undefined) return
      terminalReason = reason
      if (reason === 'spawn-error') spawnError = error
      else if (error) terminationError = error
      try {
        requestGracefulTermination(child)
      } catch (terminationRequestError) {
        terminationError ??= terminationRequestError
      }
      graceTimer = setTimeout(escalate, Math.max(0, terminationGraceMs))
    }
    const onStdout = chunk => {
      stdoutText += chunk.toString()
      stdout?.write?.(chunk)
    }
    const onStderr = chunk => {
      stderrText += chunk.toString()
      stderr?.write?.(chunk)
    }
    const onError = error => beginTermination('spawn-error', error)
    const onExit = (code, childSignal) => {
      exitCode = code
      exitSignal = childSignal
    }
    const onClose = (code, childSignal) => complete(code, childSignal)
    const onAbort = () => beginTermination('aborted')

    try {
      child = spawn(command, args, {
        cwd,
        env: childEnv,
        detached,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
    } catch (error) {
      spawnError = error
      terminalReason = 'spawn-error'
      complete(1, null)
      return
    }
    child.stdout?.on('data', onStdout)
    child.stderr?.on('data', onStderr)
    child.once('error', onError)
    child.once('exit', onExit)
    child.once('close', onClose)
    signal?.addEventListener('abort', onAbort, { once: true })
    if (Number.isFinite(timeoutMs) && timeoutMs >= 0) {
      timeoutTimer = setTimeout(() => beginTermination('timeout'), timeoutMs)
    }
    if (signal?.aborted) onAbort()
  })
}

function effectiveProcessCode(result) {
  const terminalFailure = result?.terminalReason !== undefined
    || result?.timedOut === true
    || result?.cancelled === true
    || result?.error !== undefined
    || result?.orchestrationError !== undefined
  if (terminalFailure) return Number.isInteger(result?.code) && result.code !== 0 ? result.code : 1
  return Number.isInteger(result?.code) ? result.code : 1
}

async function execute(name, command, args, options = {}) {
  const started = Date.now()
  const logger = options.logger ?? console
  writeLine(logger, 'log', name)
  const runner = options.runner ?? runProcess
  const result = await runner(command, args, options)
  const code = effectiveProcessCode(result)
  const detail = code === 0 ? undefined : `Failing subprocess: ${commandLine(command, args)}${result.error ? `\n${result.error.message}` : ''}`
  finish(logger, name, started, code, detail)
  return { ...result, code }
}

export async function validateFocused(inputs, options = {}) {
  const name = 'validate:focused'
  const started = Date.now()
  const logger = options.logger ?? console
  let files
  try {
    files = validateSelectedTests(inputs, { root: options.root })
  } catch (error) {
    writeLine(logger, 'log', name)
    return finish(logger, name, started, 1, error.message)
  }
  return runRequiredTests(name, files, options)
}

export async function validateTypes(options = {}) {
  const root = options.root ?? repositoryRoot
  const tscPath = resolve(root, 'node_modules', 'typescript', 'bin', 'tsc')
  const result = await execute('validate:types', process.execPath, [tscPath, '--noEmit', '--pretty', 'false'], { ...options, cwd: root })
  return result.code
}

function npmInvocation() {
  if (process.env.npm_execpath && existsSync(process.env.npm_execpath)) {
    return { command: process.execPath, args: [process.env.npm_execpath, 'run', 'build'] }
  }
  const bundledNpm = resolve(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
  if (existsSync(bundledNpm)) return { command: process.execPath, args: [bundledNpm, 'run', 'build'] }
  return { command: process.platform === 'win32' ? 'npm.cmd' : 'npm', args: ['run', 'build'] }
}

export async function validateBuild(options = {}) {
  const root = options.root ?? repositoryRoot
  const invocation = options.buildInvocation ?? npmInvocation()
  const result = await execute('validate:build', invocation.command, invocation.args, { ...options, cwd: root })
  return result.code
}

export function resolvePgliteEntry() {
  const resolved = import.meta.resolve('@electric-sql/pglite')
  if (!resolved.startsWith('file:')) throw new Error(`PGlite did not resolve to a local file: ${resolved}`)
  return fileURLToPath(resolved)
}

function tapCount(output, key) {
  const expression = new RegExp(`^\\s*# ${key} (\\d+)\\s*$`, 'gm')
  const matches = [...output.matchAll(expression)]
  return matches.length === 0 ? undefined : Number(matches.at(-1)[1])
}

export function evaluateRequiredTestResult(result, fileCount) {
  const resultCode = effectiveProcessCode(result)
  if (resultCode !== 0) return { code: resultCode, reason: 'node:test did not complete normally.' }
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const counts = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo'].map(key => [key, tapCount(output, key)]))
  if (Object.values(counts).some(value => value === undefined)) return { code: 1, reason: 'node:test output was incomplete.' }
  if (counts.tests < fileCount || counts.pass + counts.fail + counts.cancelled + counts.skipped + counts.todo !== counts.tests) {
    return { code: 1, reason: 'node:test reported incomplete results.' }
  }
  if (counts.fail > 0 || counts.cancelled > 0 || counts.skipped > 0 || counts.todo > 0) {
    return { code: 1, reason: `node:test summary was not clean (fail ${counts.fail}, cancelled ${counts.cancelled}, skipped ${counts.skipped}, todo ${counts.todo}).` }
  }
  return { code: 0 }
}

export const evaluateRegressionResult = evaluateRequiredTestResult

async function runRequiredTests(name, files, options = {}) {
  const started = Date.now()
  const logger = options.logger ?? console
  let pglitePath
  try {
    pglitePath = (options.resolvePglite ?? resolvePgliteEntry)()
  } catch (error) {
    writeLine(logger, 'log', name)
    return finish(logger, name, started, 1, error.message)
  }

  writeLine(logger, 'log', `${name} (${files.length} file${files.length === 1 ? '' : 's'})`)
  const args = ['--test', '--test-concurrency=1', '--test-reporter=tap', ...files]
  const runner = options.runner ?? runProcess
  const result = await runner(process.execPath, args, {
    ...options,
    cwd: options.root ?? repositoryRoot,
    env: {
      ...process.env,
      ...options.env,
      DOSING_PGLITE_PATH: pglitePath,
      LABS_PGLITE_PATH: pglitePath,
    },
  })
  const evaluated = evaluateRequiredTestResult(result, files.length)
  const detail = evaluated.code === 0
    ? undefined
    : `${evaluated.reason}\nFailing subprocess: ${commandLine(process.execPath, args)}`
  return finish(logger, name, started, evaluated.code, detail)
}

export async function validateRegression(options = {}) {
  const name = 'validate:regression'
  const started = Date.now()
  const logger = options.logger ?? console
  let files
  try {
    files = discoverStandardTests(options.root)
    if (files.length === 0) throw new Error('No standard tests were discovered.')
  } catch (error) {
    writeLine(logger, 'log', name)
    return finish(logger, name, started, 1, error.message)
  }

  return runRequiredTests(name, files, options)
}

function waitForChildClose(child, milliseconds) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true)
  return new Promise(resolveWait => {
    const onClose = () => {
      clearTimeout(timer)
      resolveWait(true)
    }
    const timer = setTimeout(() => {
      child.off('close', onClose)
      resolveWait(false)
    }, Math.max(0, milliseconds))
    child.once('close', onClose)
  })
}

function runCleanupCommand(command, args, milliseconds) {
  return new Promise(resolveCleanup => {
    let settled = false
    let output = ''
    let exitCode = null
    let spawnFailed = false
    const child = spawn(command, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    child.stdout?.on('data', chunk => { output += chunk.toString() })
    child.stderr?.on('data', chunk => { output += chunk.toString() })
    const timer = setTimeout(() => {
      if (!settled) {
        child.kill()
        done(1)
      }
    }, milliseconds)
    const done = code => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolveCleanup({ code, output })
    }
    child.once('error', () => { spawnFailed = true })
    child.once('exit', code => { exitCode = code })
    child.once('close', code => done(!spawnFailed && (exitCode ?? code) === 0 ? 0 : 1))
  })
}

function processGroupExists(pid) {
  try {
    process.kill(-pid, 0)
    return true
  } catch (error) {
    return error.code !== 'ESRCH'
  }
}

async function waitForProcessGroupRemoval(pid, deadline) {
  while (Date.now() < deadline) {
    if (!processGroupExists(pid)) return true
    await new Promise(resolveWait => setTimeout(resolveWait, Math.min(25, Math.max(0, deadline - Date.now()))))
  }
  return !processGroupExists(pid)
}

export async function terminateProcessTree(child, {
  cleanupMs = 5_000,
  platform = process.platform,
} = {}) {
  if (!child?.pid) return 1
  const deadline = Date.now() + Math.min(cleanupMs, 5_000)
  if (platform === 'win32') {
    const { command, args } = windowsTaskkillInvocation(child.pid)
    const taskkillResult = await runCleanupCommand(command, args, Math.max(0, deadline - Date.now()))
    if (taskkillResult.code !== 0) {
      process.stderr.write(`Failing cleanup subprocess: ${commandLine(command, args)}\n${taskkillResult.output}`)
      return 1
    }
    return (await waitForChildClose(child, Math.max(0, deadline - Date.now()))) ? 0 : 1
  }

  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch (error) {
    if (error.code === 'ESRCH') return 0
    return 1
  }
  const forceAt = Math.max(Date.now(), deadline - 100)
  if (await waitForProcessGroupRemoval(child.pid, forceAt)) return 0
  try {
    process.kill(-child.pid, 'SIGKILL')
  } catch (error) {
    if (error.code !== 'ESRCH') return 1
  }
  return (await waitForProcessGroupRemoval(child.pid, deadline)) ? 0 : 1
}

export function windowsTaskkillInvocation(pid, systemRoot = process.env.SystemRoot ?? 'C:\\Windows') {
  return {
    command: win32.join(systemRoot, 'System32', 'taskkill.exe'),
    args: ['/PID', String(pid), '/T', '/F'],
  }
}

function normalizedExitCode(value, fallback = 1) {
  const number = Number(value)
  return Number.isInteger(number) && number >= 0 ? number : fallback
}

export async function runBrowserSupervisor(file) {
  process.channel?.unref()
  const keepAlive = setInterval(() => {}, 1_000)
  keepAlive.unref()
  let reported = false

  const report = (code, error) => {
    if (reported) return
    reported = true
    keepAlive.ref()
    if (error) console.error(error)
    process.send?.({ type: 'fixture-result', code: normalizedExitCode(code), error: error ? String(error.stack ?? error) : undefined }, () => {})
  }

  process.exit = code => {
    report(code ?? process.exitCode ?? 0)
  }
  process.once('uncaughtException', error => report(1, error))
  process.once('unhandledRejection', error => report(1, error))
  process.on('beforeExit', code => report(process.exitCode ?? code ?? 0))

  try {
    await import(pathToFileURL(file).href)
  } catch (error) {
    report(1, error)
  }
}

function waitForSupervisorOutcome(child, { timeoutMs, signal }) {
  return new Promise(resolveOutcome => {
    let settled = false
    const finishOutcome = outcome => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      process.off('SIGINT', onSignal)
      process.off('SIGTERM', onSignal)
      child.off('message', onMessage)
      child.off('error', onError)
      child.off('close', onClose)
      resolveOutcome(outcome)
    }
    const onMessage = message => {
      if (message?.type === 'fixture-result') finishOutcome({ kind: 'fixture', code: normalizedExitCode(message.code), error: message.error })
    }
    const onError = error => finishOutcome({ kind: 'orchestration', code: 1, error })
    const onClose = (code, closeSignal) => finishOutcome({
      kind: 'orchestration',
      code: normalizedExitCode(code),
      signal: closeSignal,
      error: new Error('Browser supervisor closed before reporting fixture completion.'),
    })
    const onAbort = () => finishOutcome({ kind: 'cancelled', code: 1 })
    const onSignal = signalName => finishOutcome({ kind: 'cancelled', code: 1, signal: signalName })
    const timer = setTimeout(() => finishOutcome({ kind: 'timeout', code: 1 }), timeoutMs)
    child.on('message', onMessage)
    child.once('error', onError)
    child.once('close', onClose)
    signal?.addEventListener('abort', onAbort, { once: true })
    process.once('SIGINT', onSignal)
    process.once('SIGTERM', onSignal)
    if (signal?.aborted) onAbort()
  })
}

export async function validateBrowser(inputs, options = {}) {
  const name = 'validate:browser'
  const started = Date.now()
  const logger = options.logger ?? console
  let file
  try {
    ;[file] = validateSelectedTests(inputs, {
      root: options.root,
      pattern: browserTestPattern,
      label: '.browser.cjs',
      exactly: 1,
    })
  } catch (error) {
    writeLine(logger, 'log', name)
    return finish(logger, name, started, 1, error.message)
  }

  writeLine(logger, 'log', name)
  const spawnChild = options.spawnChild ?? spawn
  const timeoutMs = options.timeoutMs ?? 120_000
  const cleanupMs = Math.min(options.cleanupMs ?? 5_000, 5_000)
  const childEnv = { ...process.env, ...options.env }
  delete childEnv.NODE_TEST_CONTEXT
  let child
  try {
    child = spawnChild(process.execPath, [scriptPath, '__browser-supervisor', file], {
      cwd: options.browserCwd ?? options.root ?? repositoryRoot,
      env: childEnv,
      detached: process.platform !== 'win32',
      shell: false,
      stdio: ['ignore', 'inherit', 'inherit', 'ipc'],
      windowsHide: true,
    })
  } catch (error) {
    return finish(logger, name, started, 1, `Failing subprocess: ${commandLine(process.execPath, [scriptPath, '__browser-supervisor', file])}\n${error.message}`)
  }

  const outcome = await waitForSupervisorOutcome(child, { timeoutMs, signal: options.signal })
  const cleanup = options.cleanup ?? terminateProcessTree
  let cleanupCode = 1
  let cleanupError
  try {
    cleanupCode = await cleanup(child, { cleanupMs })
  } catch (error) {
    cleanupError = error
    cleanupCode = 1
  }
  child.unref()

  const code = cleanupCode !== 0 ? 1 : outcome.kind === 'fixture' ? outcome.code : 1
  let reason
  if (outcome.kind === 'timeout') reason = `Browser fixture exceeded ${timeoutMs}ms.`
  if (outcome.kind === 'cancelled') reason = 'Browser fixture was cancelled.'
  if (outcome.kind === 'orchestration') reason = outcome.error?.message ?? 'Browser supervisor failed.'
  if (outcome.error) reason = outcome.error.message ?? String(outcome.error)
  if (cleanupCode !== 0) reason = `${reason ? `${reason} ` : ''}PID-scoped cleanup failed.${cleanupError ? ` ${cleanupError.message}` : ''}`
  const detail = code === 0 ? undefined : `${reason ? `${reason}\n` : ''}Failing subprocess: ${commandLine(process.execPath, [scriptPath, '__browser-supervisor', file])}`
  return finish(logger, name, started, code, detail)
}

function parseNullSeparatedPaths(text) {
  return text.split('\0').filter(Boolean).map(path => path.split('\\').join('/'))
}

function intendedPathSet(inputs) {
  if (inputs.length === 0) throw new Error('At least one intended staged path is required.')
  const set = new Set()
  for (const input of inputs) {
    if (!input) throw new Error('Intended staged paths must be non-empty.')
    const normalized = input.split('\\').join('/')
    if (set.has(normalized)) throw new Error(`Duplicate intended staged path: ${input}`)
    set.add(normalized)
  }
  return set
}

export async function validateGit(inputs, options = {}) {
  const name = 'validate:git'
  const started = Date.now()
  const logger = options.logger ?? console
  let intended
  try {
    intended = intendedPathSet(inputs)
  } catch (error) {
    writeLine(logger, 'log', name)
    return finish(logger, name, started, 1, error.message)
  }

  writeLine(logger, 'log', name)
  const runner = options.runner ?? runProcess
  const root = options.root ?? repositoryRoot
  const listArgs = ['diff', '--cached', '--name-only', '-z']
  const list = await runner('git', listArgs, { ...options, cwd: root, stdout: null })
  const checkRuns = []
  for (const args of [['diff', '--check'], ['diff', '--cached', '--check']]) {
    checkRuns.push({ args, result: await runner('git', args, { ...options, cwd: root }) })
  }

  const details = []
  let code = 0
  const listCode = effectiveProcessCode(list)
  if (listCode !== 0) {
    code = listCode
    details.push(`Failing subprocess: ${commandLine('git', listArgs)}`)
  } else {
    const staged = new Set(parseNullSeparatedPaths(list.stdout ?? ''))
    const missing = [...intended].filter(path => !staged.has(path)).sort()
    const unexpected = [...staged].filter(path => !intended.has(path)).sort()
    if (missing.length || unexpected.length) {
      code = 1
      if (missing.length) details.push(`Missing paths:\n${missing.map(path => `- ${path}`).join('\n')}`)
      if (unexpected.length) details.push(`Unexpected paths:\n${unexpected.map(path => `- ${path}`).join('\n')}`)
    } else writeLine(logger, 'log', `Staged paths verified: ${staged.size}`)
  }

  for (const { args, result } of checkRuns) {
    const resultCode = effectiveProcessCode(result)
    if (resultCode === 0) continue
    if (code === 0) code = resultCode
    details.push(`Failing subprocess: ${commandLine('git', args)}`)
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
    if (output) details.push(output)
  }
  return finish(logger, name, started, code, details.join('\n') || undefined)
}

export async function validateRelease(inputs, options = {}) {
  const name = 'validate:release'
  const started = Date.now()
  const logger = options.logger ?? console
  try {
    intendedPathSet(inputs)
  } catch (error) {
    writeLine(logger, 'log', name)
    return finish(logger, name, started, 1, error.message)
  }

  writeLine(logger, 'log', name)
  const steps = options.steps ?? [
    () => validateTypes(options),
    () => validateRegression(options),
    () => validateBuild(options),
    () => validateGit(inputs, options),
  ]
  for (const step of steps) {
    const code = await step()
    if (code !== 0) return finish(logger, name, started, code)
  }
  return finish(logger, name, started, 0)
}

export async function main(argv = process.argv.slice(2), options = {}) {
  const [command, ...args] = argv
  if (command === 'focused') return validateFocused(args, options)
  if (command === 'types') return validateTypes(options)
  if (command === 'build') return validateBuild(options)
  if (command === 'regression') return validateRegression(options)
  if (command === 'browser') return validateBrowser(args, options)
  if (command === 'git') return validateGit(args, options)
  if (command === 'release') return validateRelease(args, options)
  writeLine(options.logger ?? console, 'error', `Unknown validation command: ${command ?? '(missing)'}`)
  return 1
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ''
if (invokedPath && pathToFileURL(invokedPath).href === pathToFileURL(scriptPath).href) {
  if (process.argv[2] === '__browser-supervisor') await runBrowserSupervisor(process.argv[3])
  else process.exitCode = await main()
}
