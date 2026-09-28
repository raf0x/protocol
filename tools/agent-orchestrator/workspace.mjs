import { spawnSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'

import { assertAllowedPath } from './policy.mjs'

export const COORDINATOR_TEMP_DIRECTORY = '.aos-coordinator-tmp'
export const COORDINATOR_TEMP_PREFIX = `${COORDINATOR_TEMP_DIRECTORY}-`

export class WorkspacePolicyError extends Error {
  constructor(message, code = 'UNAUTHORIZED_PATH') {
    super(message)
    this.name = 'WorkspacePolicyError'
    this.code = code
  }
}

export class WorkspaceTransactionError extends WorkspacePolicyError {
  constructor(message, recovery, cause) {
    super(message, 'INTEGRITY_FAILURE')
    this.name = 'WorkspaceTransactionError'
    this.recovery = recovery
    this.cause = cause
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

export function hashPacket(packet) {
  return sha256(canonicalJson(packet))
}

function isInsideOrEqual(root, target) {
  const rel = relative(root, target)
  return rel === '' || (rel !== '..' && !rel.startsWith(`..${sep}`))
}

function toNativePath(root, normalizedPath) {
  return resolve(root, ...normalizedPath.split('/'))
}

function assertNoLinkEscape(root, normalizedPath, { allowMissingLeaf = true } = {}) {
  const rootReal = realpathSync(root)
  const segments = normalizedPath.split('/')
  let cursor = rootReal
  segments.forEach((segment, index) => {
    cursor = resolve(cursor, segment)
    if (!existsSync(cursor)) {
      if (!allowMissingLeaf || index < segments.length - 1) {
        throw new WorkspacePolicyError(`Path component does not exist: ${normalizedPath}`)
      }
      return
    }
    const stat = lstatSync(cursor)
    if (stat.isSymbolicLink()) throw new WorkspacePolicyError(`Symbolic-link or reparse path is not writable: ${normalizedPath}`)
    const actual = realpathSync(cursor)
    if (!isInsideOrEqual(rootReal, actual)) throw new WorkspacePolicyError(`Path escapes the workspace: ${normalizedPath}`)
  })
}

function assertExistingRegularFile(workspaceRoot, path, label) {
  const target = toNativePath(workspaceRoot, path)
  if (!existsSync(target)) throw new WorkspacePolicyError(`${label} does not exist: ${path}`)
  const stat = lstatSync(target)
  if (stat.isSymbolicLink() || !stat.isFile()) throw new WorkspacePolicyError(`${label} must be a regular file: ${path}`)
}

function policyAllowsDelete(packet, path) {
  return (packet.mutationPolicy?.deletePaths ?? []).includes(path)
}

function policyAllowsRename(packet, path, destination) {
  return (packet.mutationPolicy?.renames ?? []).some(rule => rule.from === path && rule.to === destination)
}

function approvedPath(path, allowedPaths) {
  try { return assertAllowedPath(path, allowedPaths) } catch (error) { throw new WorkspacePolicyError(error.message) }
}

function proposedBytes(operation) {
  if (typeof operation.content === 'string' && operation.bytesBase64 === undefined) return Buffer.from(operation.content, 'utf8')
  if (typeof operation.bytesBase64 === 'string' && operation.content === undefined) {
    const bytes = Buffer.from(operation.bytesBase64, 'base64')
    if (bytes.toString('base64').replace(/=+$/, '') !== operation.bytesBase64.replace(/=+$/, '')) {
      throw new WorkspacePolicyError(`Invalid base64 write content: ${operation.path}`, 'INTEGRITY_FAILURE')
    }
    return bytes
  }
  throw new WorkspacePolicyError(`Write requires exactly one of content or bytesBase64: ${operation.path}`, 'INTEGRITY_FAILURE')
}

function normalizeOperation(operation, packet, workspaceRoot) {
  if (!operation || typeof operation !== 'object' || !['write', 'delete', 'rename'].includes(operation.type)) {
    throw new WorkspacePolicyError('Unsupported candidate operation.')
  }
  const path = approvedPath(operation.path, packet.allowedPaths)
  if (path === COORDINATOR_TEMP_DIRECTORY || path.startsWith(`${COORDINATOR_TEMP_DIRECTORY}/`) || path.startsWith(COORDINATOR_TEMP_PREFIX)) {
    throw new WorkspacePolicyError(`Coordinator-reserved path is not writable: ${path}`)
  }
  assertNoLinkEscape(workspaceRoot, path)
  const target = toNativePath(workspaceRoot, path)

  if (operation.type === 'write') {
    if (existsSync(target)) assertExistingRegularFile(workspaceRoot, path, 'Write target')
    const parent = dirname(target)
    if (!existsSync(parent) || !lstatSync(parent).isDirectory() || lstatSync(parent).isSymbolicLink()) {
      throw new WorkspacePolicyError(`Write parent must be an existing real directory: ${path}`)
    }
    return { type: 'write', path, bytes: proposedBytes(operation) }
  }

  if (packet.risk !== 'high') {
    throw new WorkspacePolicyError(`${operation.type} requires an approved high-risk packet amendment.`, 'RISK_MISMATCH')
  }
  assertExistingRegularFile(workspaceRoot, path, `${operation.type === 'delete' ? 'Delete' : 'Rename'} target`)

  if (operation.type === 'delete') {
    if (!policyAllowsDelete(packet, path)) throw new WorkspacePolicyError(`Delete is not authorized by the approved packet: ${path}`)
    return { type: 'delete', path }
  }

  const destination = approvedPath(operation.destination, packet.allowedPaths)
  assertNoLinkEscape(workspaceRoot, destination)
  const destinationTarget = toNativePath(workspaceRoot, destination)
  if (existsSync(destinationTarget)) throw new WorkspacePolicyError(`Rename destination must not exist: ${destination}`)
  const destinationParent = dirname(destinationTarget)
  if (!existsSync(destinationParent) || !lstatSync(destinationParent).isDirectory() || lstatSync(destinationParent).isSymbolicLink()) {
    throw new WorkspacePolicyError(`Rename parent must be an existing real directory: ${destination}`)
  }
  if (!policyAllowsRename(packet, path, destination)) {
    throw new WorkspacePolicyError(`Rename is not authorized by the approved packet: ${path} -> ${destination}`)
  }
  return { type: 'rename', path, destination }
}

function assertNoOperationConflicts(operations) {
  const paths = []
  for (const operation of operations) {
    paths.push(operation.path)
    if (operation.destination) paths.push(operation.destination)
  }
  for (let leftIndex = 0; leftIndex < paths.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < paths.length; rightIndex += 1) {
      const left = paths[leftIndex].toLowerCase()
      const right = paths[rightIndex].toLowerCase()
      if (left === right) throw new WorkspacePolicyError(`Duplicate or conflicting candidate target: ${paths[rightIndex]}`)
      if (left.startsWith(`${right}/`) || right.startsWith(`${left}/`)) {
        throw new WorkspacePolicyError(`Ancestor/descendant candidate operations conflict: ${paths[leftIndex]} and ${paths[rightIndex]}`)
      }
    }
  }
}

export function validateOperations(workspaceRoot, operations, packet) {
  if (!Array.isArray(operations) || operations.length === 0) throw new WorkspacePolicyError('At least one candidate operation is required.')
  const proposedPaths = operations.map(operation => ({
    path: approvedPath(operation?.path, packet.allowedPaths),
    ...(operation?.type === 'rename' ? { destination: approvedPath(operation.destination, packet.allowedPaths) } : {}),
  }))
  assertNoOperationConflicts(proposedPaths)
  const normalized = operations.map(operation => normalizeOperation(operation, packet, workspaceRoot))
  return normalized
}

function writeExclusive(path, bytes) {
  const descriptor = openSync(path, 'wx', 0o600)
  try {
    writeFileSync(descriptor, bytes)
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
}

function restoreFile(path, snapshot) {
  if (!snapshot.exists) {
    if (existsSync(path)) rmSync(path, { force: true })
    return
  }
  writeFileSync(path, snapshot.bytes)
}

function fileSnapshot(path) {
  if (!existsSync(path)) return { exists: false }
  const stat = lstatSync(path)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new WorkspacePolicyError(`Rollback target is not a regular file: ${path}`, 'INTEGRITY_FAILURE')
  return { exists: true, bytes: readFileSync(path) }
}

function verifyFileSnapshot(path, snapshot) {
  if (!snapshot.exists) return !existsSync(path) ? null : 'path should not exist'
  if (!existsSync(path)) return 'path is missing'
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || !stat.isFile()) return 'path is not a regular file'
  return readFileSync(path).equals(snapshot.bytes) ? null : 'file bytes differ'
}

function recoverTransaction(workspaceRoot, rollback, hooks) {
  const errors = []
  const restored = []
  for (const [path, snapshot] of [...rollback.entries()].reverse()) {
    const target = toNativePath(workspaceRoot, path)
    try {
      hooks.beforeRecoveryPath?.({ path, target, snapshot: structuredClone(snapshot) })
      restoreFile(target, snapshot)
      hooks.afterRecoveryPath?.({ path, target, snapshot: structuredClone(snapshot) })
      restored.push(path)
    } catch (error) {
      errors.push({ path, stage: 'restore', message: error.message })
    }
  }
  for (const [path, snapshot] of rollback) {
    try {
      const mismatch = verifyFileSnapshot(toNativePath(workspaceRoot, path), snapshot)
      if (mismatch) errors.push({ path, stage: 'verify', message: mismatch })
    } catch (error) {
      errors.push({ path, stage: 'verify', message: error.message })
    }
  }
  return { complete: errors.length === 0, restored, errors }
}

function createOwnedTempDirectory(workspaceRoot, { tempFactory = mkdtempSync, hooks = {} } = {}) {
  const rootReal = realpathSync(workspaceRoot)
  const prefix = resolve(workspaceRoot, COORDINATOR_TEMP_PREFIX)
  const path = tempFactory(prefix)
  const stat = lstatSync(path)
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new WorkspacePolicyError('Owned temp path is not a real directory.', 'INTEGRITY_FAILURE')
  const actual = realpathSync(path)
  if (!isInsideOrEqual(rootReal, actual)) throw new WorkspacePolicyError('Owned temp directory escaped the workspace.', 'INTEGRITY_FAILURE')
  const token = randomUUID()
  const tokenPath = resolve(path, '.owner')
  writeExclusive(tokenPath, Buffer.from(token, 'utf8'))
  const ownership = { path, actual, tokenPath, token }
  hooks.afterTempCreated?.({ path, tokenPath })
  return ownership
}

function cleanupOwnedTemp(ownership) {
  if (!ownership) return
  if (!existsSync(ownership.path)) throw new Error('Owned temp directory disappeared before cleanup.')
  const stat = lstatSync(ownership.path)
  if (stat.isSymbolicLink() || !stat.isDirectory() || realpathSync(ownership.path) !== ownership.actual) {
    throw new Error('Owned temp directory identity changed before cleanup.')
  }
  if (!existsSync(ownership.tokenPath) || !lstatSync(ownership.tokenPath).isFile() || readFileSync(ownership.tokenPath, 'utf8') !== ownership.token) {
    throw new Error('Owned temp directory token changed before cleanup.')
  }
  rmSync(ownership.path, { recursive: true })
}

export function applyCandidateOperations({
  workspaceRoot,
  operations,
  packet,
  manifest = {},
  transactionHooks: hooks = {},
  tempFactory,
  keepOwnedTemp = false,
}) {
  const normalized = validateOperations(workspaceRoot, operations, packet)
  const stagedWrites = new Map()
  const rollback = new Map()
  const touched = new Set()
  let ownership

  for (const operation of normalized) {
    touched.add(operation.path)
    if (operation.destination) touched.add(operation.destination)
  }
  for (const path of touched) rollback.set(path, fileSnapshot(toNativePath(workspaceRoot, path)))

  try {
    ownership = createOwnedTempDirectory(workspaceRoot, { tempFactory, hooks })
    for (const operation of normalized) {
      if (operation.type !== 'write') continue
      const temporary = resolve(ownership.path, randomUUID())
      if (!isInsideOrEqual(ownership.actual, temporary)) throw new WorkspacePolicyError('Temporary write escaped the coordinator directory.', 'INTEGRITY_FAILURE')
      writeExclusive(temporary, operation.bytes)
      stagedWrites.set(operation.path, temporary)
    }

    normalized.forEach((operation, index) => {
      hooks.beforeApplyOperation?.({ index, operation: { ...operation, bytes: undefined } })
      const target = toNativePath(workspaceRoot, operation.path)
      if (operation.type === 'write') renameSync(stagedWrites.get(operation.path), target)
      else if (operation.type === 'delete') rmSync(target)
      else renameSync(target, toNativePath(workspaceRoot, operation.destination))
    })

    const nextManifest = structuredClone(manifest)
    normalized.forEach((operation, index) => {
      hooks.beforeReadback?.({ index, operation: { ...operation, bytes: undefined } })
      if (operation.type === 'write') {
        const bytes = readFileSync(toNativePath(workspaceRoot, operation.path))
        const previous = nextManifest[operation.path]
        const existedAtBase = previous ? previous.operation !== 'add' : rollback.get(operation.path).exists
        nextManifest[operation.path] = { operation: existedAtBase ? 'modify' : 'add', contentHash: sha256(bytes) }
      } else if (operation.type === 'delete') {
        nextManifest[operation.path] = { operation: 'delete', contentHash: null }
      } else {
        const bytes = readFileSync(toNativePath(workspaceRoot, operation.destination))
        nextManifest[operation.path] = { operation: 'delete', contentHash: null }
        nextManifest[operation.destination] = { operation: 'rename', contentHash: sha256(bytes), source: operation.path }
      }
    })
    hooks.beforeManifestFinalize?.({ manifest: structuredClone(nextManifest) })
    if (!keepOwnedTemp) cleanupOwnedTemp(ownership)
    return { operations: normalized, manifest: nextManifest, tempDirectory: ownership.path }
  } catch (error) {
    const recovery = recoverTransaction(workspaceRoot, rollback, hooks)
    if (ownership && !keepOwnedTemp) {
      try { cleanupOwnedTemp(ownership) } catch (cleanupError) {
        recovery.complete = false
        recovery.errors.push({ path: ownership.path, stage: 'cleanup', message: cleanupError.message })
      }
    }
    const status = recovery.complete ? 'verified recovery completed' : 'recovery incomplete'
    throw new WorkspaceTransactionError(`Candidate transaction failed; ${status}. Cause: ${error.message}`, recovery, error)
  }
}

export function candidateIdentity(baseCommit, manifest) {
  const changedPaths = Object.entries(manifest)
    .sort(([left], [right]) => left.localeCompare(right, 'en'))
    .map(([path, entry]) => ({
      path,
      operation: entry.operation,
      contentHash: entry.contentHash,
      ...(entry.source ? { source: entry.source } : {}),
    }))
  return sha256(canonicalJson({ baseCommit, changedPaths }))
}

function visitWorkspace(directory, root, output) {
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
    if (directory === root && (entry.name.toLowerCase() === '.git' || entry.name === COORDINATOR_TEMP_DIRECTORY || entry.name.startsWith(COORDINATOR_TEMP_PREFIX))) continue
    const target = resolve(directory, entry.name)
    const path = relative(root, target).split(sep).join('/')
    if (entry.isSymbolicLink()) output[path] = { kind: 'symbolic-link' }
    else if (entry.isDirectory()) visitWorkspace(target, root, output)
    else if (entry.isFile()) output[path] = { kind: 'file', contentHash: sha256(readFileSync(target)), size: statSync(target).size }
    else output[path] = { kind: 'unsupported' }
  }
}

export function snapshotWorkspace(workspaceRoot) {
  const root = realpathSync(workspaceRoot)
  const output = {}
  visitWorkspace(root, root, output)
  return output
}

export function expectedWorkspaceSnapshot(baseSnapshot, manifest) {
  const expected = structuredClone(baseSnapshot)
  for (const [path, entry] of Object.entries(manifest)) {
    if (entry.operation === 'delete') delete expected[path]
    else expected[path] = { kind: 'file', contentHash: entry.contentHash }
  }
  return expected
}

function comparableSnapshot(snapshot) {
  return Object.fromEntries(Object.entries(snapshot).map(([path, entry]) => [path, {
    kind: entry.kind,
    ...(entry.contentHash ? { contentHash: entry.contentHash } : {}),
  }]))
}

export function verifyWorkspaceCandidate(workspaceRoot, baseSnapshot, manifest, baseCommit) {
  const actual = snapshotWorkspace(workspaceRoot)
  const expected = expectedWorkspaceSnapshot(baseSnapshot, manifest)
  if (canonicalJson(comparableSnapshot(actual)) !== canonicalJson(comparableSnapshot(expected))) {
    return { ok: false, code: 'WORKSPACE_DRIFT', message: 'Task workspace differs from the expected base/candidate state.' }
  }
  const actualManifest = {}
  for (const [path, entry] of Object.entries(manifest)) {
    actualManifest[path] = entry.operation === 'delete'
      ? { ...entry, contentHash: null }
      : { ...entry, contentHash: actual[path].contentHash }
  }
  const identity = candidateIdentity(baseCommit, actualManifest)
  return { ok: true, identity, manifest: actualManifest, snapshot: actual }
}

function gitResult(root, args) {
  const result = spawnSync('git', args, { cwd: root, shell: false, windowsHide: true, encoding: null })
  if (result.status !== 0) throw new Error(`Git integrity command failed: git ${args.join(' ')}`)
  return result.stdout
}

export function gitHead(root) {
  return gitResult(root, ['rev-parse', 'HEAD']).toString('utf8').trim()
}

export function gitIndexFingerprint(root) {
  return sha256(gitResult(root, ['ls-files', '-s', '-z']))
}

export function gitWorktreeFingerprint(root) {
  return sha256(gitResult(root, ['status', '--porcelain=v2', '-z', '--untracked-files=all']))
}

export function candidateIsUnstaged(workspaceRoot) {
  const result = spawnSync('git', ['diff', '--cached', '--quiet', '--exit-code'], {
    cwd: workspaceRoot,
    shell: false,
    windowsHide: true,
    stdio: 'ignore',
  })
  return result.status === 0
}

export function snapshotPaths(workspaceRoot, paths) {
  function directoryEntries(directory, prefix = '') {
    return readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name, 'en'))
      .flatMap(entry => {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name
        const target = resolve(directory, entry.name)
        if (entry.isDirectory()) return [{ path: relativePath, kind: 'directory' }, ...directoryEntries(target, relativePath)]
        if (entry.isSymbolicLink()) return [{ path: relativePath, kind: 'symbolic-link' }]
        return [{ path: relativePath, kind: 'file', hash: sha256(readFileSync(target)) }]
      })
  }

  return Object.fromEntries(paths.map(path => {
    const normalized = path.replaceAll('\\', '/')
    const target = resolve(workspaceRoot, ...normalized.split('/'))
    if (!existsSync(target)) return [normalized, { exists: false }]
    const stat = lstatSync(target)
    if (stat.isDirectory()) return [normalized, { exists: true, kind: 'directory', entries: directoryEntries(target) }]
    return [normalized, { exists: true, kind: 'file', hash: sha256(readFileSync(target)) }]
  }))
}

export function captureIntegrityPins({ workspaceRoot, canonicalRoot, preservedPaths = [] }) {
  return {
    workspaceHead: gitHead(workspaceRoot),
    workspaceIndex: gitIndexFingerprint(workspaceRoot),
    workspaceBase: snapshotWorkspace(workspaceRoot),
    canonical: canonicalRoot ? {
      root: resolve(canonicalRoot),
      head: gitHead(canonicalRoot),
      index: gitIndexFingerprint(canonicalRoot),
      worktree: gitWorktreeFingerprint(canonicalRoot),
      preservedPaths: [...preservedPaths],
      preserved: snapshotPaths(canonicalRoot, preservedPaths),
    } : null,
  }
}

export function verifyIntegrityPins({ workspaceRoot, pins, manifest, baseCommit }) {
  if (gitHead(workspaceRoot) !== pins.workspaceHead || pins.workspaceHead !== baseCommit) {
    return { ok: false, code: 'WORKSPACE_DRIFT', message: 'Task workspace HEAD/base commit changed.' }
  }
  if (gitIndexFingerprint(workspaceRoot) !== pins.workspaceIndex) {
    return { ok: false, code: 'WORKSPACE_DRIFT', message: 'Task workspace staged index changed.' }
  }
  const candidate = verifyWorkspaceCandidate(workspaceRoot, pins.workspaceBase, manifest, baseCommit)
  if (!candidate.ok) return candidate
  if (pins.canonical) {
    const canonical = pins.canonical
    if (gitHead(canonical.root) !== canonical.head || gitIndexFingerprint(canonical.root) !== canonical.index || gitWorktreeFingerprint(canonical.root) !== canonical.worktree) {
      return { ok: false, code: 'WORKSPACE_DRIFT', message: 'Canonical checkout HEAD, index, or working-tree state changed.' }
    }
    if (canonicalJson(snapshotPaths(canonical.root, canonical.preservedPaths)) !== canonicalJson(canonical.preserved)) {
      return { ok: false, code: 'WORKSPACE_DRIFT', message: 'A required preservation path changed.' }
    }
  }
  return candidate
}
