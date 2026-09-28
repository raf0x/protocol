import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { AgentRegistry, AgentRuntimeError, assertAgentResponse } from './agents.mjs'
import {
  ARTIFACT_FILES,
  buildArtifacts,
  readArtifactDirectory,
  validateArtifactDirectory,
  validateArtifactSet,
  validateReadinessState,
  writeArtifacts,
} from './evidence.mjs'
import {
  BLOCK_REASONS,
  LIMITS,
  TERMINAL_STATES,
  assessPacketRisk,
  compareRisk,
  requiredRoles,
} from './policy.mjs'
import { evaluateChecks, validateCheckDefinition } from './validation.mjs'
import {
  WorkspacePolicyError,
  WorkspaceTransactionError,
  applyCandidateOperations,
  candidateIdentity,
  candidateIsUnstaged,
  captureIntegrityPins,
  hashPacket,
  verifyIntegrityPins,
} from './workspace.mjs'

const STATE_FILE = 'state.json'
const PHASES = new Set([
  'INTAKE', 'PREFLIGHT', 'PLANNING', 'IMPLEMENTING', 'AWAITING_PRODUCT_QA',
  'REVIEWING', 'CORRECTING', 'RECHECKING', 'VALIDATING',
  'READY_FOR_HANDOFF', 'BLOCKED', 'CANCELLED',
])
const LEGAL_TRANSITIONS = Object.freeze({
  INTAKE: ['PREFLIGHT', 'BLOCKED', 'CANCELLED'],
  PREFLIGHT: ['PLANNING', 'BLOCKED', 'CANCELLED'],
  PLANNING: ['IMPLEMENTING', 'BLOCKED', 'CANCELLED'],
  IMPLEMENTING: ['AWAITING_PRODUCT_QA', 'BLOCKED', 'CANCELLED'],
  AWAITING_PRODUCT_QA: ['REVIEWING', 'RECHECKING', 'VALIDATING', 'BLOCKED', 'CANCELLED'],
  REVIEWING: ['CORRECTING', 'VALIDATING', 'BLOCKED', 'CANCELLED'],
  CORRECTING: ['AWAITING_PRODUCT_QA', 'RECHECKING', 'BLOCKED', 'CANCELLED'],
  RECHECKING: ['CORRECTING', 'VALIDATING', 'BLOCKED', 'CANCELLED'],
  VALIDATING: ['READY_FOR_HANDOFF', 'BLOCKED', 'CANCELLED'],
  READY_FOR_HANDOFF: [],
  BLOCKED: [],
  CANCELLED: [],
})

class SimulatedInterruption extends Error {
  constructor(point) {
    super(`Simulated interruption at ${point}.`)
    this.point = point
  }
}

class TerminalRunError extends Error {}

function randomRunId(taskId) {
  return `${taskId}-${Date.now()}-${process.pid}`
}

function atomicJson(path, value) {
  const temporary = `${path}.tmp-${randomUUID()}`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  renameSync(temporary, path)
}

function operationSummaries(operations) {
  return operations.map(operation => ({
    type: operation.type,
    path: operation.path,
    ...(operation.destination ? { destination: operation.destination } : {}),
  }))
}

function validatePacket(packet) {
  if (!packet || packet.approved !== true) throw new Error('The task packet must be explicitly approved.')
  for (const key of ['taskId', 'baseCommit', 'risk']) if (typeof packet[key] !== 'string' || !packet[key]) throw new Error(`Task packet is missing ${key}.`)
  if (!Array.isArray(packet.allowedPaths) || packet.allowedPaths.length === 0) throw new Error('Task packet must declare allowedPaths.')
  if (!packet.productQa || typeof packet.productQa.required !== 'boolean') throw new Error('Task packet must explicitly declare product QA applicability.')
  if (!packet.productQa.required && !packet.productQa.notRequiredReason) throw new Error('Not-required product QA needs an approved reason.')
  if (!Array.isArray(packet.validation) || packet.validation.length === 0) throw new Error('Task packet must explicitly declare validation applicability.')
  for (const check of packet.validation) validateCheckDefinition(check)
  if (packet.mutationPolicy !== undefined) {
    if (!packet.mutationPolicy || typeof packet.mutationPolicy !== 'object' || Array.isArray(packet.mutationPolicy)) throw new Error('mutationPolicy must be an object.')
    if (!Array.isArray(packet.mutationPolicy.deletePaths ?? []) || !Array.isArray(packet.mutationPolicy.renames ?? [])) throw new Error('mutationPolicy lists are malformed.')
  }
  return packet
}

function requiredRolesForPacket(packet) {
  const risk = assessPacketRisk(packet)
  return risk.mismatch ? null : requiredRoles(risk.detected, { requireIndependentReview: packet.requireIndependentReview })
}

function sameValue(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function validateProductQaEvidence(evidence, state) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) return 'Human product QA evidence is missing.'
  const required = ['taskId', 'runId', 'packetHash', 'candidateId', 'producerType', 'result', 'evidenceRef', 'reason']
  if (required.some(key => typeof evidence[key] !== 'string' || !evidence[key])) return 'Human product QA evidence is malformed.'
  if (evidence.taskId !== state.packet.taskId || evidence.runId !== state.runId || evidence.packetHash !== state.packetHash) return 'Human product QA evidence belongs to another task/run/packet.'
  if (evidence.candidateId !== state.candidateId) return 'Human product QA evidence belongs to another candidate.'
  if (evidence.producerType !== 'human' || evidence.result !== 'pass') return 'Only passing human product QA evidence is accepted.'
  return null
}

function validateValidationResult(check, definition) {
  if (!check || typeof check !== 'object' || Array.isArray(check)) return false
  if (check.id !== definition.id || check.family !== definition.family || check.required !== definition.required) return false
  if (!['pass', 'fail', 'blocked', 'not_run', 'not_required'].includes(check.result)) return false
  if (typeof check.candidateId !== 'string' || typeof check.details !== 'string' || !check.details) return false
  return check.rawOutcome === undefined || ['timeout', 'cancelled', 'skipped'].includes(check.rawOutcome)
}

export class Coordinator {
  constructor({
    packet,
    workspaceRoot,
    runDirectory,
    artifactDirectory,
    agentAdapter,
    validationAdapter,
    runId,
    integrityContext = {},
    artifactWriter = writeArtifacts,
    workspaceTransactionOptions = {},
  }) {
    this.workspaceRoot = workspaceRoot
    this.runDirectory = runDirectory
    this.artifactDirectory = artifactDirectory
    this.agentAdapter = agentAdapter
    this.validationAdapter = validationAdapter
    this.artifactWriter = artifactWriter
    this.workspaceTransactionOptions = workspaceTransactionOptions
    this.runOptions = {}
    this.resumeAuditErrors = []
    mkdirSync(runDirectory, { recursive: true })
    mkdirSync(artifactDirectory, { recursive: true })
    const statePath = resolve(runDirectory, STATE_FILE)

    if (existsSync(statePath)) {
      this.state = JSON.parse(readFileSync(statePath, 'utf8'))
      this.auditPersistedState(packet)
      return
    }

    const approvedPacket = validatePacket(packet)
    const packetHash = hashPacket(approvedPacket)
    const pins = captureIntegrityPins({
      workspaceRoot,
      canonicalRoot: integrityContext.canonicalRoot,
      preservedPaths: integrityContext.preservedPaths,
    })
    this.state = {
      schemaVersion: '1.0.0',
      phase: 'INTAKE',
      runId: runId ?? randomRunId(approvedPacket.taskId),
      revision: 0,
      packet: structuredClone(approvedPacket),
      packetHash,
      baseCommit: approvedPacket.baseCommit,
      pins,
      requiredRoles: [],
      agentRegistry: { identities: {}, nextIdentity: 1, active: [] },
      agentCallCounts: {},
      agentInvocationCounts: {},
      correctionRounds: 0,
      correctionAttempt: null,
      candidateManifest: {},
      candidateId: null,
      candidateUnstaged: false,
      productQaEvidence: null,
      nextReviewPhase: null,
      evidenceRefs: [],
      reports: {},
      recoveryEvents: [],
      blockers: [],
      readinessVerified: false,
      history: ['INTAKE'],
    }
    if (pins.workspaceHead !== approvedPacket.baseCommit) this.resumeAuditErrors.push('Approved base commit does not match task workspace HEAD.')
    this.persist()
  }

  auditPersistedState(suppliedPacket) {
    const state = this.state
    if (!PHASES.has(state.phase)) this.resumeAuditErrors.push('Persisted phase is invalid.')
    let storedHash
    try { storedHash = hashPacket(validatePacket(state.packet)) } catch (error) { this.resumeAuditErrors.push(`Persisted packet is invalid: ${error.message}`) }
    if (storedHash && state.packetHash !== storedHash) this.resumeAuditErrors.push('Persisted packet hash does not match the stored approved packet.')
    if (suppliedPacket && (!storedHash || hashPacket(suppliedPacket) !== storedHash)) this.resumeAuditErrors.push('Supplied resume packet does not match the stored approved packet.')
    if (state.baseCommit !== state.packet?.baseCommit) this.resumeAuditErrors.push('Persisted base commit is inconsistent with the approved packet.')

    const expectedRoles = state.packet ? requiredRolesForPacket(state.packet) : null
    if (expectedRoles && !['INTAKE', 'PREFLIGHT'].includes(state.phase) && !sameValue(state.requiredRoles, expectedRoles)) {
      this.resumeAuditErrors.push('Persisted required roles do not match approved risk routing.')
    }
    const identities = Object.values(state.agentRegistry?.identities ?? {})
    const active = state.agentRegistry?.active ?? []
    if (identities.length > LIMITS.maxAgentIdentities || new Set(identities).size !== identities.length) this.resumeAuditErrors.push('Persisted agent identities are invalid.')
    if (active.length > LIMITS.maxConcurrentAgents || active.some(identity => !identities.includes(identity))) this.resumeAuditErrors.push('Persisted concurrency state is invalid.')
    const implementer = state.agentRegistry?.identities?.implementer
    const reviewer = state.agentRegistry?.identities?.reviewer
    if (implementer && reviewer && implementer === reviewer) this.resumeAuditErrors.push('Implementer and reviewer identities are not independent.')
    if (!Number.isInteger(state.correctionRounds) || state.correctionRounds < 0 || state.correctionRounds > LIMITS.maxCorrectionRounds) this.resumeAuditErrors.push('Persisted correction-round count is invalid.')
    for (const [role, count] of Object.entries(state.agentCallCounts ?? {})) {
      if (!Number.isInteger(count) || count < 0) this.resumeAuditErrors.push(`Persisted logical agent-call count is invalid for ${role}.`)
    }
    for (const [role, count] of Object.entries(state.agentInvocationCounts ?? {})) {
      if (!Number.isInteger(count) || count < 0) this.resumeAuditErrors.push(`Persisted adapter-request count is invalid for ${role}.`)
    }
    if (state.correctionAttempt) {
      const attempt = state.correctionAttempt
      if (typeof attempt.correctionAttemptId !== 'string' || !attempt.correctionAttemptId
        || !Number.isInteger(attempt.round) || attempt.round < 1 || attempt.round > LIMITS.maxCorrectionRounds
        || !['reserved', 'dispatched', 'responded', 'completed'].includes(attempt.dispatchStatus)
        || !Number.isInteger(attempt.ordinal) || attempt.ordinal < 1
        || typeof attempt.identity !== 'string' || !attempt.identity
        || !Number.isInteger(attempt.adapterRequests) || attempt.adapterRequests < 0
        || !['not_requested', 'uncertain', 'response_persisted'].includes(attempt.executionState)) {
        this.resumeAuditErrors.push('Persisted correction attempt is invalid.')
      }
      if (attempt.identity !== implementer || attempt.ordinal !== attempt.round
        || state.agentCallCounts?.implementer !== attempt.ordinal + 1) this.resumeAuditErrors.push('Persisted correction reservation does not match implementer logical-call accounting.')
      if (attempt.dispatchStatus === 'reserved' && (attempt.adapterRequests !== 0 || attempt.executionState !== 'not_requested')) this.resumeAuditErrors.push('Reserved correction attempt has invalid physical-request state.')
      if (attempt.dispatchStatus === 'dispatched' && (attempt.adapterRequests > 1 || (attempt.adapterRequests === 0 ? attempt.executionState !== 'not_requested' : attempt.executionState !== 'uncertain'))) this.resumeAuditErrors.push('Dispatched correction attempt has invalid physical-request state.')
      if (['responded', 'completed'].includes(attempt.dispatchStatus) && (attempt.adapterRequests !== 1 || attempt.executionState !== 'response_persisted')) this.resumeAuditErrors.push('Persisted correction response has invalid physical-request state.')
      if (attempt.dispatchStatus === 'completed' && attempt.round !== state.correctionRounds) this.resumeAuditErrors.push('Completed correction attempt does not match the correction counter.')
      if (attempt.dispatchStatus !== 'completed' && attempt.round !== state.correctionRounds + 1) this.resumeAuditErrors.push('Pending correction attempt does not match the next correction round.')
      if (['responded', 'completed'].includes(attempt.dispatchStatus)) {
        try { assertAgentResponse(attempt.response, 'implementation') } catch { this.resumeAuditErrors.push('Persisted correction response is malformed.') }
      }
    }
    if (active.length) {
      const recoverableCorrection = state.phase === 'CORRECTING'
        && ['dispatched', 'responded'].includes(state.correctionAttempt?.dispatchStatus)
        && active.length === 1
        && active[0] === state.correctionAttempt.identity
      if (!recoverableCorrection) this.resumeAuditErrors.push('Persisted active-agent state is not recoverable.')
    }
    for (const reference of state.evidenceRefs ?? []) {
      if (!reference || typeof reference.id !== 'string' || typeof reference.type !== 'string') this.resumeAuditErrors.push('Persisted evidence reference is malformed.')
      else if (reference.type !== 'architecture' && reference.candidateId !== null && reference.candidateId !== state.candidateId) this.resumeAuditErrors.push('Persisted evidence is bound to another candidate.')
    }
    if (state.productQaEvidence) {
      const error = validateProductQaEvidence(state.productQaEvidence, state)
      if (error) this.resumeAuditErrors.push(error)
    }
    if (state.phase === 'READY_FOR_HANDOFF') {
      if (state.readinessVerified !== true || state.reports?.tests?.result !== 'pass' || !state.candidateId) this.resumeAuditErrors.push('Persisted readiness invariants are incomplete.')
      else if (!evaluateChecks(state.reports.tests.checks ?? [], state.candidateId).ok) this.resumeAuditErrors.push('Persisted validation evidence is incomplete or stale.')
      if (expectedRoles?.includes('reviewer') && state.reports?.review?.producer !== reviewer) this.resumeAuditErrors.push('Persisted review producer does not match the reviewer identity.')
      if (state.reports?.implementation?.producer !== implementer) this.resumeAuditErrors.push('Persisted implementation producer does not match the implementer identity.')
      if (active.length) this.resumeAuditErrors.push('A ready run cannot retain active agents.')
      this.resumeAuditErrors.push(...validateReadinessState(state).map(error => `Persisted readiness semantic failure: ${error}`))
      const artifactResults = validateArtifactDirectory(this.artifactDirectory, state)
      for (const [type, typeErrors] of Object.entries(artifactResults)) {
        this.resumeAuditErrors.push(...typeErrors.map(error => `Persisted ${type} artifact semantic failure: ${error}`))
      }
    }

    if (storedHash) state.packetHash = storedHash
    if (state.packet?.baseCommit) state.baseCommit = state.packet.baseCommit
  }

  sanitizeForBlockedArtifacts() {
    const expectedRoles = requiredRolesForPacket(this.state.packet)
    if (expectedRoles) this.state.requiredRoles = expectedRoles
    const identities = this.state.agentRegistry?.identities ?? {}
    const validEntries = Object.entries(identities).filter(([, identity]) => typeof identity === 'string' && identity)
    this.state.agentRegistry = {
      identities: Object.fromEntries(validEntries.slice(0, LIMITS.maxAgentIdentities)),
      nextIdentity: Math.max(1, Number(this.state.agentRegistry?.nextIdentity) || 1),
      active: [],
    }
    this.state.correctionRounds = Number.isInteger(this.state.correctionRounds)
      ? Math.max(0, Math.min(LIMITS.maxCorrectionRounds, this.state.correctionRounds))
      : 0
    this.state.evidenceRefs = []
    this.state.reports = {}
    this.state.productQaEvidence = null
    this.state.candidateUnstaged = false
    this.state.readinessVerified = false
  }

  persist() {
    this.state.revision += 1
    atomicJson(resolve(this.runDirectory, STATE_FILE), this.state)
  }

  transition(phase) {
    if (!LEGAL_TRANSITIONS[this.state.phase]?.includes(phase)) throw new Error(`Illegal state transition: ${this.state.phase} -> ${phase}`)
    this.state.phase = phase
    this.state.history.push(phase)
    this.persist()
  }

  forceIntegrityBlock(code, message) {
    this.state.phase = 'BLOCKED'
    this.state.readinessVerified = false
    this.state.candidateUnstaged = false
    this.state.blockers.push({ code, message })
    this.state.history.push('BLOCKED')
    this.persist()
    return this.writeTerminalArtifacts()
  }

  block(code, message) {
    if (!BLOCK_REASONS.includes(code)) code = 'INTEGRITY_FAILURE'
    if (this.state.phase === 'CANCELLED' || this.state.phase === 'BLOCKED') return this.finish()
    if (this.state.phase === 'READY_FOR_HANDOFF') return this.forceIntegrityBlock(code, message)
    this.state.blockers.push({ code, message })
    this.state.readinessVerified = false
    this.transition('BLOCKED')
    return this.writeTerminalArtifacts()
  }

  cancel(message = 'Run cancelled by an authorized caller.') {
    if (TERMINAL_STATES.includes(this.state.phase)) return this.finish()
    this.state.blockers.push({ code: 'RUNTIME_FAILURE', message })
    this.state.readinessVerified = false
    this.transition('CANCELLED')
    return this.writeTerminalArtifacts()
  }

  ensureActive() {
    if (TERMINAL_STATES.includes(this.state.phase)) throw new TerminalRunError(`Run is already ${this.state.phase}.`)
  }

  maybeInterrupt(point) {
    if (this.runOptions.interruptAt === point) throw new SimulatedInterruption(point)
  }

  verifyIntegrity() {
    return verifyIntegrityPins({
      workspaceRoot: this.workspaceRoot,
      pins: this.state.pins,
      manifest: this.state.candidateManifest,
      baseCommit: this.state.baseCommit,
    })
  }

  ensureIntegrity() {
    const integrity = this.verifyIntegrity()
    if (!integrity.ok) throw new WorkspacePolicyError(integrity.message, integrity.code)
    if (this.state.candidateId && integrity.identity !== this.state.candidateId) {
      throw new WorkspacePolicyError('Candidate identity does not match actual workspace bytes.', 'INTEGRITY_FAILURE')
    }
    return integrity
  }

  writeTerminalArtifacts() {
    const artifacts = buildArtifacts(this.state)
    const files = this.artifactWriter(this.artifactDirectory, artifacts, this.state)
    return { status: this.state.phase, state: structuredClone(this.state), artifacts, files }
  }

  validateReadyHandoff() {
    const errors = validateReadinessState(this.state)
    try { this.ensureIntegrity() } catch (error) { errors.push(error.message) }
    if (!candidateIsUnstaged(this.workspaceRoot)) errors.push('Candidate is staged.')
    return errors
  }

  finish() {
    if (this.state.phase === 'READY_FOR_HANDOFF') {
      const errors = this.validateReadyHandoff()
      const artifactResults = validateArtifactDirectory(this.artifactDirectory, this.state)
      for (const [type, typeErrors] of Object.entries(artifactResults)) errors.push(...typeErrors.map(error => `${type}: ${error}`))
      if (errors.length) return this.forceIntegrityBlock('INTEGRITY_FAILURE', `Persisted handoff failed revalidation: ${errors.join(' ')}`)
      const artifacts = readArtifactDirectory(this.artifactDirectory)
      return { status: this.state.phase, state: structuredClone(this.state), artifacts, files: Object.values(ARTIFACT_FILES).map(file => resolve(this.artifactDirectory, file)) }
    }
    return this.writeTerminalArtifacts()
  }

  async invoke(role, expectedKind, { correctionAttempt } = {}) {
    const maxCalls = this.state.packet.budget?.maxAgentCalls
    const totalCalls = Object.values(this.state.agentCallCounts).reduce((sum, count) => sum + count, 0)
    if (!correctionAttempt && Number.isInteger(maxCalls) && totalCalls >= maxCalls) throw new AgentRuntimeError('The approved agent-call budget is exhausted.', 'BUDGET_EXHAUSTED')

    const registry = new AgentRegistry(this.state.agentRegistry)
    let identity
    let ordinal
    if (correctionAttempt?.dispatchStatus === 'dispatched') {
      if (correctionAttempt.identity) registry.release(correctionAttempt.identity)
      identity = registry.acquire(role)
      ordinal = correctionAttempt.ordinal
    } else if (correctionAttempt?.dispatchStatus === 'reserved') {
      identity = registry.acquire(role)
      ordinal = correctionAttempt.ordinal
      if (identity !== correctionAttempt.identity) throw new AgentRuntimeError('Correction reservation identity no longer matches the implementer.', 'INTEGRITY_FAILURE')
      correctionAttempt.dispatchStatus = 'dispatched'
    } else {
      identity = registry.acquire(role)
      ordinal = this.state.agentCallCounts[role] ?? 0
      this.state.agentCallCounts[role] = ordinal + 1
    }
    this.state.agentRegistry = registry.snapshot()
    this.persist()
    if (correctionAttempt) this.maybeInterrupt('CORRECTION_DISPATCHED')

    try {
      this.state.agentInvocationCounts ??= {}
      this.state.agentInvocationCounts[role] = (this.state.agentInvocationCounts[role] ?? 0) + 1
      if (correctionAttempt) {
        correctionAttempt.adapterRequests += 1
        correctionAttempt.executionState = 'uncertain'
      }
      this.persist()
      const response = await this.agentAdapter.invoke({
        role,
        ordinal,
        identity,
        candidateId: this.state.candidateId,
        correctionRound: correctionAttempt?.round ?? this.state.correctionRounds,
        correctionAttemptId: correctionAttempt?.correctionAttemptId,
      })
      this.ensureActive()
      this.ensureIntegrity()
      const validated = assertAgentResponse(response, expectedKind)
      if (correctionAttempt) {
        this.maybeInterrupt('CORRECTION_RESPONSE_RECEIVED')
        correctionAttempt.response = structuredClone(validated)
        correctionAttempt.dispatchStatus = 'responded'
        correctionAttempt.executionState = 'response_persisted'
        this.persist()
        this.maybeInterrupt('CORRECTION_RESPONSE_PERSISTED')
      }
      return { identity, response: validated }
    } finally {
      registry.release(identity)
      this.state.agentRegistry = registry.snapshot()
      this.persist()
    }
  }

  boundaryFailure(response) {
    if (response.delegation || response.delegate) return ['SCOPE_EXPANSION', 'Recursive agent delegation is not allowed.']
    if (response.scopeExpansion) return ['SCOPE_EXPANSION', 'Agent requested scope beyond the approved packet.']
    if (response.releaseAction) return ['RELEASE_AUTHORIZATION_ABSENT', `Release action ${response.releaseAction} is outside V1.`]
    if (response.productionMutation || response.destructiveProductionMutation) return ['DESTRUCTIVE_OR_PRODUCTION_MUTATION', 'Production or destructive mutation is not allowed.']
    if (response.detectedRisk && compareRisk(response.detectedRisk, this.state.packet.risk) > 0) {
      return ['RISK_MISMATCH', `Agent detected ${response.detectedRisk} risk above approved ${this.state.packet.risk} risk.`]
    }
    return null
  }

  addEvidence(type, identity, result, references, candidateId = this.state.candidateId) {
    this.ensureActive()
    this.state.evidenceRefs = this.state.evidenceRefs.filter(reference => reference.type !== type)
    references.forEach((reference, index) => this.state.evidenceRefs.push({
      id: `${type}:${identity}:${index}:${reference}`,
      type,
      candidateId: candidateId ?? null,
      result,
    }))
  }

  submitProductQa(evidence) {
    if (this.state.phase !== 'AWAITING_PRODUCT_QA') throw new Error('Product QA can be submitted only while awaiting product QA.')
    const error = validateProductQaEvidence(evidence, this.state)
    if (error) return this.block('INTEGRITY_FAILURE', error)
    this.state.productQaEvidence = structuredClone(evidence)
    this.state.evidenceRefs = this.state.evidenceRefs.filter(reference => reference.type !== 'product_qa')
    this.state.evidenceRefs.push({ id: evidence.evidenceRef, type: 'product_qa', candidateId: evidence.candidateId, result: evidence.result })
    this.persist()
    return { status: this.state.phase, state: structuredClone(this.state) }
  }

  async run(options = {}) {
    this.runOptions = options
    if (this.resumeAuditErrors.length) {
      const message = this.resumeAuditErrors.join(' ')
      this.sanitizeForBlockedArtifacts()
      return this.forceIntegrityBlock('INTEGRITY_FAILURE', `Persisted state failed invariant validation: ${message}`)
    }
    if (TERMINAL_STATES.includes(this.state.phase)) return this.finish()
    try {
      this.ensureIntegrity()
      while (!TERMINAL_STATES.includes(this.state.phase)) {
        await this.step()
        if (this.state.phase === options.interruptAfter && !TERMINAL_STATES.includes(this.state.phase)) {
          return { status: 'INTERRUPTED', state: structuredClone(this.state) }
        }
      }
    } catch (error) {
      if (error instanceof SimulatedInterruption) return { status: 'INTERRUPTED', point: error.point, state: structuredClone(this.state) }
      if (error instanceof TerminalRunError) return this.finish()
      if (error instanceof AgentRuntimeError || error instanceof WorkspacePolicyError) return this.block(error.code, error.message)
      return this.block('RUNTIME_FAILURE', error.message)
    }
    return this.finish()
  }

  async step() {
    switch (this.state.phase) {
      case 'INTAKE': return this.transition('PREFLIGHT')
      case 'PREFLIGHT': return this.preflight()
      case 'PLANNING': return this.plan()
      case 'IMPLEMENTING': return this.implement(false)
      case 'AWAITING_PRODUCT_QA': return this.productQa()
      case 'REVIEWING': return this.review(false)
      case 'CORRECTING': return this.correct()
      case 'RECHECKING': return this.review(true)
      case 'VALIDATING': return this.validate()
      default: throw new Error(`Unsupported state: ${this.state.phase}`)
    }
  }

  preflight() {
    const risk = assessPacketRisk(this.state.packet)
    if (risk.mismatch) return this.block('RISK_MISMATCH', `Packet is ${risk.approved} risk but policy requires ${risk.detected}.`)
    this.state.requiredRoles = requiredRoles(risk.detected, { requireIndependentReview: this.state.packet.requireIndependentReview })
    if (this.state.requiredRoles.length > LIMITS.maxAgentIdentities) return this.block('BUDGET_EXHAUSTED', 'Required route exceeds the three-agent identity limit.')
    if ((this.state.packet.requestedReleaseActions ?? []).length) return this.block('RELEASE_AUTHORIZATION_ABSENT', 'Release execution is outside AOS-004A.')
    return this.transition('PLANNING')
  }

  async plan() {
    if (!this.state.requiredRoles.includes('architect')) return this.transition('IMPLEMENTING')
    const { identity, response } = await this.invoke('architect', 'architecture')
    const boundary = this.boundaryFailure(response)
    if (boundary) return this.block(...boundary)
    if (response.result !== 'pass') return this.block('PRODUCT_DECISION_REQUIRED', 'Architecture did not approve the plan.')
    this.addEvidence('architecture', identity, 'pass', response.evidence, null)
    this.state.reports.architecture = { result: 'pass', producer: identity, candidateId: null }
    return this.transition('IMPLEMENTING')
  }

  async implement(isCorrection, correctionAttempt) {
    let identity
    let response
    if (correctionAttempt?.dispatchStatus === 'responded') {
      this.ensureActive()
      this.ensureIntegrity()
      identity = correctionAttempt.identity
      response = assertAgentResponse(structuredClone(correctionAttempt.response), 'implementation')
    } else ({ identity, response } = await this.invoke('implementer', 'implementation', { correctionAttempt }))
    this.ensureActive()
    const boundary = this.boundaryFailure(response)
    if (boundary) return this.block(...boundary)
    if (response.result !== 'pass') return this.block('RUNTIME_FAILURE', 'Implementer did not return a successful candidate proposal.')
    this.ensureIntegrity()
    let applied
    try {
      applied = applyCandidateOperations({
        workspaceRoot: this.workspaceRoot,
        operations: response.candidate.operations,
        packet: this.state.packet,
        manifest: this.state.candidateManifest,
        ...this.workspaceTransactionOptions,
      })
    } catch (error) {
      if (error instanceof WorkspaceTransactionError) {
        const recovery = {
          id: `recovery:${randomUUID()}`,
          complete: error.recovery.complete,
          errors: error.recovery.errors,
          restored: error.recovery.restored,
          message: error.message,
        }
        this.state.recoveryEvents ??= []
        this.state.recoveryEvents.push(recovery)
        this.state.evidenceRefs.push({
          id: recovery.id,
          type: 'recovery',
          candidateId: this.state.candidateId,
          result: 'blocked',
        })
        return this.block('INTEGRITY_FAILURE', error.message)
      }
      if (error instanceof WorkspacePolicyError) return this.block(error.code, error.message)
      return this.block('INTEGRITY_FAILURE', `Candidate transaction failed before authoritative manifest publication: ${error.message}`)
    }
    this.ensureActive()
    this.state.candidateManifest = applied.manifest
    this.state.candidateId = candidateIdentity(this.state.baseCommit, applied.manifest)
    const actual = this.ensureIntegrity()
    this.state.candidateManifest = actual.manifest
    this.state.evidenceRefs = this.state.evidenceRefs.filter(reference => !['implementation', 'review', 'validation', 'product_qa'].includes(reference.type))
    this.addEvidence('implementation', identity, 'pass', response.evidence)
    this.state.reports.implementation = { result: 'pass', producer: identity, candidateId: this.state.candidateId, operations: operationSummaries(applied.operations) }
    delete this.state.reports.review
    delete this.state.reports.tests
    this.state.productQaEvidence = null
    this.state.candidateUnstaged = false
    if (isCorrection) {
      correctionAttempt.dispatchStatus = 'completed'
      this.state.correctionRounds = correctionAttempt.round
      this.persist()
      this.maybeInterrupt('CORRECTION_COMPLETED')
    }
    this.state.nextReviewPhase = isCorrection ? 'RECHECKING' : (this.state.requiredRoles.includes('reviewer') ? 'REVIEWING' : 'VALIDATING')
    return this.transition('AWAITING_PRODUCT_QA')
  }

  productQa() {
    if (this.state.packet.productQa.required) {
      const error = validateProductQaEvidence(this.state.productQaEvidence, this.state)
      if (error) return this.block('PRODUCT_DECISION_REQUIRED', error)
    }
    const next = this.state.nextReviewPhase ?? (this.state.requiredRoles.includes('reviewer') ? 'REVIEWING' : 'VALIDATING')
    return this.transition(next)
  }

  async review() {
    const { identity, response } = await this.invoke('reviewer', 'review')
    this.ensureActive()
    const boundary = this.boundaryFailure(response)
    if (boundary) return this.block(...boundary)
    if (response.candidate?.operations || response.mutations) return this.block('INTEGRITY_FAILURE', 'Reviewer attempted to mutate the candidate.')
    if (response.candidateId !== this.state.candidateId) return this.block('INTEGRITY_FAILURE', 'Reviewer evidence does not match the current candidate.')
    this.addEvidence('review', identity, response.result, response.evidence)
    this.state.reports.review = { result: response.result, producer: identity, candidateId: this.state.candidateId, findings: response.findings ?? [] }
    if (response.result === 'pass') return this.transition('VALIDATING')
    if (response.result !== 'fail') return this.block('MISSING_EVIDENCE', 'Review did not produce a pass or correction request.')
    this.state.correctionAttempt = null
    return this.transition('CORRECTING')
  }

  async correct() {
    let attempt = this.state.correctionAttempt
    if (!attempt) {
      if (this.state.correctionRounds >= LIMITS.maxCorrectionRounds) return this.block('REVIEW_LIMIT', 'A third correction round is not allowed.')
      const maxCalls = this.state.packet.budget?.maxAgentCalls
      const totalCalls = Object.values(this.state.agentCallCounts).reduce((sum, count) => sum + count, 0)
      if (Number.isInteger(maxCalls) && totalCalls >= maxCalls) return this.block('BUDGET_EXHAUSTED', 'The approved agent-call budget is exhausted before correction reservation.')
      const identity = this.state.agentRegistry.identities.implementer
      if (!identity) return this.block('INTEGRITY_FAILURE', 'Correction cannot reserve a missing implementer identity.')
      const ordinal = this.state.agentCallCounts.implementer ?? 0
      this.state.agentCallCounts.implementer = ordinal + 1
      attempt = {
        round: this.state.correctionRounds + 1,
        correctionAttemptId: randomUUID(),
        dispatchStatus: 'reserved',
        executionState: 'not_requested',
        identity,
        ordinal,
        adapterRequests: 0,
      }
      this.state.correctionAttempt = attempt
      this.persist()
      this.maybeInterrupt('CORRECTION_RESERVED')
    }
    if (attempt.dispatchStatus === 'dispatched' && attempt.executionState === 'uncertain') {
      this.state.agentRegistry.active = (this.state.agentRegistry.active ?? []).filter(identity => identity !== attempt.identity)
      this.state.evidenceRefs.push({
        id: `dispatch-recovery:${attempt.correctionAttemptId}:uncertain`,
        type: 'dispatch_recovery',
        candidateId: this.state.candidateId,
        result: 'blocked',
      })
      return this.block('RUNTIME_FAILURE', `Correction attempt ${attempt.correctionAttemptId} has an uncertain prior dispatch after restart; automatic replay is forbidden.`)
    }
    if (attempt.dispatchStatus === 'completed') {
      this.state.nextReviewPhase = 'RECHECKING'
      return this.transition('AWAITING_PRODUCT_QA')
    }
    if (attempt.dispatchStatus === 'responded' && this.state.agentRegistry.active.includes(attempt.identity)) {
      this.state.agentRegistry.active = this.state.agentRegistry.active.filter(identity => identity !== attempt.identity)
      this.persist()
    }
    return this.implement(true, attempt)
  }

  async validate() {
    const checks = []
    for (const definition of this.state.packet.validation) {
      this.ensureActive()
      this.ensureIntegrity()
      const check = await this.validationAdapter.run(definition, { candidateId: this.state.candidateId })
      this.ensureActive()
      this.ensureIntegrity()
      if (!validateValidationResult(check, definition)) return this.block('RUNTIME_FAILURE', `Malformed validation evidence for ${definition.id}.`)
      checks.push(check)
    }
    const outcome = evaluateChecks(checks, this.state.candidateId)
    const result = outcome.ok ? 'pass' : outcome.code === 'VALIDATION_FAILED' ? 'fail' : 'blocked'
    this.state.reports.tests = { result, candidateId: this.state.candidateId, checks }
    this.state.evidenceRefs = this.state.evidenceRefs.filter(reference => reference.type !== 'validation')
    for (const check of checks) {
      if (check.candidateId === this.state.candidateId) this.state.evidenceRefs.push({ id: `validation:${check.id}`, type: 'validation', candidateId: check.candidateId, result: check.result })
    }
    if (!outcome.ok) return this.block(outcome.code, outcome.message)

    this.ensureActive()
    const integrity = this.ensureIntegrity()
    if (integrity.identity !== this.state.candidateId) return this.block('INTEGRITY_FAILURE', 'Final candidate hash does not match actual bytes.')
    this.state.candidateUnstaged = candidateIsUnstaged(this.workspaceRoot)
    if (!this.state.candidateUnstaged) return this.block('WORKSPACE_DRIFT', 'Candidate has staged changes; automatic execution must stop unstaged.')
    const readinessErrors = this.validateReadyHandoff()
    if (readinessErrors.length) return this.block('INTEGRITY_FAILURE', readinessErrors.join(' '))

    const prospective = structuredClone(this.state)
    prospective.phase = 'READY_FOR_HANDOFF'
    prospective.readinessVerified = true
    prospective.revision = this.state.revision + 1
    const artifacts = buildArtifacts(prospective)
    let files
    try {
      const semanticErrors = validateArtifactSet(artifacts, prospective)
      if (semanticErrors.length) throw new Error(`Authoritative semantic validation failed:\n${semanticErrors.join('\n')}`)
      files = this.artifactWriter(this.artifactDirectory, artifacts, prospective)
      const persistedArtifacts = readArtifactDirectory(this.artifactDirectory)
      const persistedErrors = validateArtifactSet(persistedArtifacts, prospective)
      if (persistedErrors.length) throw new Error(`Persisted authoritative semantic validation failed:\n${persistedErrors.join('\n')}`)
    } catch (error) {
      return this.block('INTEGRITY_FAILURE', `Final artifact validation/write failed: ${error.message}`)
    }
    this.ensureActive()
    this.ensureIntegrity()
    this.state.readinessVerified = true
    this.transition('READY_FOR_HANDOFF')
    return { status: this.state.phase, state: structuredClone(this.state), artifacts, files }
  }
}

export function loadRunState(runDirectory) {
  return JSON.parse(readFileSync(resolve(runDirectory, STATE_FILE), 'utf8'))
}
