import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { test } from 'node:test'

import { AgentRegistry, FakeAgentAdapter } from '../tools/agent-orchestrator/agents.mjs'
import { Coordinator, loadRunState } from '../tools/agent-orchestrator/coordinator.mjs'
import { ARTIFACT_FILES, validateArtifactDirectory, validateArtifactDirectorySchema, validateArtifactSet, validateArtifactSetSchema, validateReadinessState } from '../tools/agent-orchestrator/evidence.mjs'
import { writeArtifacts } from '../tools/agent-orchestrator/evidence.mjs'
import { classifyRisk, requiredRoles } from '../tools/agent-orchestrator/policy.mjs'
import { runSafeTrial } from '../tools/agent-orchestrator/trial.mjs'
import { FakeValidationAdapter } from '../tools/agent-orchestrator/validation.mjs'
import {
  COORDINATOR_TEMP_DIRECTORY,
  COORDINATOR_TEMP_PREFIX,
  WorkspaceTransactionError,
  applyCandidateOperations,
  candidateIdentity,
  sha256,
  snapshotPaths,
} from '../tools/agent-orchestrator/workspace.mjs'

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim()
}

function createFixture({ extraFiles = {}, directories = [] } = {}) {
  const root = mkdtempSync(resolve(tmpdir(), 'mpp-aos-test-'))
  const workspaceRoot = resolve(root, 'workspace')
  const runDirectory = resolve(root, 'run')
  const artifactDirectory = resolve(root, 'artifacts')
  mkdirSync(workspaceRoot, { recursive: true })
  writeFileSync(resolve(workspaceRoot, 'allowed.txt'), 'base\n')
  for (const directory of directories) mkdirSync(resolve(workspaceRoot, ...directory.split('/')), { recursive: true })
  for (const [path, content] of Object.entries(extraFiles)) {
    const target = resolve(workspaceRoot, ...path.split('/'))
    mkdirSync(resolve(target, '..'), { recursive: true })
    writeFileSync(target, content)
  }
  git(workspaceRoot, ['init', '--quiet'])
  git(workspaceRoot, ['config', 'core.autocrlf', 'false'])
  git(workspaceRoot, ['config', 'user.name', 'Synthetic Test'])
  git(workspaceRoot, ['config', 'user.email', 'synthetic@example.invalid'])
  git(workspaceRoot, ['add', '--', 'allowed.txt'])
  for (const path of Object.keys(extraFiles)) git(workspaceRoot, ['add', '--', path])
  git(workspaceRoot, ['commit', '--quiet', '-m', 'synthetic base'])
  return {
    root,
    workspaceRoot,
    runDirectory,
    artifactDirectory,
    baseCommit: git(workspaceRoot, ['rev-parse', 'HEAD']),
    dispose() { rmSync(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }) },
  }
}

function packet(fixture, overrides = {}) {
  return {
    taskId: 'AOS-TEST',
    approved: true,
    baseCommit: fixture.baseCommit,
    risk: 'low',
    userFacing: false,
    riskAreas: [],
    requireIndependentReview: false,
    allowedPaths: ['allowed.txt'],
    productQa: { required: false, notRequiredReason: 'Synthetic nonfunctional test.' },
    validation: [{ id: 'focused', family: 'validate:focused', required: true }],
    ...overrides,
  }
}

function implementation(content = 'changed\n', extra = {}) {
  return {
    kind: 'implementation',
    result: 'pass',
    evidence: ['implementation-evidence'],
    candidate: { operations: [{ type: 'write', path: 'allowed.txt', content }] },
    ...extra,
  }
}

function review(result = 'pass', extra = {}) {
  return ({ candidateId }) => ({
    kind: 'review',
    result,
    candidateId,
    evidence: ['review-evidence'],
    findings: result === 'fail' ? ['Synthetic correction requested.'] : [],
    ...extra,
  })
}

function architecture(extra = {}) {
  return { kind: 'architecture', result: 'pass', evidence: ['architecture-evidence'], ...extra }
}

function deferred() {
  let resolvePromise
  let rejectPromise
  const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject })
  return { promise, resolve: resolvePromise, reject: rejectPromise }
}

function humanQa(state, overrides = {}) {
  return {
    taskId: state.packet.taskId,
    runId: state.runId,
    packetHash: state.packetHash,
    candidateId: state.candidateId,
    producerType: 'human',
    result: 'pass',
    evidenceRef: `human-qa:${state.candidateId}`,
    reason: 'Synthetic human QA passed for this candidate.',
    ...overrides,
  }
}

async function runScenario({ packetOverrides, agents, validation, fixture: suppliedFixture, runOptions, coordinatorOptions = {} } = {}) {
  const fixture = suppliedFixture ?? createFixture()
  const coordinator = new Coordinator({
    packet: packet(fixture, packetOverrides),
    workspaceRoot: fixture.workspaceRoot,
    runDirectory: fixture.runDirectory,
    artifactDirectory: fixture.artifactDirectory,
    agentAdapter: new FakeAgentAdapter(agents ?? { implementer: [implementation()] }),
    validationAdapter: new FakeValidationAdapter(validation ?? { focused: { result: 'pass', details: 'Synthetic pass.' } }),
    ...coordinatorOptions,
  })
  return { fixture, coordinator, result: await coordinator.run(runOptions) }
}

function tamperState(fixture, mutate) {
  const path = resolve(fixture.runDirectory, 'state.json')
  const state = JSON.parse(readFileSync(path, 'utf8'))
  mutate(state)
  writeFileSync(path, `${JSON.stringify(state, null, 2)}\n`)
}

test('risk routes are exact and semantic policy cannot downgrade risk', () => {
  assert.deepEqual(requiredRoles('low'), ['implementer'])
  assert.deepEqual(requiredRoles('medium'), ['implementer', 'reviewer'])
  assert.deepEqual(requiredRoles('high'), ['architect', 'implementer', 'reviewer'])
  assert.deepEqual(requiredRoles('low', { requireIndependentReview: true }), ['implementer', 'reviewer'])
  assert.equal(classifyRisk({ requestedRisk: 'low', userFacing: true }), 'medium')
  assert.equal(classifyRisk({ requestedRisk: 'low', areas: ['privacy'] }), 'high')
  assert.equal(classifyRisk({ requestedRisk: 'high' }), 'high')
})

test('a fourth agent identity is denied', () => {
  const registry = new AgentRegistry()
  for (const role of ['architect', 'implementer', 'reviewer']) {
    const identity = registry.acquire(role)
    registry.release(identity)
  }
  assert.throws(() => registry.acquire('validator'), /fourth agent identity/i)
})

test('a third concurrent agent is denied', () => {
  const registry = new AgentRegistry()
  registry.acquire('architect')
  registry.acquire('implementer')
  assert.throws(() => registry.acquire('reviewer'), /third concurrent agent/i)
})

test('candidate identity is deterministic and changes with operation, path, or contents', () => {
  const base = 'base-commit'
  const left = { 'b.txt': { operation: 'modify', contentHash: sha256(Buffer.from('b')) }, 'a.txt': { operation: 'add', contentHash: sha256(Buffer.from('a')) } }
  const reordered = { 'a.txt': { operation: 'add', contentHash: sha256(Buffer.from('a')) }, 'b.txt': { operation: 'modify', contentHash: sha256(Buffer.from('b')) } }
  assert.equal(candidateIdentity(base, left), candidateIdentity(base, reordered))
  assert.notEqual(candidateIdentity(base, left), candidateIdentity(base, { ...reordered, 'b.txt': { operation: 'modify', contentHash: sha256(Buffer.from('B')) } }))
  assert.notEqual(candidateIdentity(base, left), candidateIdentity(base, { ...reordered, 'b.txt': { operation: 'add', contentHash: sha256(Buffer.from('b')) } }))
  assert.notEqual(candidateIdentity(base, left), candidateIdentity('other-base', left))
})

test('candidate identity is binary-safe for distinct invalid UTF-8 byte sequences', async () => {
  const firstBytes = Buffer.from([0x80, 0xff, 0x00])
  const secondBytes = Buffer.from([0x81, 0xff, 0x00])
  const first = { 'allowed.txt': { operation: 'modify', contentHash: sha256(firstBytes) } }
  const same = { 'allowed.txt': { operation: 'modify', contentHash: sha256(Buffer.from(firstBytes)) } }
  const second = { 'allowed.txt': { operation: 'modify', contentHash: sha256(secondBytes) } }
  assert.equal(candidateIdentity('base', first), candidateIdentity('base', same))
  assert.notEqual(candidateIdentity('base', first), candidateIdentity('base', second))

  const fixture = createFixture()
  try {
    const { result } = await runScenario({
      fixture,
      agents: { implementer: [implementation(undefined, {
        candidate: { operations: [{ type: 'write', path: 'allowed.txt', bytesBase64: firstBytes.toString('base64') }] },
      })] },
    })
    assert.equal(result.status, 'READY_FOR_HANDOFF')
    assert.deepEqual(readFileSync(resolve(fixture.workspaceRoot, 'allowed.txt')), firstBytes)
    assert.equal(result.state.candidateManifest['allowed.txt'].contentHash, sha256(firstBytes))
  } finally { fixture.dispose() }
})

test('unauthorized paths and Windows aliases block before any mutation', async () => {
  for (const path of [
    'outside.txt', '../allowed.txt', 'C:\\allowed.txt', 'ALLOWED.txt', 'allowed.txt.', 'allowed.txt:stream',
    '.git/config', '.GIT/config', 'nested/.git/config', 'nested/.GiT/config', 'nested\\.GIT\\config',
  ]) {
    const fixture = createFixture()
    try {
      const original = readFileSync(resolve(fixture.workspaceRoot, 'allowed.txt'), 'utf8')
      const { result } = await runScenario({
        fixture,
        packetOverrides: path.toLowerCase().includes('.git') ? { allowedPaths: ['allowed.txt', path] } : undefined,
        agents: { implementer: [implementation('hostile\n', { candidate: { operations: [{ type: 'write', path, content: 'hostile\n' }] } })] },
      })
      assert.equal(result.status, 'BLOCKED', path)
      assert.equal(result.state.blockers.at(-1).code, 'UNAUTHORIZED_PATH', path)
      assert.equal(readFileSync(resolve(fixture.workspaceRoot, 'allowed.txt'), 'utf8'), original, path)
    } finally { fixture.dispose() }
  }
})

test('an invalid operation later in a proposal prevents every earlier operation from applying', async () => {
  const fixture = createFixture()
  try {
    const { result } = await runScenario({
      fixture,
      agents: { implementer: [{
        ...implementation(),
        candidate: { operations: [
          { type: 'write', path: 'allowed.txt', content: 'would-be-partial\n' },
          { type: 'write', path: '../escape.txt', content: 'bad\n' },
        ] },
      }] },
    })
    assert.equal(result.status, 'BLOCKED')
    assert.equal(readFileSync(resolve(fixture.workspaceRoot, 'allowed.txt'), 'utf8'), 'base\n')
  } finally { fixture.dispose() }
})

test('unique owned temp directories preserve preexisting names and clean up only their own directory', async () => {
  const collision = createFixture({ directories: [COORDINATOR_TEMP_DIRECTORY] })
  try {
    writeFileSync(resolve(collision.workspaceRoot, COORDINATOR_TEMP_DIRECTORY, 'preexisting.txt'), 'preexisting\n')
    const { result } = await runScenario({ fixture: collision })
    assert.equal(result.status, 'READY_FOR_HANDOFF')
    assert.equal(readFileSync(resolve(collision.workspaceRoot, COORDINATOR_TEMP_DIRECTORY, 'preexisting.txt'), 'utf8'), 'preexisting\n')
    assert.equal(readFileSync(resolve(collision.workspaceRoot, 'allowed.txt'), 'utf8'), 'changed\n')
  } finally { collision.dispose() }

  const fixture = createFixture()
  try {
    let ownedPath
    applyCandidateOperations({
      workspaceRoot: fixture.workspaceRoot,
      operations: [{ type: 'write', path: 'allowed.txt', content: 'direct-change\n' }],
      packet: packet(fixture),
      transactionHooks: { afterTempCreated: ({ path }) => { ownedPath = path } },
    })
    assert.match(ownedPath, new RegExp(`${COORDINATOR_TEMP_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^\\\\/]+$`))
    assert.equal(existsSync(ownedPath), false)

    let keptPath
    applyCandidateOperations({
      workspaceRoot: fixture.workspaceRoot,
      operations: [{ type: 'write', path: 'allowed.txt', content: 'debug-change\n' }],
      packet: packet(fixture),
      keepOwnedTemp: true,
      transactionHooks: { afterTempCreated: ({ path }) => { keptPath = path } },
    })
    assert.equal(existsSync(keptPath), true)
  } finally { fixture.dispose() }
})

test('a competing temp creation race is never deleted and symlink capability is reported explicitly', async () => {
  const fixture = createFixture()
  try {
    let competingPath
    assert.throws(() => applyCandidateOperations({
      workspaceRoot: fixture.workspaceRoot,
      operations: [{ type: 'write', path: 'allowed.txt', content: 'never-applied\n' }],
      packet: packet(fixture),
      tempFactory(prefix) {
        competingPath = `${prefix}racer`
        mkdirSync(competingPath)
        writeFileSync(resolve(competingPath, 'competitor.txt'), 'competitor-owned\n')
        throw new Error('Synthetic exclusive-create race loss.')
      },
    }), error => {
      assert.ok(error instanceof WorkspaceTransactionError)
      assert.equal(error.recovery.complete, true)
      return true
    })
    assert.equal(readFileSync(resolve(competingPath, 'competitor.txt'), 'utf8'), 'competitor-owned\n')
    assert.equal(readFileSync(resolve(fixture.workspaceRoot, 'allowed.txt'), 'utf8'), 'base\n')

    const link = resolve(fixture.workspaceRoot, COORDINATOR_TEMP_DIRECTORY)
    const linkTarget = resolve(fixture.root, 'link-target')
    mkdirSync(linkTarget)
    let symlinkCapability = 'supported'
    try { symlinkSync(linkTarget, link, process.platform === 'win32' ? 'junction' : 'dir') } catch (error) {
      symlinkCapability = `unsupported:${error.code}`
      assert.ok(['EPERM', 'EACCES', 'ENOTSUP', 'UNKNOWN'].includes(error.code))
    }
    if (symlinkCapability === 'supported') {
      const { result } = await runScenario({ fixture })
      assert.equal(result.status, 'READY_FOR_HANDOFF')
      assert.equal(existsSync(link), true)
    } else {
      assert.match(symlinkCapability, /^unsupported:/)
    }
  } finally { fixture.dispose() }
})

test('transaction recovery restores exact bytes after apply, readback, and manifest-finalization failures', () => {
  for (const failurePoint of ['apply', 'readback', 'manifest']) {
    const fixture = createFixture({ extraFiles: { 'second.txt': 'second-base\n' } })
    try {
      const before = snapshotPaths(fixture.workspaceRoot, ['allowed.txt', 'second.txt'])
      const transactionHooks = failurePoint === 'apply'
        ? { beforeApplyOperation: ({ index }) => { if (index === 1) throw new Error('Synthetic mid-apply failure.') } }
        : failurePoint === 'readback'
          ? { beforeReadback: () => { throw new Error('Synthetic readback failure.') } }
          : { beforeManifestFinalize: () => { throw new Error('Synthetic manifest-finalization failure.') } }
      assert.throws(() => applyCandidateOperations({
        workspaceRoot: fixture.workspaceRoot,
        operations: [
          { type: 'write', path: 'allowed.txt', content: 'first-mutated\n' },
          { type: 'write', path: 'second.txt', content: 'second-mutated\n' },
        ],
        packet: packet(fixture, { allowedPaths: ['allowed.txt', 'second.txt'] }),
        transactionHooks,
      }), error => {
        assert.ok(error instanceof WorkspaceTransactionError)
        assert.equal(error.recovery.complete, true)
        assert.deepEqual(error.recovery.errors, [])
        assert.match(error.message, /verified recovery completed/i)
        return true
      }, failurePoint)
      assert.deepEqual(snapshotPaths(fixture.workspaceRoot, ['allowed.txt', 'second.txt']), before, failurePoint)
    } finally { fixture.dispose() }
  }
})

test('transaction recovery reports restore and verification failures without claiming rollback', () => {
  for (const failureMode of ['restore', 'verify']) {
    const fixture = createFixture({ extraFiles: { 'second.txt': 'second-base\n' } })
    try {
      const hooks = {
        beforeApplyOperation: ({ index }) => { if (index === 1) throw new Error('Synthetic mid-apply failure.') },
        ...(failureMode === 'restore'
          ? { beforeRecoveryPath: ({ path }) => { if (path === 'allowed.txt') throw new Error('Synthetic restore failure.') } }
          : { afterRecoveryPath: ({ path, target }) => { if (path === 'allowed.txt') writeFileSync(target, 'post-recovery-corruption\n') } }),
      }
      assert.throws(() => applyCandidateOperations({
        workspaceRoot: fixture.workspaceRoot,
        operations: [
          { type: 'write', path: 'allowed.txt', content: 'first-mutated\n' },
          { type: 'write', path: 'second.txt', content: 'second-mutated\n' },
        ],
        packet: packet(fixture, { allowedPaths: ['allowed.txt', 'second.txt'] }),
        transactionHooks: hooks,
      }), error => {
        assert.ok(error instanceof WorkspaceTransactionError)
        assert.equal(error.recovery.complete, false)
        assert.match(error.message, /recovery incomplete/i)
        assert.ok(error.recovery.errors.some(item => item.path === 'allowed.txt' && item.stage === failureMode))
        return true
      })
      assert.notEqual(readFileSync(resolve(fixture.workspaceRoot, 'allowed.txt'), 'utf8'), 'base\n')
      assert.equal(readFileSync(resolve(fixture.workspaceRoot, 'second.txt'), 'utf8'), 'second-base\n')
    } finally { fixture.dispose() }
  }
})

test('coordinator records truthful complete and incomplete recovery evidence and never publishes a candidate', async () => {
  for (const recoveryComplete of [true, false]) {
    const fixture = createFixture({ extraFiles: { 'second.txt': 'second-base\n' } })
    try {
      const before = snapshotPaths(fixture.workspaceRoot, ['allowed.txt', 'second.txt'])
      const transactionHooks = {
        beforeApplyOperation: ({ index }) => { if (index === 1) throw new Error('Synthetic coordinator transaction failure.') },
        ...(!recoveryComplete ? { beforeRecoveryPath: ({ path }) => { if (path === 'allowed.txt') throw new Error('Synthetic coordinator recovery failure.') } } : {}),
      }
      const { result } = await runScenario({
        fixture,
        packetOverrides: { allowedPaths: ['allowed.txt', 'second.txt'] },
        agents: { implementer: [{ ...implementation(), candidate: { operations: [
          { type: 'write', path: 'allowed.txt', content: 'first-mutated\n' },
          { type: 'write', path: 'second.txt', content: 'second-mutated\n' },
        ] } }] },
        coordinatorOptions: { workspaceTransactionOptions: { transactionHooks } },
      })
      assert.equal(result.status, 'BLOCKED')
      assert.equal(result.state.blockers.at(-1).code, 'INTEGRITY_FAILURE')
      assert.equal(result.state.recoveryEvents.length, 1)
      assert.equal(result.state.recoveryEvents[0].complete, recoveryComplete)
      assert.match(result.state.blockers.at(-1).message, recoveryComplete ? /verified recovery completed/i : /recovery incomplete/i)
      assert.deepEqual(result.state.candidateManifest, {})
      assert.equal(result.state.candidateId, null)
      assert.ok(result.state.evidenceRefs.some(reference => reference.type === 'recovery' && reference.result === 'blocked'))
      if (recoveryComplete) assert.deepEqual(snapshotPaths(fixture.workspaceRoot, ['allowed.txt', 'second.txt']), before)
      else assert.ok(result.state.recoveryEvents[0].errors.some(error => error.stage === 'restore'))
    } finally { fixture.dispose() }
  }
})

test('directory targets, ancestor conflicts, and duplicate targets fail before mutation', async () => {
  const cases = [
    {
      fixture: createFixture({ directories: ['folder'] }),
      packetOverrides: { allowedPaths: ['allowed.txt', 'folder'] },
      operations: [{ type: 'write', path: 'allowed.txt', content: 'partial\n' }, { type: 'write', path: 'folder', content: 'bad\n' }],
    },
    {
      fixture: createFixture({ directories: ['folder'] }),
      packetOverrides: {
        risk: 'high', riskAreas: ['destructive_operations'], allowedPaths: ['allowed.txt', 'folder', 'renamed'],
        mutationPolicy: { deletePaths: [], renames: [{ from: 'folder', to: 'renamed' }] },
      },
      operations: [{ type: 'write', path: 'allowed.txt', content: 'partial\n' }, { type: 'rename', path: 'folder', destination: 'renamed' }],
      high: true,
    },
    {
      fixture: createFixture({ directories: ['nested'] }),
      packetOverrides: { allowedPaths: ['allowed.txt', 'nested/file', 'nested/file/child'] },
      operations: [
        { type: 'write', path: 'allowed.txt', content: 'partial\n' },
        { type: 'write', path: 'nested/file', content: 'one\n' },
        { type: 'write', path: 'nested/file/child', content: 'two\n' },
      ],
    },
    {
      fixture: createFixture(),
      packetOverrides: { allowedPaths: ['allowed.txt'] },
      operations: [{ type: 'write', path: 'allowed.txt', content: 'one\n' }, { type: 'write', path: 'allowed.txt', content: 'two\n' }],
    },
  ]
  for (const entry of cases) {
    try {
      const scripts = {
        implementer: [{ ...implementation(), candidate: { operations: entry.operations } }],
        ...(entry.high ? { architect: [architecture()], reviewer: [review('pass')] } : {}),
      }
      const { result } = await runScenario({ fixture: entry.fixture, packetOverrides: entry.packetOverrides, agents: scripts })
      assert.equal(result.status, 'BLOCKED')
      assert.equal(readFileSync(resolve(entry.fixture.workspaceRoot, 'allowed.txt'), 'utf8'), 'base\n')
      assert.deepEqual(result.state.candidateManifest, {})
    } finally { entry.fixture.dispose() }
  }
})

test('low-risk rename and delete requests block for packet amendment', async () => {
  for (const operation of [
    { type: 'delete', path: 'allowed.txt' },
    { type: 'rename', path: 'allowed.txt', destination: 'renamed.txt' },
  ]) {
    const fixture = createFixture()
    try {
      const { result } = await runScenario({
        fixture,
        packetOverrides: { allowedPaths: ['allowed.txt', 'renamed.txt'] },
        agents: { implementer: [{ ...implementation(), candidate: { operations: [operation] } }] },
      })
      assert.equal(result.status, 'BLOCKED')
      assert.equal(result.state.blockers.at(-1).code, 'RISK_MISMATCH')
      assert.equal(readFileSync(resolve(fixture.workspaceRoot, 'allowed.txt'), 'utf8'), 'base\n')
    } finally { fixture.dispose() }
  }
})

test('agent authorized flags cannot authorize high-risk delete or rename', async () => {
  for (const operation of [
    { type: 'delete', path: 'allowed.txt', authorized: true },
    { type: 'rename', path: 'allowed.txt', destination: 'renamed.txt', authorized: true },
  ]) {
    const fixture = createFixture()
    try {
      const { result } = await runScenario({
        fixture,
        packetOverrides: { risk: 'high', riskAreas: ['destructive_operations'], allowedPaths: ['allowed.txt', 'renamed.txt'] },
        agents: {
          architect: [architecture()],
          implementer: [{ ...implementation(), candidate: { operations: [operation] } }],
          reviewer: [review('pass')],
        },
      })
      assert.equal(result.status, 'BLOCKED')
      assert.equal(result.state.blockers.at(-1).code, 'UNAUTHORIZED_PATH')
      assert.equal(readFileSync(resolve(fixture.workspaceRoot, 'allowed.txt'), 'utf8'), 'base\n')
    } finally { fixture.dispose() }
  }
})

test('approved packet policy authorizes delete while non-destructive writes remain unaffected', async () => {
  const destructive = createFixture()
  try {
    const { result } = await runScenario({
      fixture: destructive,
      packetOverrides: {
        risk: 'high', riskAreas: ['destructive_operations'],
        mutationPolicy: { deletePaths: ['allowed.txt'], renames: [] },
      },
      agents: {
        architect: [architecture()],
        implementer: [{ ...implementation(), candidate: { operations: [{ type: 'delete', path: 'allowed.txt', authorized: false }] } }],
        reviewer: [review('pass')],
      },
    })
    assert.equal(result.status, 'READY_FOR_HANDOFF')
    assert.equal(result.state.candidateManifest['allowed.txt'].operation, 'delete')
  } finally { destructive.dispose() }

  const write = await runScenario({ agents: { implementer: [implementation('ordinary-write\n', { candidate: { operations: [{ type: 'write', path: 'allowed.txt', content: 'ordinary-write\n', authorized: true }] } })] } })
  try {
    assert.equal(write.result.status, 'READY_FOR_HANDOFF')
    assert.equal(readFileSync(resolve(write.fixture.workspaceRoot, 'allowed.txt'), 'utf8'), 'ordinary-write\n')
  } finally { write.fixture.dispose() }
})

test('packet and agent risk escalation both block for amendment', async () => {
  const first = await runScenario({ packetOverrides: { userFacing: true } })
  try {
    assert.equal(first.result.status, 'BLOCKED')
    assert.equal(first.result.state.blockers.at(-1).code, 'RISK_MISMATCH')
  } finally { first.fixture.dispose() }

  const second = await runScenario({ agents: { implementer: [implementation('changed\n', { detectedRisk: 'high' })] } })
  try {
    assert.equal(second.result.status, 'BLOCKED')
    assert.equal(second.result.state.blockers.at(-1).code, 'RISK_MISMATCH')
  } finally { second.fixture.dispose() }

  const third = await runScenario({ agents: { implementer: [implementation('changed\n', { delegation: { role: 'reviewer' } })] } })
  try {
    assert.equal(third.result.status, 'BLOCKED')
    assert.equal(third.result.state.blockers.at(-1).code, 'SCOPE_EXPANSION')
  } finally { third.fixture.dispose() }
})

test('reviewer mutation attempts block without changing the implementer candidate', async () => {
  const fixture = createFixture()
  try {
    const { result } = await runScenario({
      fixture,
      packetOverrides: { requireIndependentReview: true },
      agents: {
        implementer: [implementation('reviewed-candidate\n')],
        reviewer: [review('pass', { mutations: [{ type: 'write', path: 'allowed.txt', content: 'reviewer-write\n' }] })],
      },
    })
    assert.equal(result.status, 'BLOCKED')
    assert.equal(result.state.blockers.at(-1).code, 'INTEGRITY_FAILURE')
    assert.equal(readFileSync(resolve(fixture.workspaceRoot, 'allowed.txt'), 'utf8'), 'reviewed-candidate\n')
  } finally { fixture.dispose() }
})

test('one correction and recheck retain the original implementer and reviewer identities', async () => {
  const fixture = createFixture()
  try {
    const { result } = await runScenario({
      fixture,
      packetOverrides: { requireIndependentReview: true },
      agents: {
        implementer: [implementation('first\n'), implementation('corrected\n')],
        reviewer: [review('fail'), review('pass')],
      },
    })
    assert.equal(result.status, 'READY_FOR_HANDOFF')
    assert.equal(result.state.correctionRounds, 1)
    assert.equal(result.state.agentRegistry.identities.implementer, 'agent-1-implementer')
    assert.equal(result.state.agentRegistry.identities.reviewer, 'agent-2-reviewer')
    assert.equal(result.state.agentCallCounts.implementer, 2)
    assert.equal(result.state.agentCallCounts.reviewer, 2)
  } finally { fixture.dispose() }
})

test('two correction rounds are permitted and a third is denied', async () => {
  const fixture = createFixture()
  try {
    const { result } = await runScenario({
      fixture,
      packetOverrides: { requireIndependentReview: true },
      agents: {
        implementer: [implementation('v1\n'), implementation('v2\n'), implementation('v3\n')],
        reviewer: [review('fail'), review('fail'), review('fail')],
      },
    })
    assert.equal(result.status, 'BLOCKED')
    assert.equal(result.state.correctionRounds, 2)
    assert.equal(result.state.agentCallCounts.implementer, 3)
    assert.equal(result.state.blockers.at(-1).code, 'REVIEW_LIMIT')
  } finally { fixture.dispose() }
})

test('fresh-adapter correction restart is safe across every durable crash boundary', async () => {
  const points = ['BEFORE_RESERVATION', 'CORRECTION_RESERVED', 'CORRECTION_DISPATCHED', 'CORRECTION_RESPONSE_RECEIVED', 'CORRECTION_RESPONSE_PERSISTED', 'CORRECTION_COMPLETED']
  for (const point of points) {
    const fixture = createFixture()
    const approvedPacket = packet(fixture, { requireIndependentReview: true, budget: { maxAgentCalls: 4 } })
    const firstAdapter = new FakeAgentAdapter({
      implementer: [implementation('initial\n'), implementation('corrected\n')],
      reviewer: [review('fail'), review('pass')],
    })
    const validationAdapter = new FakeValidationAdapter({ focused: { result: 'pass', details: 'Synthetic pass.' } })
    try {
      const first = new Coordinator({
        packet: approvedPacket, workspaceRoot: fixture.workspaceRoot, runDirectory: fixture.runDirectory,
        artifactDirectory: fixture.artifactDirectory, agentAdapter: firstAdapter, validationAdapter,
      })
      const interrupted = point === 'BEFORE_RESERVATION'
        ? await first.run({ interruptAfter: 'CORRECTING' })
        : await first.run({ interruptAt: point })
      assert.equal(interrupted.status, 'INTERRUPTED', point)
      const pinned = loadRunState(fixture.runDirectory)
      if (point === 'BEFORE_RESERVATION') assert.equal(pinned.correctionAttempt, null)
      else {
        assert.equal(pinned.correctionAttempt.round, 1)
        assert.equal(pinned.correctionAttempt.ordinal, 1)
        assert.equal(pinned.agentCallCounts.implementer, 2)
      }
      const attemptId = pinned.correctionAttempt?.correctionAttemptId
      if (point === 'CORRECTION_DISPATCHED' || point === 'CORRECTION_RESPONSE_RECEIVED') {
        assert.equal(pinned.correctionAttempt.dispatchStatus, 'dispatched')
        assert.equal(pinned.agentCallCounts.implementer, 2)
      }
      if (point === 'CORRECTION_RESPONSE_PERSISTED') assert.equal(pinned.correctionAttempt.dispatchStatus, 'responded')
      if (point === 'CORRECTION_COMPLETED') assert.equal(pinned.correctionAttempt.dispatchStatus, 'completed')
      if (attemptId) {
        const beforeResume = firstAdapter.attemptStats(attemptId)
        const physicallyInvoked = ['CORRECTION_RESPONSE_RECEIVED', 'CORRECTION_RESPONSE_PERSISTED', 'CORRECTION_COMPLETED'].includes(point)
        assert.equal(beforeResume.requests, physicallyInvoked ? 1 : 0, point)
        assert.equal(beforeResume.executions, physicallyInvoked ? 1 : 0, point)
        assert.equal(beforeResume.responseCached, physicallyInvoked, point)
      }

      const freshAdapter = new FakeAgentAdapter({
        implementer: [implementation('initial\n'), implementation('corrected\n')],
        reviewer: [review('fail'), review('pass')],
      })
      const resumed = new Coordinator({
        packet: approvedPacket, workspaceRoot: fixture.workspaceRoot, runDirectory: fixture.runDirectory,
        artifactDirectory: fixture.artifactDirectory, agentAdapter: freshAdapter, validationAdapter,
      })
      const result = await resumed.run()
      const uncertain = point === 'CORRECTION_RESPONSE_RECEIVED'
      assert.equal(result.status, uncertain ? 'BLOCKED' : 'READY_FOR_HANDOFF', point)
      assert.equal(result.state.agentCallCounts.implementer, 2, point)
      assert.ok(Object.values(result.state.agentCallCounts).reduce((sum, count) => sum + count, 0) <= 4, point)
      if (uncertain) {
        assert.equal(result.state.correctionRounds, 0, point)
        assert.equal(result.state.correctionAttempt.dispatchStatus, 'dispatched', point)
        assert.equal(result.state.correctionAttempt.executionState, 'uncertain', point)
        assert.equal(result.state.correctionAttempt.adapterRequests, 1, point)
        assert.equal(result.state.blockers.at(-1).code, 'RUNTIME_FAILURE', point)
        assert.match(result.state.blockers.at(-1).message, /uncertain prior dispatch.*replay is forbidden/i, point)
        assert.ok(result.state.evidenceRefs.some(reference => reference.type === 'dispatch_recovery' && reference.result === 'blocked'), point)
      } else {
        assert.equal(result.state.correctionRounds, 1, point)
        assert.equal(result.state.correctionAttempt.dispatchStatus, 'completed', point)
        assert.equal(result.state.correctionAttempt.executionState, 'response_persisted', point)
        assert.equal(result.state.correctionAttempt.adapterRequests, 1, point)
        assert.deepEqual(result.state.agentCallCounts, { implementer: 2, reviewer: 2 }, point)
        assert.deepEqual(result.state.agentInvocationCounts, { implementer: 2, reviewer: 2 }, point)
      }
      if (attemptId) {
        const freshStats = freshAdapter.attemptStats(attemptId)
        const safelyDispatchedAfterRestart = ['CORRECTION_RESERVED', 'CORRECTION_DISPATCHED'].includes(point)
        assert.equal(freshStats.requests, safelyDispatchedAfterRestart ? 1 : 0, point)
        assert.equal(freshStats.executions, safelyDispatchedAfterRestart ? 1 : 0, point)
      }
    } finally { fixture.dispose() }
  }
})

test('fresh adapter recovers the exact persisted response before finally clears the active implementer', async () => {
  const fixture = createFixture()
  const approvedPacket = packet(fixture, { requireIndependentReview: true, budget: { maxAgentCalls: 4 } })
  let preFinallySnapshot
  class SnapshotCoordinator extends Coordinator {
    maybeInterrupt(point) {
      if (point === 'CORRECTION_RESPONSE_PERSISTED') preFinallySnapshot = readFileSync(resolve(fixture.runDirectory, 'state.json'))
      return super.maybeInterrupt(point)
    }
  }
  try {
    const firstAdapter = new FakeAgentAdapter({
      implementer: [implementation('initial\n'), implementation('corrected\n')],
      reviewer: [review('fail'), review('pass')],
    })
    const first = new SnapshotCoordinator({
      packet: approvedPacket, workspaceRoot: fixture.workspaceRoot, runDirectory: fixture.runDirectory,
      artifactDirectory: fixture.artifactDirectory, agentAdapter: firstAdapter,
      validationAdapter: new FakeValidationAdapter({ focused: { result: 'pass', details: 'Synthetic pass.' } }),
    })
    assert.equal((await first.run({ interruptAt: 'CORRECTION_RESPONSE_PERSISTED' })).status, 'INTERRUPTED')
    assert.ok(preFinallySnapshot)
    const snapshot = JSON.parse(preFinallySnapshot.toString())
    assert.equal(snapshot.phase, 'CORRECTING')
    assert.equal(snapshot.correctionAttempt.dispatchStatus, 'responded')
    assert.equal(snapshot.correctionAttempt.executionState, 'response_persisted')
    assert.deepEqual(snapshot.agentRegistry.active, [snapshot.correctionAttempt.identity])
    assert.equal(snapshot.agentInvocationCounts.implementer, 2)
    assert.equal(snapshot.correctionAttempt.adapterRequests, 1)
    const attemptId = snapshot.correctionAttempt.correctionAttemptId
    assert.equal(firstAdapter.attemptStats(attemptId).executions, 1)

    writeFileSync(resolve(fixture.runDirectory, 'state.json'), preFinallySnapshot)
    const freshAdapter = new FakeAgentAdapter({
      implementer: [implementation('must-not-execute\n')], reviewer: [review('fail'), review('pass')],
    })
    const resumed = new Coordinator({
      packet: approvedPacket, workspaceRoot: fixture.workspaceRoot, runDirectory: fixture.runDirectory,
      artifactDirectory: fixture.artifactDirectory, agentAdapter: freshAdapter,
      validationAdapter: new FakeValidationAdapter({ focused: { result: 'pass', details: 'Synthetic pass.' } }),
    })
    const result = await resumed.run()
    assert.equal(result.status, 'READY_FOR_HANDOFF', JSON.stringify(result.state.blockers))
    assert.equal(result.state.correctionRounds, 1)
    assert.deepEqual(result.state.agentRegistry.active, [])
    assert.deepEqual(result.state.agentCallCounts, { implementer: 2, reviewer: 2 })
    assert.deepEqual(result.state.agentInvocationCounts, { implementer: 2, reviewer: 2 })
    assert.deepEqual(freshAdapter.attemptStats(attemptId), { requests: 0, executions: 0, responseCached: false })
    assert.equal(readFileSync(resolve(fixture.workspaceRoot, 'allowed.txt'), 'utf8'), 'corrected\n')
  } finally { fixture.dispose() }
})

test('exhausted correction budget remains exhausted across a fresh-process restart', async () => {
  const fixture = createFixture()
  const approvedPacket = packet(fixture, { requireIndependentReview: true, budget: { maxAgentCalls: 2 } })
  const validation = new FakeValidationAdapter({ focused: { result: 'pass', details: 'Synthetic pass.' } })
  try {
    const first = new Coordinator({
      packet: approvedPacket, workspaceRoot: fixture.workspaceRoot, runDirectory: fixture.runDirectory,
      artifactDirectory: fixture.artifactDirectory,
      agentAdapter: new FakeAgentAdapter({ implementer: [implementation()], reviewer: [review('fail')] }),
      validationAdapter: validation,
    })
    assert.equal((await first.run({ interruptAfter: 'CORRECTING' })).status, 'INTERRUPTED')
    const before = loadRunState(fixture.runDirectory)
    assert.equal(before.correctionAttempt, null)
    assert.deepEqual(before.agentCallCounts, { implementer: 1, reviewer: 1 })
    const freshAdapter = new FakeAgentAdapter({ implementer: [implementation(), implementation('must-not-run\n')], reviewer: [review('fail')] })
    const resumed = new Coordinator({
      packet: approvedPacket, workspaceRoot: fixture.workspaceRoot, runDirectory: fixture.runDirectory,
      artifactDirectory: fixture.artifactDirectory, agentAdapter: freshAdapter, validationAdapter: validation,
    })
    const result = await resumed.run()
    assert.equal(result.status, 'BLOCKED')
    assert.equal(result.state.blockers.at(-1).code, 'BUDGET_EXHAUSTED')
    assert.equal(result.state.correctionAttempt, null)
    assert.deepEqual(result.state.agentCallCounts, { implementer: 1, reviewer: 1 })
    assert.deepEqual(result.state.agentInvocationCounts, { implementer: 1, reviewer: 1 })
    assert.equal(freshAdapter.attemptExecutions.size, 0)
  } finally { fixture.dispose() }
})

test('resume preserves phase, identities, counters, candidate, and evidence', async () => {
  const fixture = createFixture()
  const approvedPacket = packet(fixture, { requireIndependentReview: true })
  const agents = new FakeAgentAdapter({
    implementer: [implementation('first\n'), implementation('corrected\n')],
    reviewer: [review('fail'), review('pass')],
  })
  const validation = new FakeValidationAdapter({ focused: { result: 'pass', details: 'Synthetic pass.' } })
  try {
    const first = new Coordinator({
      packet: approvedPacket,
      workspaceRoot: fixture.workspaceRoot,
      runDirectory: fixture.runDirectory,
      artifactDirectory: fixture.artifactDirectory,
      agentAdapter: agents,
      validationAdapter: validation,
    })
    const interrupted = await first.run({ interruptAfter: 'RECHECKING' })
    assert.equal(interrupted.status, 'INTERRUPTED')
    const pinned = loadRunState(fixture.runDirectory)
    assert.equal(pinned.correctionRounds, 1)
    const resumed = new Coordinator({
      packet: approvedPacket,
      workspaceRoot: fixture.workspaceRoot,
      runDirectory: fixture.runDirectory,
      artifactDirectory: fixture.artifactDirectory,
      agentAdapter: agents,
      validationAdapter: validation,
    })
    const result = await resumed.run()
    assert.equal(result.status, 'READY_FOR_HANDOFF')
    assert.equal(result.state.correctionRounds, pinned.correctionRounds)
    assert.deepEqual(result.state.agentRegistry.identities, pinned.agentRegistry.identities)
    assert.equal(result.state.candidateId, pinned.candidateId)
    assert.equal(result.state.agentCallCounts.implementer, 2)
    assert.equal(result.state.agentCallCounts.reviewer, 2)
  } finally { fixture.dispose() }
})

test('cancellation is terminal when pending validation later resolves successfully', async () => {
  const fixture = createFixture()
  const started = deferred()
  const pending = deferred()
  const approvedPacket = packet(fixture)
  const coordinator = new Coordinator({
    packet: approvedPacket,
    workspaceRoot: fixture.workspaceRoot,
    runDirectory: fixture.runDirectory,
    artifactDirectory: fixture.artifactDirectory,
    agentAdapter: new FakeAgentAdapter({ implementer: [implementation()] }),
    validationAdapter: { async run(definition, { candidateId }) {
      started.resolve()
      await pending.promise
      return { ...definition, result: 'pass', candidateId, details: 'Late synthetic pass.' }
    } },
  })
  try {
    const running = coordinator.run()
    await started.promise
    const cancelled = coordinator.cancel('Synthetic cancellation while validation was pending.')
    assert.equal(cancelled.status, 'CANCELLED')
    pending.resolve()
    const settled = await running
    assert.equal(settled.status, 'CANCELLED')
    assert.equal(settled.artifacts.release_readiness.readiness, 'cancelled')
    assert.equal(settled.artifacts.release_readiness.result, 'blocked')

    const resumed = new Coordinator({
      packet: approvedPacket, workspaceRoot: fixture.workspaceRoot, runDirectory: fixture.runDirectory,
      artifactDirectory: fixture.artifactDirectory, agentAdapter: new FakeAgentAdapter({}), validationAdapter: new FakeValidationAdapter({}),
    })
    assert.equal((await resumed.run()).status, 'CANCELLED')
  } finally { fixture.dispose() }
})

test('workspace drift on resume blocks instead of accepting stale state', async () => {
  const fixture = createFixture()
  try {
    const first = await runScenario({ fixture, runOptions: { interruptAfter: 'AWAITING_PRODUCT_QA' } })
    assert.equal(first.result.status, 'INTERRUPTED')
    writeFileSync(resolve(fixture.workspaceRoot, 'allowed.txt'), 'external drift\n')
    const resumed = new Coordinator({
      packet: packet(fixture), workspaceRoot: fixture.workspaceRoot, runDirectory: fixture.runDirectory,
      artifactDirectory: fixture.artifactDirectory, agentAdapter: new FakeAgentAdapter({}),
      validationAdapter: new FakeValidationAdapter({}),
    })
    const result = await resumed.run()
    assert.equal(result.status, 'BLOCKED')
    assert.equal(result.state.blockers.at(-1).code, 'WORKSPACE_DRIFT')
  } finally { fixture.dispose() }
})

test('workspace changes during review and staged candidates block handoff', async () => {
  const reviewFixture = createFixture()
  const reviewStarted = deferred()
  const releaseReview = deferred()
  try {
    const runningScenario = runScenario({
      fixture: reviewFixture,
      packetOverrides: { requireIndependentReview: true },
      agents: {
        implementer: [implementation('review-candidate\n')],
        reviewer: [async ({ candidateId }) => {
          reviewStarted.resolve()
          await releaseReview.promise
          return { kind: 'review', result: 'pass', candidateId, evidence: ['late-review'], findings: [] }
        }],
      },
    })
    await reviewStarted.promise
    writeFileSync(resolve(reviewFixture.workspaceRoot, 'allowed.txt'), 'changed-during-review\n')
    releaseReview.resolve()
    const { result } = await runningScenario
    assert.equal(result.status, 'BLOCKED')
    assert.equal(result.state.blockers.at(-1).code, 'WORKSPACE_DRIFT')
  } finally { reviewFixture.dispose() }

  const stagedFixture = createFixture()
  try {
    const { result } = await runScenario({
      fixture: stagedFixture,
      validation: { focused: ({ candidateId }) => {
        git(stagedFixture.workspaceRoot, ['add', '--', 'allowed.txt'])
        return { result: 'pass', candidateId, details: 'Hostile adapter staged the candidate.' }
      } },
    })
    assert.equal(result.status, 'BLOCKED')
    assert.equal(result.state.blockers.at(-1).code, 'WORKSPACE_DRIFT')
    assert.equal(git(stagedFixture.workspaceRoot, ['diff', '--cached', '--name-only']), 'allowed.txt')
  } finally { stagedFixture.dispose() }
})

test('READY resume revalidates changed workspace, artifacts, unexpected files, and base identity', async () => {
  const ready = await runScenario()
  try {
    assert.equal(ready.result.status, 'READY_FOR_HANDOFF')
    writeFileSync(resolve(ready.fixture.workspaceRoot, 'allowed.txt'), 'post-ready-drift\n')
    const resumed = new Coordinator({
      packet: packet(ready.fixture), workspaceRoot: ready.fixture.workspaceRoot, runDirectory: ready.fixture.runDirectory,
      artifactDirectory: ready.fixture.artifactDirectory, agentAdapter: new FakeAgentAdapter({}), validationAdapter: new FakeValidationAdapter({}),
    })
    const result = await resumed.run()
    assert.equal(result.status, 'BLOCKED')
    assert.equal(result.state.blockers.at(-1).code, 'INTEGRITY_FAILURE')
  } finally { ready.fixture.dispose() }

  const unexpected = createFixture()
  try {
    const first = await runScenario({ fixture: unexpected, runOptions: { interruptAfter: 'AWAITING_PRODUCT_QA' } })
    assert.equal(first.result.status, 'INTERRUPTED')
    writeFileSync(resolve(unexpected.workspaceRoot, 'unexpected.txt'), 'unexpected\n')
    const resumed = new Coordinator({
      packet: packet(unexpected), workspaceRoot: unexpected.workspaceRoot, runDirectory: unexpected.runDirectory,
      artifactDirectory: unexpected.artifactDirectory, agentAdapter: new FakeAgentAdapter({}), validationAdapter: new FakeValidationAdapter({}),
    })
    const result = await resumed.run()
    assert.equal(result.status, 'BLOCKED')
    assert.equal(result.state.blockers.at(-1).code, 'WORKSPACE_DRIFT')
  } finally { unexpected.dispose() }

  const mismatch = createFixture()
  try {
    const scenario = await runScenario({ fixture: mismatch, packetOverrides: { baseCommit: '0'.repeat(40) } })
    assert.equal(scenario.result.status, 'BLOCKED')
    assert.match(scenario.result.state.blockers.at(-1).message, /base commit/i)
  } finally { mismatch.dispose() }
})

test('hostile persisted state invariants are rejected before resume', async () => {
  const fixture = createFixture()
  const approvedPacket = packet(fixture, { requireIndependentReview: true })
  try {
    const coordinator = new Coordinator({
      packet: approvedPacket, workspaceRoot: fixture.workspaceRoot, runDirectory: fixture.runDirectory,
      artifactDirectory: fixture.artifactDirectory,
      agentAdapter: new FakeAgentAdapter({ implementer: [implementation()], reviewer: [review('fail')] }),
      validationAdapter: new FakeValidationAdapter({ focused: { result: 'pass', details: 'pass' } }),
    })
    assert.equal((await coordinator.run({ interruptAfter: 'CORRECTING' })).status, 'INTERRUPTED')
    tamperState(fixture, state => {
      state.packetHash = 'f'.repeat(64)
      state.baseCommit = '0'.repeat(40)
      state.requiredRoles = ['architect']
      state.agentRegistry.identities.reviewer = state.agentRegistry.identities.implementer
      state.agentRegistry.identities.extra1 = 'agent-extra-1'
      state.agentRegistry.identities.extra2 = 'agent-extra-2'
      state.agentRegistry.active = ['agent-extra-1', 'agent-extra-2', 'unknown-agent']
      state.agentCallCounts.implementer = -1
      state.agentInvocationCounts.implementer = -1
      state.correctionRounds = 3
      state.evidenceRefs.push({ id: 'stale', type: 'review', candidateId: 'a'.repeat(64), result: 'pass' })
      state.productQaEvidence = { producerType: 'agent' }
    })
    const resumed = new Coordinator({
      packet: approvedPacket, workspaceRoot: fixture.workspaceRoot, runDirectory: fixture.runDirectory,
      artifactDirectory: fixture.artifactDirectory, agentAdapter: new FakeAgentAdapter({}), validationAdapter: new FakeValidationAdapter({}),
    })
    const result = await resumed.run()
    assert.equal(result.status, 'BLOCKED')
    const message = result.state.blockers.at(-1).message
    for (const expected of ['packet hash', 'base commit', 'required roles', 'identities', 'concurrency', 'agent-call count', 'adapter-request count', 'correction-round', 'evidence', 'product QA']) {
      assert.match(message, new RegExp(expected, 'i'))
    }
  } finally { fixture.dispose() }
})

test('readiness semantics reject missing checks, stale evidence, invalid counters, wrong producers, and missing required roles or QA', async () => {
  const ready = await runScenario()
  try {
    assert.equal(ready.result.status, 'READY_FOR_HANDOFF')
    const cases = [
      ['missing required check', state => { state.reports.tests.checks = []; state.reports.tests.result = 'pass' }, /required validation check focused is missing/i],
      ['empty implementation evidence', state => { state.evidenceRefs = state.evidenceRefs.filter(reference => reference.type !== 'implementation') }, /implementation evidence is missing/i],
      ['negative counter', state => { state.agentCallCounts.implementer = -1 }, /logical call counter is invalid/i],
      ['wrong producer', state => { state.reports.implementation.producer = 'agent-wrong-implementer' }, /implementation report.*inconsistent/i],
      ['wrong candidate', state => { state.reports.implementation.candidateId = 'f'.repeat(64) }, /implementation report.*inconsistent/i],
      ['missing architect report', state => {
        state.requiredRoles = ['architect', 'implementer']
        state.agentRegistry.identities.architect = 'agent-2-architect'
        state.agentCallCounts.architect = 1
        state.agentInvocationCounts.architect = 1
      }, /architecture report.*inconsistent/i],
      ['missing human QA', state => { state.packet.productQa = { required: true }; state.productQaEvidence = null }, /human product QA is missing/i],
    ]
    for (const [name, mutate, expected] of cases) {
      const state = structuredClone(ready.result.state)
      mutate(state)
      assert.match(validateReadinessState(state).join(' '), expected, name)
    }

    const extraCheck = structuredClone(ready.result.state)
    extraCheck.reports.tests.checks.push({
      id: 'unapproved', family: 'validate:focused', required: true, result: 'pass',
      candidateId: extraCheck.candidateId, details: 'Unapproved extra pass.',
    })
    assert.match(validateReadinessState(extraCheck).join(' '), /not the approved task-plan check/i)
  } finally { ready.fixture.dispose() }
})

test('authoritative artifact semantics reject missing, unknown, and contradictory READY evidence', async () => {
  const scenario = await runScenario({
    packetOverrides: { requireIndependentReview: true },
    agents: { implementer: [implementation()], reviewer: [review('pass')] },
  })
  try {
    assert.equal(scenario.result.status, 'READY_FOR_HANDOFF')
    const cases = [
      ['all evidence removed', artifacts => { for (const artifact of Object.values(artifacts)) artifact.evidenceRefs = [] }, /evidence references do not match authoritative state/i],
      ['release result failed', artifacts => { artifacts.release_readiness.result = 'fail' }, /result\/status\/flags contradict/i],
      ['failed review marked ready', artifacts => { artifacts.review_report.result = 'fail' }, /review_report: verdict contradicts/i],
      ['implementation failed marked ready', artifacts => { artifacts.implementation_report.result = 'fail' }, /implementation_report: result contradicts/i],
      ['tests not run marked ready', artifacts => { artifacts.test_report.result = 'not_run' }, /test_report: result contradicts/i],
      ['required check omitted', artifacts => { artifacts.test_report.checks = [] }, /test_report: checks contradict/i],
      ['unknown evidence reference', artifacts => {
        for (const artifact of Object.values(artifacts)) artifact.evidenceRefs.push({ id: 'unknown:evidence', type: 'implementation', candidateId: scenario.result.state.candidateId, result: 'pass' })
      }, /evidence references do not match authoritative state/i],
      ['wrong producer evidence reference', artifacts => {
        for (const artifact of Object.values(artifacts)) {
          const reference = artifact.evidenceRefs.find(entry => entry.type === 'implementation')
          reference.id = reference.id.replace(scenario.result.state.agentRegistry.identities.implementer, scenario.result.state.agentRegistry.identities.reviewer)
        }
      }, /evidence references do not match authoritative state/i],
      ['wrong producer identity', artifacts => { artifacts.implementation_report.producer.identity = 'agent-wrong-implementer' }, /implementation_report: producer contradicts/i],
      ['wrong producer role', artifacts => { artifacts.implementation_report.producer.role = 'reviewer' }, /implementation_report: producer contradicts/i],
      ['mismatched candidate', artifacts => { artifacts.implementation_report.candidateId = 'f'.repeat(64) }, /implementation_report: candidateId does not match|candidate contradicts/i],
      ['contradictory release readiness', artifacts => { artifacts.release_readiness.validationSatisfied = false }, /result\/status\/flags contradict/i],
      ['contradictory required roles', artifacts => { artifacts.task_plan.requiredRoles = ['implementer'] }, /required roles contradict/i],
      ['mismatched task', artifacts => { artifacts.task_plan.taskId = 'OTHER-TASK' }, /taskId does not match authoritative state/i],
      ['mismatched run', artifacts => { artifacts.review_report.runId = 'other-run' }, /runId does not match authoritative state/i],
      ['mismatched packet', artifacts => { artifacts.test_report.packetHash = 'f'.repeat(64) }, /packetHash does not match authoritative state/i],
      ['mismatched base', artifacts => { artifacts.release_readiness.baseCommit = 'other-base' }, /baseCommit does not match authoritative state/i],
    ]
    for (const [name, mutate, expected] of cases) {
      const artifacts = structuredClone(scenario.result.artifacts)
      mutate(artifacts)
      assert.match(validateArtifactSet(artifacts, scenario.result.state).join(' '), expected, name)
    }

    const negativeState = structuredClone(scenario.result.state)
    negativeState.agentCallCounts.implementer = -1
    assert.match(validateArtifactSet(structuredClone(scenario.result.artifacts), negativeState).join(' '), /logical call counter is invalid/i)
  } finally { scenario.fixture.dispose() }

  const blocked = await runScenario({ packetOverrides: { requestedReleaseActions: ['stage'] } })
  try {
    const contradictory = structuredClone(blocked.result.artifacts)
    Object.assign(contradictory.release_readiness, {
      result: 'pass', readiness: 'ready_for_handoff', acceptedScopeSatisfied: true,
      reviewSatisfied: true, validationSatisfied: true, artifactsConsistent: true, candidateUnstaged: true,
    })
    assert.match(validateArtifactSet(contradictory, blocked.result.state).join(' '), /result\/status\/flags contradict/i)
  } finally { blocked.fixture.dispose() }
})

test('schema-only validation is explicit and semantic validation requires authoritative state', async () => {
  const scenario = await runScenario()
  try {
    const artifacts = structuredClone(scenario.result.artifacts)
    assert.deepEqual(validateArtifactSetSchema(artifacts), [])
    assert.match(validateArtifactSet(artifacts).join(' '), /authoritative state is required/i)
    for (const errors of Object.values(validateArtifactDirectorySchema(scenario.fixture.artifactDirectory))) assert.deepEqual(errors, [])
    assert.match(validateArtifactDirectory(scenario.fixture.artifactDirectory).semantic.join(' '), /authoritative state is required/i)
    artifacts.implementation_report.changedPaths = ['other.txt']
    assert.deepEqual(validateArtifactSetSchema(artifacts), [])
    assert.match(validateArtifactSet(artifacts, scenario.result.state).join(' '), /changedPaths contradict/i)
  } finally { scenario.fixture.dispose() }
})

test('hostile R6 artifacts and accounting cannot contradict authoritative correction state', async () => {
  const scenario = await runScenario({
    packetOverrides: { requireIndependentReview: true },
    agents: { implementer: [implementation('initial\n'), implementation('corrected\n')], reviewer: [review('fail'), review('pass')] },
  })
  try {
    assert.equal(scenario.result.status, 'READY_FOR_HANDOFF')
    const artifactCases = [
      ['implementation correctionRound', artifacts => { artifacts.implementation_report.correctionRound = 0 }, /implementation_report: correctionRound contradicts/i],
      ['review correctionRound', artifacts => { artifacts.review_report.correctionRound = 0 }, /review_report: correctionRound contradicts/i],
      ['changedPaths', artifacts => { artifacts.implementation_report.changedPaths = ['other.txt'] }, /changedPaths contradict/i],
      ['operations', artifacts => { artifacts.implementation_report.operations[0].path = 'other.txt' }, /operations contradict/i],
      ['review findings', artifacts => { artifacts.review_report.findings = ['Invented finding.'] }, /findings contradict/i],
    ]
    for (const [name, mutate, expected] of artifactCases) {
      const artifacts = structuredClone(scenario.result.artifacts)
      mutate(artifacts)
      assert.deepEqual(validateArtifactSetSchema(artifacts), [], name)
      assert.match(validateArtifactSet(artifacts, scenario.result.state).join(' '), expected, name)
    }
    const stateCases = [
      ['missing correction attempt', state => { state.correctionAttempt = null }, /correction attempt physical\/logical accounting/i],
      ['wrong attempt physical count', state => { state.correctionAttempt.adapterRequests = 0 }, /correction attempt physical\/logical accounting/i],
      ['wrong attempt ordinal', state => { state.correctionAttempt.ordinal = 2 }, /correction attempt physical\/logical accounting/i],
      ['missing registered logical count', state => { delete state.agentCallCounts.reviewer }, /registered reviewer identity lacks valid logical-call accounting/i],
      ['missing registered physical count', state => { delete state.agentInvocationCounts.reviewer }, /registered reviewer identity lacks valid physical-request accounting/i],
      ['extra physical request', state => { state.agentInvocationCounts.implementer += 1 }, /adapter-request count does not match logical calls/i],
    ]
    for (const [name, mutate, expected] of stateCases) {
      const state = structuredClone(scenario.result.state)
      mutate(state)
      assert.match(validateArtifactSet(scenario.result.artifacts, state).join(' '), expected, name)
    }
  } finally { scenario.fixture.dispose() }
})

test('authoritative artifacts cannot omit required architecture or human-QA evidence', async () => {
  const high = await runScenario({
    packetOverrides: { risk: 'high', riskAreas: ['privacy'] },
    agents: { architect: [architecture()], implementer: [implementation()], reviewer: [review('pass')] },
  })
  try {
    assert.equal(high.result.status, 'READY_FOR_HANDOFF')
    const artifacts = structuredClone(high.result.artifacts)
    for (const artifact of Object.values(artifacts)) artifact.evidenceRefs = artifact.evidenceRefs.filter(reference => reference.type !== 'architecture')
    assert.match(validateArtifactSet(artifacts, high.result.state).join(' '), /evidence references do not match authoritative state/i)
  } finally { high.fixture.dispose() }
})

test('resume rejects supplied packet mismatch, candidate mismatch, incomplete readiness, and inconsistent artifacts', async () => {
  const candidate = createFixture()
  try {
    const first = await runScenario({ fixture: candidate, runOptions: { interruptAfter: 'AWAITING_PRODUCT_QA' } })
    assert.equal(first.result.status, 'INTERRUPTED')
    tamperState(candidate, state => { state.candidateId = 'b'.repeat(64) })
    const resumed = new Coordinator({
      packet: packet(candidate), workspaceRoot: candidate.workspaceRoot, runDirectory: candidate.runDirectory,
      artifactDirectory: candidate.artifactDirectory, agentAdapter: new FakeAgentAdapter({}), validationAdapter: new FakeValidationAdapter({}),
    })
    assert.equal((await resumed.run()).status, 'BLOCKED')
  } finally { candidate.dispose() }

  const packetMismatch = createFixture()
  try {
    const first = await runScenario({ fixture: packetMismatch, runOptions: { interruptAfter: 'AWAITING_PRODUCT_QA' } })
    assert.equal(first.result.status, 'INTERRUPTED')
    const resumed = new Coordinator({
      packet: { ...packet(packetMismatch), taskId: 'OTHER-TASK' }, workspaceRoot: packetMismatch.workspaceRoot,
      runDirectory: packetMismatch.runDirectory, artifactDirectory: packetMismatch.artifactDirectory,
      agentAdapter: new FakeAgentAdapter({}), validationAdapter: new FakeValidationAdapter({}),
    })
    const result = await resumed.run()
    assert.equal(result.status, 'BLOCKED')
    assert.match(result.state.blockers.at(-1).message, /supplied resume packet/i)
  } finally { packetMismatch.dispose() }

  const incomplete = await runScenario()
  try {
    tamperState(incomplete.fixture, state => { state.reports.tests.result = 'not_run' })
    const resumed = new Coordinator({
      packet: packet(incomplete.fixture), workspaceRoot: incomplete.fixture.workspaceRoot, runDirectory: incomplete.fixture.runDirectory,
      artifactDirectory: incomplete.fixture.artifactDirectory, agentAdapter: new FakeAgentAdapter({}), validationAdapter: new FakeValidationAdapter({}),
    })
    assert.equal((await resumed.run()).status, 'BLOCKED')
  } finally { incomplete.fixture.dispose() }

  const artifacts = await runScenario()
  try {
    const path = resolve(artifacts.fixture.artifactDirectory, ARTIFACT_FILES.task_plan)
    const taskPlan = JSON.parse(readFileSync(path, 'utf8'))
    taskPlan.runId = 'schema-valid-but-wrong-run'
    writeFileSync(path, `${JSON.stringify(taskPlan, null, 2)}\n`)
    const resumed = new Coordinator({
      packet: packet(artifacts.fixture), workspaceRoot: artifacts.fixture.workspaceRoot, runDirectory: artifacts.fixture.runDirectory,
      artifactDirectory: artifacts.fixture.artifactDirectory, agentAdapter: new FakeAgentAdapter({}), validationAdapter: new FakeValidationAdapter({}),
    })
    const result = await resumed.run()
    assert.equal(result.status, 'BLOCKED')
    assert.match(result.state.blockers.at(-1).message, /artifact|runId/i)
  } finally { artifacts.fixture.dispose() }

  const emptyEvidence = await runScenario()
  try {
    for (const file of Object.values(ARTIFACT_FILES)) {
      const path = resolve(emptyEvidence.fixture.artifactDirectory, file)
      const artifact = JSON.parse(readFileSync(path, 'utf8'))
      artifact.evidenceRefs = []
      writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`)
    }
    const resumed = new Coordinator({
      packet: packet(emptyEvidence.fixture), workspaceRoot: emptyEvidence.fixture.workspaceRoot,
      runDirectory: emptyEvidence.fixture.runDirectory, artifactDirectory: emptyEvidence.fixture.artifactDirectory,
      agentAdapter: new FakeAgentAdapter({}), validationAdapter: new FakeValidationAdapter({}),
    })
    const result = await resumed.run()
    assert.equal(result.status, 'BLOCKED')
    assert.equal(result.state.blockers.at(-1).code, 'INTEGRITY_FAILURE')
    assert.match(result.state.blockers.at(-1).message, /evidence references do not match authoritative state/i)
  } finally { emptyEvidence.fixture.dispose() }
})

test('missing or malformed agent evidence and runtime timeout never pass', async () => {
  const cases = [
    { response: { ...implementation(), evidence: [] }, code: 'MISSING_EVIDENCE' },
    { response: { malformed: true }, code: 'RUNTIME_FAILURE' },
    { response: { failure: 'timeout' }, code: 'RUNTIME_FAILURE' },
    { response: implementation('changed\n', { evidence: [{ id: 'not-a-string' }] }), code: 'RUNTIME_FAILURE' },
    { response: implementation('changed\n', { criteria: [{ id: 'criterion', result: 'pass', evidenceRefs: [42] }] }), code: 'RUNTIME_FAILURE' },
  ]
  for (const entry of cases) {
    const scenario = await runScenario({ agents: { implementer: [entry.response] } })
    try {
      assert.equal(scenario.result.status, 'BLOCKED')
      assert.equal(scenario.result.state.blockers.at(-1).code, entry.code)
    } finally { scenario.fixture.dispose() }
  }
})

test('malformed nested review findings block without storing authoritative review evidence', async () => {
  const scenario = await runScenario({
    packetOverrides: { requireIndependentReview: true },
    agents: { implementer: [implementation()], reviewer: [review('pass', { findings: [42] })] },
  })
  try {
    assert.equal(scenario.result.status, 'BLOCKED')
    assert.equal(scenario.result.state.blockers.at(-1).code, 'RUNTIME_FAILURE')
    assert.equal(scenario.result.state.evidenceRefs.some(reference => reference.type === 'review'), false)
  } finally { scenario.fixture.dispose() }
})

test('artifact validation or write failure persists BLOCKED and never READY', async () => {
  let readyWriteAttempted = false
  const scenario = await runScenario({
    coordinatorOptions: {
      artifactWriter(directory, artifacts, state) {
        if (state.phase === 'READY_FOR_HANDOFF') {
          readyWriteAttempted = true
          throw new Error('Synthetic durable artifact failure.')
        }
        return writeArtifacts(directory, artifacts, state)
      },
    },
  })
  try {
    assert.equal(readyWriteAttempted, true)
    assert.equal(scenario.result.status, 'BLOCKED')
    assert.equal(loadRunState(scenario.fixture.runDirectory).phase, 'BLOCKED')
    assert.equal(scenario.result.state.readinessVerified, false)
    assert.equal(scenario.result.state.blockers.at(-1).code, 'INTEGRITY_FAILURE')
    for (const errors of Object.values(validateArtifactDirectory(scenario.fixture.artifactDirectory, scenario.result.state))) assert.deepEqual(errors, [])
  } finally { scenario.fixture.dispose() }

  const tampered = await runScenario({
    coordinatorOptions: {
      artifactWriter(directory, artifacts, state) {
        if (state.phase !== 'READY_FOR_HANDOFF') return writeArtifacts(directory, artifacts, state)
        const files = []
        for (const [type, artifact] of Object.entries(structuredClone(artifacts))) {
          artifact.evidenceRefs = []
          const path = resolve(directory, ARTIFACT_FILES[type])
          writeFileSync(path, `${JSON.stringify(artifact, null, 2)}\n`)
          files.push(path)
        }
        return files
      },
    },
  })
  try {
    assert.equal(tampered.result.status, 'BLOCKED')
    assert.equal(tampered.result.state.blockers.at(-1).code, 'INTEGRITY_FAILURE')
    assert.match(tampered.result.state.blockers.at(-1).message, /persisted authoritative semantic validation failed/i)
    for (const errors of Object.values(validateArtifactDirectory(tampered.fixture.artifactDirectory, tampered.result.state))) assert.deepEqual(errors, [])
  } finally { tampered.fixture.dispose() }
})

test('stale reviewer evidence blocks readiness', async () => {
  const scenario = await runScenario({
    packetOverrides: { requireIndependentReview: true },
    agents: { implementer: [implementation()], reviewer: [review('pass', { candidateId: '0'.repeat(64) })] },
  })
  try {
    assert.equal(scenario.result.status, 'BLOCKED')
    assert.equal(scenario.result.state.blockers.at(-1).code, 'INTEGRITY_FAILURE')
  } finally { scenario.fixture.dispose() }
})

test('failed, timed-out, cancelled, skipped, and absent required checks never pass', async () => {
  for (const outcome of ['fail', 'timeout', 'cancelled', 'skipped', undefined]) {
    const validation = outcome === undefined ? {} : { focused: { result: outcome, details: `Synthetic ${outcome}.` } }
    const scenario = await runScenario({ validation })
    try {
      assert.equal(scenario.result.status, 'BLOCKED', outcome)
      assert.equal(scenario.result.state.blockers.at(-1).code, outcome === 'fail' ? 'VALIDATION_FAILED' : 'MISSING_EVIDENCE')
    } finally { scenario.fixture.dispose() }
  }
})

test('validation evidence for another candidate is rejected as stale', async () => {
  const scenario = await runScenario({ validation: { focused: { result: 'pass', candidateId: 'f'.repeat(64), details: 'Wrong candidate.' } } })
  try {
    assert.equal(scenario.result.status, 'BLOCKED')
    assert.equal(scenario.result.state.blockers.at(-1).code, 'INTEGRITY_FAILURE')
  } finally { scenario.fixture.dispose() }
})

test('human QA cannot be satisfied by an agent assertion', async () => {
  const scenario = await runScenario({
    packetOverrides: { productQa: { required: true }, requireIndependentReview: false },
    agents: { implementer: [implementation('qa-needed\n', { productQa: { result: 'pass', producerType: 'agent' } })] },
  })
  try {
    assert.equal(scenario.result.status, 'BLOCKED')
    assert.equal(scenario.result.state.blockers.at(-1).code, 'PRODUCT_DECISION_REQUIRED')
  } finally { scenario.fixture.dispose() }
})

test('human QA is candidate-bound and candidate-changing correction invalidates prior QA', async () => {
  const wrong = createFixture()
  try {
    const approvedPacket = packet(wrong, { productQa: { required: true } })
    const coordinator = new Coordinator({
      packet: approvedPacket, workspaceRoot: wrong.workspaceRoot, runDirectory: wrong.runDirectory,
      artifactDirectory: wrong.artifactDirectory, agentAdapter: new FakeAgentAdapter({ implementer: [implementation()] }),
      validationAdapter: new FakeValidationAdapter({ focused: { result: 'pass', details: 'pass' } }),
    })
    const waiting = await coordinator.run({ interruptAfter: 'AWAITING_PRODUCT_QA' })
    assert.equal(waiting.status, 'INTERRUPTED')
    const rejected = coordinator.submitProductQa(humanQa(waiting.state, { candidateId: 'f'.repeat(64) }))
    assert.equal(rejected.status, 'BLOCKED')
    assert.match(rejected.state.blockers.at(-1).message, /another candidate/i)
  } finally { wrong.dispose() }

  const fixture = createFixture()
  const approvedPacket = packet(fixture, { productQa: { required: true }, requireIndependentReview: true })
  const agentAdapter = new FakeAgentAdapter({
    implementer: [implementation('first-qa-candidate\n'), implementation('corrected-qa-candidate\n')],
    reviewer: [review('fail'), review('pass')],
  })
  const validationAdapter = new FakeValidationAdapter({ focused: { result: 'pass', details: 'pass' } })
  try {
    const coordinator = new Coordinator({
      packet: approvedPacket, workspaceRoot: fixture.workspaceRoot, runDirectory: fixture.runDirectory,
      artifactDirectory: fixture.artifactDirectory, agentAdapter, validationAdapter,
    })
    const firstWaiting = await coordinator.run({ interruptAfter: 'AWAITING_PRODUCT_QA' })
    const firstCandidate = firstWaiting.state.candidateId
    coordinator.submitProductQa(humanQa(firstWaiting.state))
    const correctedWaiting = await coordinator.run({ interruptAfter: 'AWAITING_PRODUCT_QA' })
    assert.equal(correctedWaiting.status, 'INTERRUPTED')
    assert.notEqual(correctedWaiting.state.candidateId, firstCandidate)
    assert.equal(correctedWaiting.state.productQaEvidence, null)
    assert.equal(correctedWaiting.state.evidenceRefs.some(reference => reference.type === 'product_qa'), false)
    coordinator.submitProductQa(humanQa(correctedWaiting.state))
    const result = await coordinator.run()
    assert.equal(result.status, 'READY_FOR_HANDOFF')
    assert.equal(result.state.productQaEvidence.candidateId, result.state.candidateId)
    assert.equal(result.artifacts.task_plan.productQa.candidateId, result.state.candidateId)
    const contradictoryQa = structuredClone(result.artifacts)
    contradictoryQa.task_plan.productQa.result = 'not_run'
    assert.match(validateArtifactSet(contradictoryQa, result.state).join(' '), /product QA is not bound to the ready candidate/i)
    const missingQaEvidence = structuredClone(result.artifacts)
    for (const artifact of Object.values(missingQaEvidence)) artifact.evidenceRefs = artifact.evidenceRefs.filter(reference => reference.type !== 'product_qa')
    assert.match(validateArtifactSet(missingQaEvidence, result.state).join(' '), /evidence references do not match authoritative state/i)
  } finally { fixture.dispose() }
})

test('release requests are blocked and normal artifacts mark every release action outside_v1', async () => {
  const blocked = await runScenario({ packetOverrides: { requestedReleaseActions: ['stage'] } })
  try {
    assert.equal(blocked.result.status, 'BLOCKED')
    assert.equal(blocked.result.state.blockers.at(-1).code, 'RELEASE_AUTHORIZATION_ABSENT')
  } finally { blocked.fixture.dispose() }

  const ready = await runScenario()
  try {
    assert.equal(ready.result.status, 'READY_FOR_HANDOFF')
    assert.deepEqual(ready.result.artifacts.release_readiness.releaseActions, {
      stage: 'outside_v1', commit: 'outside_v1', push: 'outside_v1', deploy: 'outside_v1', supabase: 'outside_v1',
    })
    assert.equal(git(ready.fixture.workspaceRoot, ['diff', '--cached', '--name-only']), '')
  } finally { ready.fixture.dispose() }
})

test('every blocked run still writes all five schema-valid artifacts', async () => {
  const scenario = await runScenario({ agents: { implementer: [{ malformed: true }] } })
  try {
    assert.equal(scenario.result.status, 'BLOCKED')
    assert.deepEqual(Object.keys(ARTIFACT_FILES).sort(), Object.keys(scenario.result.artifacts).sort())
    for (const errors of Object.values(validateArtifactDirectorySchema(scenario.fixture.artifactDirectory))) assert.deepEqual(errors, [])
  } finally { scenario.fixture.dispose() }
})

test('safe trial reaches an unstaged, schema-valid, no-remote handoff', async () => {
  const trial = await runSafeTrial()
  try {
    assert.equal(trial.status, 'READY_FOR_HANDOFF')
    assert.deepEqual(trial.changedPaths, ['README.md'])
    assert.deepEqual(trial.stagedPaths, [])
    assert.deepEqual(trial.remotes, [])
    assert.deepEqual(trial.state.requiredRoles, ['implementer', 'reviewer'])
    assert.equal(trial.artifacts.release_readiness.candidateUnstaged, true)
    for (const errors of Object.values(validateArtifactDirectory(trial.artifactDirectory, trial.state))) assert.deepEqual(errors, [])
  } finally { trial.dispose() }
})

test('safe trial preserves the canonical index and named unrelated work', async () => {
  const projectRoot = process.cwd()
  const paths = ['components/app/BottomTabBar.tsx', 'docs/mac-handoff-checklist.md', 'supabase/.temp']
  const beforeIndex = git(projectRoot, ['diff', '--cached', '--name-only'])
  const beforeStatus = git(projectRoot, ['status', '--porcelain=v1', '--', ...paths])
  const beforePaths = snapshotPaths(projectRoot, paths)
  const trial = await runSafeTrial({ canonicalRoot: projectRoot, preservedPaths: paths })
  try {
    assert.equal(trial.status, 'READY_FOR_HANDOFF')
  } finally { trial.dispose() }
  assert.equal(git(projectRoot, ['diff', '--cached', '--name-only']), beforeIndex)
  assert.equal(git(projectRoot, ['status', '--porcelain=v1', '--', ...paths]), beforeStatus)
  assert.deepEqual(snapshotPaths(projectRoot, paths), beforePaths)
})

test('safe trial cleanup is exception-safe unless explicit keep mode is requested', async () => {
  const parent = mkdtempSync(resolve(tmpdir(), 'mpp-aos-cleanup-test-'))
  try {
    await assert.rejects(() => runSafeTrial({ parentDirectory: parent, canonicalRoot: resolve(parent, 'missing-repository') }))
    assert.deepEqual(readdirSync(parent), [])
  } finally { rmSync(parent, { recursive: true, force: true, maxRetries: 10, retryDelay: 25 }) }
})
