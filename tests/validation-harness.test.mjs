import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'

import {
  discoverStandardTests,
  evaluateRegressionResult,
  resolvePgliteEntry,
  runProcess,
  validateBrowser,
  validateBuild,
  validateFocused,
  validateGit,
  validateRegression,
  validateRelease,
  validateSelectedTests,
  terminateProcessTree,
  windowsTaskkillInvocation,
} from '../scripts/validate.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = dirname(here)
const sink = { write() { return true } }
const logger = { log() {}, error() {} }

function temporaryProject() {
  const root = mkdtempSync(join(tmpdir(), 'mpp-validation-'))
  mkdirSync(join(root, 'tests'), { recursive: true })
  return root
}

function removeTemporaryProject(root) {
  rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 })
}

function testFile(root, path, source = "import { test } from 'node:test'; test('pass', () => {})\n") {
  const target = join(root, path)
  mkdirSync(dirname(target), { recursive: true })
  writeFileSync(target, source)
  return target
}

function quiet(root, extra = {}) {
  return { root, logger, stdout: sink, stderr: sink, ...extra }
}

function cleanTap(tests = 1) {
  return `TAP version 13\n1..${tests}\n# tests ${tests}\n# pass ${tests}\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n`
}

function pidExists(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code !== 'ESRCH'
  }
}

async function waitForPidExit(pid, milliseconds = 2_000) {
  const deadline = Date.now() + milliseconds
  while (Date.now() < deadline) {
    if (!pidExists(pid)) return true
    await new Promise(resolveWait => setTimeout(resolveWait, 25))
  }
  return !pidExists(pid)
}

function syntheticBrowserSource(pidFile, mode) {
  return `
    const { spawn } = require('node:child_process')
    const { writeFileSync } = require('node:fs')
    const descendant = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true })
    writeFileSync(${JSON.stringify(pidFile)}, String(descendant.pid))
    descendant.unref()
    ${mode === 'failure' ? 'process.exitCode = 7' : ''}
    ${mode === 'timeout' ? 'setInterval(() => {}, 1000)' : ''}
  `
}

function browserCleanup(pidFile, { reportFailure = false } = {}) {
  return async (supervisor, options) => {
    let code
    if (process.platform !== 'win32') {
      code = await terminateProcessTree(supervisor, options)
    } else {
      const descendantPid = Number(readFileSync(pidFile, 'utf8'))
      if (pidExists(descendantPid)) {
        try { process.kill(descendantPid, 'SIGKILL') } catch {}
      }
      const closed = new Promise(resolveClose => supervisor.once('close', resolveClose))
      supervisor.kill('SIGKILL')
      await Promise.race([closed, new Promise(resolveWait => setTimeout(resolveWait, options.cleanupMs))])
      code = !pidExists(descendantPid) && !pidExists(supervisor.pid) ? 0 : 1
    }
    return reportFailure ? 1 : code
  }
}

function stopChild(child) {
  if (!child?.pid || !pidExists(child.pid)) return
  try { child.kill('SIGKILL') } catch {}
}

test('focused validation accepts only unique existing standard test files inside tests/', () => {
  const root = temporaryProject()
  try {
    testFile(root, 'tests/good.test.mjs')
    testFile(root, 'outside.test.mjs')
    mkdirSync(join(root, 'tests', 'folder.test.mjs'))
    assert.equal(validateSelectedTests(['tests/good.test.mjs'], { root }).length, 1)
    for (const invalid of [
      [],
      ['tests'],
      ['tests/folder.test.mjs'],
      ['tests/good.mjs'],
      ['tests/missing.test.mjs'],
      ['tests/good.test.mjs', 'tests/good.test.mjs'],
      ['tests/../outside.test.mjs'],
      [join(root, 'tests', 'good.test.mjs')],
    ]) assert.throws(() => validateSelectedTests(invalid, { root }))
  } finally {
    removeTemporaryProject(root)
  }
})

test('focused validation runs exactly the selected files and propagates node:test failure', async () => {
  const root = temporaryProject()
  try {
    testFile(root, 'tests/selected.test.mjs')
    testFile(root, 'tests/unselected.test.mjs', "import { test } from 'node:test'; test('must not run', () => { throw new Error('unselected') })\n")
    assert.equal(await validateFocused(['tests/selected.test.mjs'], quiet(root)), 0)
    let failedResult
    const runner = async (...args) => (failedResult = await runProcess(...args))
    assert.equal(await validateFocused(['tests/unselected.test.mjs'], quiet(root, { runner })), 1, JSON.stringify(failedResult))
  } finally {
    removeTemporaryProject(root)
  }
})

test('focused validation resolves PGlite and injects both SQL test environment paths', async () => {
  const root = temporaryProject()
  try {
    testFile(root, 'tests/sql.test.mjs')
    const expected = join(root, 'node_modules', '@electric-sql', 'pglite', 'dist', 'index.js')
    let childOptions
    const runner = async (command, args, options) => {
      childOptions = options
      return { code: 0, signal: null, stdout: cleanTap(), stderr: '' }
    }
    assert.equal(await validateFocused(['tests/sql.test.mjs'], quiet(root, { runner, resolvePglite: () => expected })), 0)
    assert.equal(childOptions.env.DOSING_PGLITE_PATH, expected)
    assert.equal(childOptions.env.LABS_PGLITE_PATH, expected)
  } finally {
    removeTemporaryProject(root)
  }
})

test('focused validation rejects skipped tests instead of reporting success', async () => {
  const root = temporaryProject()
  try {
    testFile(root, 'tests/skipped.test.mjs', "import { test } from 'node:test'; test('skip', { skip: true }, () => {})\n")
    assert.equal(await validateFocused(['tests/skipped.test.mjs'], quiet(root, { resolvePglite: resolvePgliteEntry })), 1)
  } finally {
    removeTemporaryProject(root)
  }
})

test('focused validation preserves an arbitrary subprocess failure exit code', async () => {
  const root = temporaryProject()
  try {
    testFile(root, 'tests/failure.test.mjs')
    const runner = async () => ({ code: 23, signal: null, stdout: '', stderr: 'synthetic failure' })
    assert.equal(await validateFocused(['tests/failure.test.mjs'], quiet(root, { runner, resolvePglite: () => 'pglite-entry.js' })), 23)
  } finally {
    removeTemporaryProject(root)
  }
})

test('runProcess waits for close and captures output written immediately before termination', async () => {
  const size = 1024 * 1024
  const result = await runProcess(process.execPath, ['-e', `process.stdout.write('x'.repeat(${size}));process.stderr.write('CLOSE_SENTINEL')`], {
    stdout: sink,
    stderr: sink,
  })
  assert.equal(result.code, 0)
  assert.equal(result.signal, null)
  assert.equal(result.stdout.length, size)
  assert.equal(result.stderr, 'CLOSE_SENTINEL')
})

test('runProcess escalates an ignored graceful request to forced termination after the grace deadline', async () => {
  let gracefulAt
  let forcedAt
  const result = await runProcess(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
    stdout: sink,
    stderr: sink,
    timeoutMs: 20,
    terminationGraceMs: 40,
    forcedCloseMs: 80,
    requestGracefulTermination() { gracefulAt = Date.now() },
    requestForcedTermination(child) {
      forcedAt = Date.now()
      child.kill('SIGKILL')
    },
  })
  assert.equal(result.code, 1)
  assert.equal(result.terminalReason, 'timeout')
  assert.equal(result.forced, true)
  assert.ok(forcedAt - gracefulAt >= 30)
  assert.equal(result.forceCloseExpired, false)
})

test('runProcess treats timeout followed by exit zero as failure', async () => {
  const root = temporaryProject()
  const marker = join(root, 'timeout-exit-zero')
  let child
  let readyOutput = ''
  let ready = false
  let gracefulRequests = 0
  try {
    const source = `const fs=require('node:fs');const marker=${JSON.stringify(marker)};const timer=setInterval(()=>{if(fs.existsSync(marker)){clearInterval(timer);process.exit(0)}},5);process.stdout.write('ready\\n')`
    const result = await runProcess(process.execPath, ['-e', source], {
      stdout: {
        write(chunk) {
          readyOutput += chunk.toString()
          if (!ready && readyOutput.includes('ready\n')) {
            ready = true
            if (gracefulRequests > 0) writeFileSync(marker, 'stop')
          }
          return true
        },
      },
      stderr: sink,
      // Keep a real timeout; deliver its stop request after fixture readiness.
      timeoutMs: 30,
      terminationGraceMs: 2_000,
      forcedCloseMs: 2_000,
      requestGracefulTermination(processChild) {
        child = processChild
        gracefulRequests += 1
        if (ready) writeFileSync(marker, 'stop')
      },
    })
    assert.equal(ready, true)
    assert.equal(gracefulRequests, 1)
    assert.equal(result.exitCode, 0)
    assert.equal(result.signal, null)
    assert.equal(result.code, 1)
    assert.equal(result.terminalReason, 'timeout')
    assert.equal(result.forced, false)
    assert.equal(result.forceCloseExpired, false)
    assert.equal(evaluateRegressionResult({ ...result, stdout: cleanTap(), stderr: '' }, 1).code, 1)
    assert.equal(await waitForPidExit(child.pid), true)
  } finally {
    stopChild(child)
    if (child?.pid) await waitForPidExit(child.pid)
    removeTemporaryProject(root)
  }
})

test('runProcess treats abort followed by exit zero as failure', async () => {
  const root = temporaryProject()
  const marker = join(root, 'abort-exit-zero')
  const controller = new AbortController()
  let child
  let readyOutput = ''
  let ready = false
  let gracefulRequests = 0
  try {
    const source = `const fs=require('node:fs');const marker=${JSON.stringify(marker)};const timer=setInterval(()=>{if(fs.existsSync(marker)){clearInterval(timer);process.exit(0)}},5);process.stdout.write('ready\\n')`
    const pending = runProcess(process.execPath, ['-e', source], {
      stdout: {
        write(chunk) {
          readyOutput += chunk.toString()
          if (!ready && readyOutput.includes('ready\n')) {
            ready = true
            controller.abort()
          }
          return true
        },
      },
      stderr: sink,
      signal: controller.signal,
      timeoutMs: 5_000,
      terminationGraceMs: 2_000,
      forcedCloseMs: 2_000,
      requestGracefulTermination(processChild) {
        child = processChild
        gracefulRequests += 1
        writeFileSync(marker, 'stop')
      },
    })
    const result = await pending
    assert.equal(ready, true)
    assert.equal(gracefulRequests, 1)
    assert.equal(result.exitCode, 0)
    assert.equal(result.signal, null)
    assert.equal(result.code, 1)
    assert.equal(result.terminalReason, 'aborted')
    assert.equal(result.cancelled, true)
    assert.equal(result.forced, false)
    assert.equal(result.forceCloseExpired, false)
    assert.equal(evaluateRegressionResult({ ...result, stdout: cleanTap(), stderr: '' }, 1).code, 1)
    assert.equal(await waitForPidExit(child.pid), true)
  } finally {
    stopChild(child)
    if (child?.pid) await waitForPidExit(child.pid)
    removeTemporaryProject(root)
  }
})

test('runProcess detaches live output pipes after the forced-close deadline', { timeout: 5_000 }, async () => {
  let childPid
  try {
    const source = "process.stdout.write('leader-still-running');setInterval(() => {}, 1000)"
    const started = Date.now()
    const result = await runProcess(process.execPath, ['-e', source], {
      stdout: sink,
      stderr: sink,
      timeoutMs: 200,
      terminationGraceMs: 30,
      forcedCloseMs: 40,
      requestGracefulTermination(child) { childPid = child.pid },
      requestForcedTermination() {},
    })
    assert.equal(result.code, 1)
    assert.equal(result.terminalReason, 'timeout')
    assert.equal(result.forced, true)
    assert.equal(result.forceCloseExpired, true)
    assert.equal(result.streamsDetached, true)
    assert.match(result.stdout, /leader-still-running/)
    assert.ok(Date.now() - started < 1_000)
  } finally {
    if (childPid && pidExists(childPid)) {
      try { process.kill(childPid, 'SIGKILL') } catch {}
      await waitForPidExit(childPid)
    }
  }
})

test('runProcess close during escalation completes once and clears escalation timers', async () => {
  const root = temporaryProject()
  const marker = join(root, 'forced-exit-zero')
  const controller = new AbortController()
  const forcedCloseMs = 2000
  let child
  let readyOutput = ''
  let ready = false
  let completions = 0
  let gracefulRequests = 0
  let forcedRequests = 0
  try {
    const source = `const fs=require('node:fs');const marker=${JSON.stringify(marker)};const timer=setInterval(()=>{if(fs.existsSync(marker)){clearInterval(timer);process.exit(0)}},5);process.stdout.write('ready\\n')`
    const result = await runProcess(process.execPath, ['-e', source], {
      stdout: {
        write(chunk) {
          readyOutput += chunk.toString()
          // Start escalation only after the child has installed its exit poller.
          if (!ready && readyOutput.includes('ready\n')) {
            ready = true
            controller.abort()
          }
          return true
        },
      },
      stderr: sink,
      signal: controller.signal,
      timeoutMs: 5000,
      terminationGraceMs: 25,
      forcedCloseMs,
      requestGracefulTermination(processChild) {
        child = processChild
        gracefulRequests += 1
      },
      requestForcedTermination() {
        forcedRequests += 1
        writeFileSync(marker, 'stop')
      },
    }).then(result => {
      completions += 1
      return result
    })
    assert.equal(ready, true)
    assert.equal(result.terminalReason, 'aborted')
    assert.equal(result.code, 1)
    assert.equal(result.exitCode, 0)
    assert.equal(result.forced, true)
    assert.equal(result.forceCloseExpired, false)
    assert.equal(await waitForPidExit(child.pid), true)
    // Observe beyond the fallback deadline, retaining the timer-cleanup checks.
    await new Promise(resolveWait => setTimeout(resolveWait, forcedCloseMs + 50))
    assert.equal(completions, 1)
    assert.equal(gracefulRequests, 1)
    assert.equal(forcedRequests, 1)
  } finally {
    stopChild(child)
    if (child?.pid) await waitForPidExit(child.pid)
    removeTemporaryProject(root)
  }
})

test('runProcess clears timeout and abort listeners after normal completion', async () => {
  const controller = new AbortController()
  let gracefulRequests = 0
  let forcedRequests = 0
  const result = await runProcess(process.execPath, ['-e', "process.stdout.write('normal')"], {
    stdout: sink,
    stderr: sink,
    signal: controller.signal,
    timeoutMs: 250,
    terminationGraceMs: 20,
    forcedCloseMs: 20,
    requestGracefulTermination() { gracefulRequests += 1 },
    requestForcedTermination() { forcedRequests += 1 },
  })
  assert.equal(result.code, 0)
  controller.abort()
  await new Promise(resolveWait => setTimeout(resolveWait, 300))
  assert.equal(gracefulRequests, 0)
  assert.equal(forcedRequests, 0)
})

test('regression discovery is recursive, sorted, deduplicated, and extension based', () => {
  const root = temporaryProject()
  try {
    testFile(root, 'tests/z.test.ts')
    testFile(root, 'tests/nested/a.test.mjs')
    testFile(root, 'tests/nested/fixture.browser.cjs', 'throw new Error("browser")')
    testFile(root, 'tests/nested/helper.mjs', 'throw new Error("helper")')
    const found = discoverStandardTests(root).map(path => relative(join(root, 'tests'), path).replaceAll('\\', '/'))
    assert.deepEqual(found, ['nested/a.test.mjs', 'z.test.ts'])
  } finally {
    removeTemporaryProject(root)
  }
})

test('regression treats skipped and incomplete standard test results as failures', async () => {
  const root = temporaryProject()
  try {
    testFile(root, 'tests/skipped.test.mjs', "import { test } from 'node:test'; test('skip', { skip: true }, () => {})\n")
    assert.equal(await validateRegression(quiet(root, { resolvePglite: resolvePgliteEntry })), 1)
    const incomplete = evaluateRegressionResult({
      code: 0,
      stdout: '# tests 2\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n',
      stderr: '',
    }, 1)
    assert.equal(incomplete.code, 1)
  } finally {
    removeTemporaryProject(root)
  }
})

test('release runs in order once and stops at the first failure', async () => {
  const calls = []
  const steps = [
    async () => { calls.push('types'); return 0 },
    async () => { calls.push('regression'); return 1 },
    async () => { calls.push('build'); return 0 },
    async () => { calls.push('git'); return 0 },
  ]
  assert.equal(await validateRelease(['scripts/validate.mjs'], { logger, steps }), 1)
  assert.deepEqual(calls, ['types', 'regression'])

  calls.length = 0
  assert.equal(await validateRelease([], { logger, steps }), 1)
  assert.deepEqual(calls, [])
})

test('browser supervisor cleans descendants after successful fixture completion', { timeout: 10_000 }, async () => {
  const root = temporaryProject()
  const pidFile = join(root, 'success-descendant.pid')
  try {
    testFile(root, 'tests/success.browser.cjs', syntheticBrowserSource(pidFile, 'success'))
    const options = quiet(root, {
      timeoutMs: 2_000,
      cleanupMs: 2_000,
      cleanup: browserCleanup(pidFile),
      browserCwd: tmpdir(),
    })
    assert.equal(await validateBrowser(['tests/success.browser.cjs'], options), 0)
    assert.equal(await waitForPidExit(Number(readFileSync(pidFile, 'utf8'))), true)
  } finally {
    removeTemporaryProject(root)
  }
})

test('browser supervisor preserves fixture failure status and cleans descendants', { timeout: 10_000 }, async () => {
  const root = temporaryProject()
  const pidFile = join(root, 'failure-descendant.pid')
  try {
    testFile(root, 'tests/failure.browser.cjs', syntheticBrowserSource(pidFile, 'failure'))
    const options = quiet(root, {
      timeoutMs: 2_000,
      cleanupMs: 2_000,
      cleanup: browserCleanup(pidFile),
      browserCwd: tmpdir(),
    })
    assert.equal(await validateBrowser(['tests/failure.browser.cjs'], options), 7)
    assert.equal(await waitForPidExit(Number(readFileSync(pidFile, 'utf8'))), true)
  } finally {
    removeTemporaryProject(root)
  }
})

test('browser supervisor cleans descendants after timeout without touching unrelated processes', { timeout: 10_000 }, async () => {
  const root = temporaryProject()
  const pidFile = join(root, 'timeout-descendant.pid')
  const unrelated = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore', windowsHide: true })
  unrelated.unref()
  try {
    testFile(root, 'tests/timeout.browser.cjs', syntheticBrowserSource(pidFile, 'timeout'))
    const options = quiet(root, {
      timeoutMs: 300,
      cleanupMs: 2_000,
      cleanup: browserCleanup(pidFile),
      browserCwd: tmpdir(),
    })
    assert.equal(await validateBrowser(['tests/timeout.browser.cjs'], options), 1)
    assert.equal(await waitForPidExit(Number(readFileSync(pidFile, 'utf8'))), true)
    assert.equal(pidExists(unrelated.pid), true)
    assert.deepEqual(windowsTaskkillInvocation(123, 'C:\\Windows'), {
      command: 'C:\\Windows\\System32\\taskkill.exe',
      args: ['/PID', '123', '/T', '/F'],
    })
  } finally {
    stopChild(unrelated)
    removeTemporaryProject(root)
  }
})

test('browser cleanup failure returns nonzero even after fixture success', { timeout: 10_000 }, async () => {
  const root = temporaryProject()
  const pidFile = join(root, 'cleanup-failure-descendant.pid')
  try {
    testFile(root, 'tests/cleanup-failure.browser.cjs', syntheticBrowserSource(pidFile, 'success'))
    const options = quiet(root, {
      timeoutMs: 2_000,
      cleanupMs: 2_000,
      cleanup: browserCleanup(pidFile, { reportFailure: true }),
      browserCwd: tmpdir(),
    })
    assert.equal(await validateBrowser(['tests/cleanup-failure.browser.cjs'], options), 1)
    assert.equal(await waitForPidExit(Number(readFileSync(pidFile, 'utf8'))), true)
  } finally {
    removeTemporaryProject(root)
  }
})

test('git validation fails when the exact staged path set differs', async () => {
  const root = temporaryProject()
  try {
    spawnSync('git', ['init', '--quiet'], { cwd: root, stdio: 'ignore' })
    writeFileSync(join(root, 'actual.txt'), 'staged\n')
    assert.equal(spawnSync('git', ['add', '--', 'actual.txt'], { cwd: root }).status, 0)
    assert.equal(await validateGit(['expected.txt'], quiet(root)), 1)
  } finally {
    removeTemporaryProject(root)
  }
})

test('git validation parses multiple NUL-delimited staged paths including spaces', async () => {
  const root = temporaryProject()
  try {
    spawnSync('git', ['init', '--quiet'], { cwd: root, stdio: 'ignore' })
    writeFileSync(join(root, 'first.txt'), 'first\n')
    writeFileSync(join(root, 'path with spaces.txt'), 'second\n')
    assert.equal(spawnSync('git', ['add', '--', 'first.txt', 'path with spaces.txt'], { cwd: root }).status, 0)
    assert.equal(await validateGit(['first.txt', 'path with spaces.txt'], quiet(root)), 0)
  } finally {
    removeTemporaryProject(root)
  }
})

test('git validation keeps NUL-delimited names silent and formats comparison results readably', async () => {
  const root = temporaryProject()
  try {
    spawnSync('git', ['init', '--quiet'], { cwd: root, stdio: 'ignore' })
    writeFileSync(join(root, 'first.txt'), 'first\n')
    writeFileSync(join(root, 'path with spaces.txt'), 'second\n')
    assert.equal(spawnSync('git', ['add', '--', 'first.txt', 'path with spaces.txt'], { cwd: root }).status, 0)

    let streamed = ''
    const successMessages = []
    const successLogger = { log(value) { successMessages.push(value) }, error(value) { successMessages.push(value) } }
    const output = { write(chunk) { streamed += chunk.toString(); return true } }
    assert.equal(await validateGit(['first.txt', 'path with spaces.txt'], {
      root,
      logger: successLogger,
      stdout: output,
      stderr: sink,
    }), 0)
    assert.equal(streamed.includes('\0'), false)
    assert.equal(streamed.includes('first.txtpath with spaces.txt'), false)
    assert.match(successMessages.join('\n'), /Staged paths verified: 2/)

    const mismatchMessages = []
    const mismatchLogger = { log(value) { mismatchMessages.push(value) }, error(value) { mismatchMessages.push(value) } }
    assert.equal(await validateGit(['first.txt', 'missing path.txt'], {
      root,
      logger: mismatchLogger,
      stdout: output,
      stderr: sink,
    }), 1)
    const mismatchOutput = mismatchMessages.join('\n')
    assert.match(mismatchOutput, /Missing paths:\n- missing path\.txt/)
    assert.match(mismatchOutput, /Unexpected paths:\n- path with spaces\.txt/)
  } finally {
    removeTemporaryProject(root)
  }
})

test('git validation runs both whitespace checks and preserves both failures', async () => {
  const calls = []
  const messages = []
  const testLogger = { log(value) { messages.push(value) }, error(value) { messages.push(value) } }
  const runner = async (command, args) => {
    calls.push(args.join(' '))
    if (args.includes('--name-only')) return { code: 0, stdout: 'intended.txt\0', stderr: '' }
    if (args.includes('--cached')) return { code: 3, stdout: '', stderr: 'cached whitespace failure\n' }
    return { code: 2, stdout: 'working whitespace failure\n', stderr: '' }
  }
  assert.equal(await validateGit(['intended.txt'], { logger: testLogger, runner }), 2)
  assert.deepEqual(calls, [
    'diff --cached --name-only -z',
    'diff --check',
    'diff --cached --check',
  ])
  assert.match(messages.join('\n'), /working whitespace failure/)
  assert.match(messages.join('\n'), /cached whitespace failure/)
})

test('build delegation and npm scripts do not recursively invoke the validation harness', async () => {
  const calls = []
  const runner = async (command, args) => {
    calls.push([command, args])
    return { code: 0, stdout: '', stderr: '' }
  }
  assert.equal(await validateBuild({ logger, runner, buildInvocation: { command: 'npm', args: ['run', 'build'] } }), 0)
  assert.deepEqual(calls, [['npm', ['run', 'build']]])

  const scripts = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')).scripts
  for (const name of ['focused', 'types', 'build', 'regression', 'browser', 'git', 'release']) {
    assert.equal(scripts[`validate:${name}`], `node scripts/validate.mjs ${name}`)
  }
  assert.equal(scripts.build, 'next build')
})
