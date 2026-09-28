import { LIMITS } from './policy.mjs'

export class AgentRuntimeError extends Error {
  constructor(message, code = 'RUNTIME_FAILURE') {
    super(message)
    this.name = 'AgentRuntimeError'
    this.code = code
  }
}

export class AgentRegistry {
  constructor(snapshot = {}) {
    this.identities = new Map(Object.entries(snapshot.identities ?? {}))
    this.nextIdentity = snapshot.nextIdentity ?? 1
    this.active = new Set(snapshot.active ?? [])
  }

  identityFor(role) {
    return this.identities.get(role)
  }

  acquire(role) {
    let identity = this.identities.get(role)
    if (!identity) {
      if (this.identities.size >= LIMITS.maxAgentIdentities) {
        throw new AgentRuntimeError('A fourth agent identity is not allowed.', 'BUDGET_EXHAUSTED')
      }
      identity = `agent-${this.nextIdentity}-${role}`
      this.nextIdentity += 1
      this.identities.set(role, identity)
    }
    if (this.active.has(identity)) throw new AgentRuntimeError(`Agent is already active: ${identity}`)
    if (this.active.size >= LIMITS.maxConcurrentAgents) {
      throw new AgentRuntimeError('A third concurrent agent is not allowed.', 'BUDGET_EXHAUSTED')
    }
    this.active.add(identity)
    return identity
  }

  release(identity) {
    this.active.delete(identity)
  }

  snapshot() {
    return {
      identities: Object.fromEntries(this.identities),
      nextIdentity: this.nextIdentity,
      active: [...this.active],
    }
  }
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value)
}

export class FakeAgentAdapter {
  constructor(script = {}) {
    this.script = script
    this.attemptResponses = new Map()
    this.attemptRequests = new Map()
    this.attemptExecutions = new Map()
  }

  async invoke({ role, ordinal, identity, candidateId, correctionRound = 0, correctionAttemptId }) {
    if (correctionAttemptId) {
      this.attemptRequests.set(correctionAttemptId, (this.attemptRequests.get(correctionAttemptId) ?? 0) + 1)
      if (this.attemptResponses.has(correctionAttemptId)) return clone(this.attemptResponses.get(correctionAttemptId))
      this.attemptExecutions.set(correctionAttemptId, (this.attemptExecutions.get(correctionAttemptId) ?? 0) + 1)
    }
    const entries = this.script[role] ?? []
    const response = entries[ordinal]
    if (response === undefined) throw new AgentRuntimeError(`No scripted ${role} response at ordinal ${ordinal}.`)
    if (response?.failure === 'timeout') throw new AgentRuntimeError(`${role} timed out.`)
    if (response?.failure) throw new AgentRuntimeError(`${role} failed: ${response.failure}`)
    const resolved = typeof response === 'function'
      ? clone(await response({ role, ordinal, identity, candidateId, correctionRound, correctionAttemptId }))
      : clone(response)
    if (correctionAttemptId) this.attemptResponses.set(correctionAttemptId, clone(resolved))
    return resolved
  }

  attemptStats(correctionAttemptId) {
    return {
      requests: this.attemptRequests.get(correctionAttemptId) ?? 0,
      executions: this.attemptExecutions.get(correctionAttemptId) ?? 0,
      responseCached: this.attemptResponses.has(correctionAttemptId),
    }
  }
}

export function assertAgentResponse(response, expectedKind) {
  const isObject = value => value && typeof value === 'object' && !Array.isArray(value)
  const validOperation = operation => {
    if (!isObject(operation)) return false
    const keys = Object.keys(operation)
    if (keys.some(key => !['type', 'path', 'destination', 'content', 'bytesBase64', 'authorized'].includes(key))) return false
    if (!['write', 'delete', 'rename'].includes(operation.type) || typeof operation.path !== 'string' || !operation.path) return false
    if (operation.authorized !== undefined && typeof operation.authorized !== 'boolean') return false
    if (operation.type === 'write') return (typeof operation.content === 'string' && operation.bytesBase64 === undefined)
      || (typeof operation.bytesBase64 === 'string' && operation.content === undefined)
    if (operation.type === 'rename') return typeof operation.destination === 'string' && Boolean(operation.destination)
    return operation.destination === undefined && operation.content === undefined && operation.bytesBase64 === undefined
  }
  if (!isObject(response)) throw new AgentRuntimeError(`Malformed ${expectedKind} response.`)
  if (response.kind !== expectedKind || !['pass', 'fail', 'blocked'].includes(response.result)) {
    throw new AgentRuntimeError(`Malformed ${expectedKind} response.`)
  }
  if (Array.isArray(response.evidence) && response.evidence.length === 0) {
    throw new AgentRuntimeError(`Missing ${expectedKind} evidence.`, 'MISSING_EVIDENCE')
  }
  if (!Array.isArray(response.evidence) || response.evidence.some(reference => typeof reference !== 'string' || !reference)) {
    throw new AgentRuntimeError(`Malformed ${expectedKind} evidence.`)
  }
  if (response.detectedRisk !== undefined && !['low', 'medium', 'high'].includes(response.detectedRisk)) {
    throw new AgentRuntimeError(`Malformed ${expectedKind} detected risk.`)
  }
  for (const key of ['scopeExpansion', 'productionMutation', 'destructiveProductionMutation']) {
    if (response[key] !== undefined && typeof response[key] !== 'boolean') throw new AgentRuntimeError(`Malformed ${expectedKind} ${key}.`)
  }
  if (response.releaseAction !== undefined && !['stage', 'commit', 'push', 'deploy', 'supabase'].includes(response.releaseAction)) {
    throw new AgentRuntimeError(`Malformed ${expectedKind} release action.`)
  }
  for (const key of ['delegation', 'delegate']) {
    if (response[key] !== undefined && (!isObject(response[key]) || typeof response[key].role !== 'string' || !response[key].role || Object.keys(response[key]).some(field => field !== 'role'))) {
      throw new AgentRuntimeError(`Malformed ${expectedKind} delegation.`)
    }
  }
  if (response.findings !== undefined && (!Array.isArray(response.findings) || response.findings.some(finding => typeof finding !== 'string' || !finding))) {
    throw new AgentRuntimeError(`Malformed ${expectedKind} findings.`)
  }
  if (response.criteria !== undefined) {
    if (!Array.isArray(response.criteria) || response.criteria.some(criterion => {
      if (!isObject(criterion)) return true
      const keys = Object.keys(criterion)
      if (keys.some(key => !['id', 'result', 'evidenceRefs'].includes(key))) return true
      return typeof criterion.id !== 'string' || !criterion.id
        || !['pass', 'fail', 'blocked', 'not_run', 'not_required'].includes(criterion.result)
        || !Array.isArray(criterion.evidenceRefs)
        || criterion.evidenceRefs.some(reference => typeof reference !== 'string' || !reference)
    })) throw new AgentRuntimeError(`Malformed ${expectedKind} criterion.`)
  }

  const common = new Set([
    'kind', 'result', 'evidence', 'detectedRisk', 'scopeExpansion', 'releaseAction',
    'productionMutation', 'destructiveProductionMutation', 'delegation', 'delegate', 'criteria',
  ])
  const allowed = new Set(common)
  if (expectedKind === 'implementation') ['candidate', 'productQa'].forEach(key => allowed.add(key))
  if (expectedKind === 'review') ['candidateId', 'findings', 'mutations', 'candidate'].forEach(key => allowed.add(key))
  if (Object.keys(response).some(key => !allowed.has(key))) throw new AgentRuntimeError(`Malformed ${expectedKind} response field.`)

  if (expectedKind === 'implementation') {
    if (!isObject(response.candidate) || Object.keys(response.candidate).some(key => key !== 'operations') || !Array.isArray(response.candidate.operations)) {
      throw new AgentRuntimeError('Malformed implementation candidate.')
    }
    if (response.candidate.operations.some(operation => !validOperation(operation))) throw new AgentRuntimeError('Malformed implementation operation.')
    if (response.productQa !== undefined) {
      if (!isObject(response.productQa) || Object.keys(response.productQa).some(key => !['result', 'producerType', 'evidenceRef'].includes(key))
        || typeof response.productQa.result !== 'string' || typeof response.productQa.producerType !== 'string'
        || (response.productQa.evidenceRef !== undefined && typeof response.productQa.evidenceRef !== 'string')) {
        throw new AgentRuntimeError('Malformed agent product QA assertion.')
      }
    }
  }
  if (expectedKind === 'review' && (typeof response.candidateId !== 'string' || !response.candidateId)) {
    throw new AgentRuntimeError('Malformed review candidate identity.')
  }
  if (expectedKind === 'review') {
    if (response.mutations !== undefined && (!Array.isArray(response.mutations) || response.mutations.some(operation => !validOperation(operation)))) {
      throw new AgentRuntimeError('Malformed reviewer mutation proposal.')
    }
    if (response.candidate !== undefined && (!isObject(response.candidate) || Object.keys(response.candidate).some(key => key !== 'operations')
      || !Array.isArray(response.candidate.operations) || response.candidate.operations.some(operation => !validOperation(operation)))) {
      throw new AgentRuntimeError('Malformed reviewer candidate proposal.')
    }
  }
  return response
}
