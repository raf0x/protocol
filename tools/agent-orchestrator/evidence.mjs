import { randomUUID } from 'node:crypto'
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { BLOCK_REASONS, LIMITS, RELEASE_ACTIONS, RESULTS, assessPacketRisk, requiredRoles } from './policy.mjs'

const here = dirname(fileURLToPath(import.meta.url))
export const schemasDirectory = resolve(here, 'schemas')

export const ARTIFACT_FILES = Object.freeze({
  task_plan: 'task-plan.json',
  implementation_report: 'implementation-report.json',
  review_report: 'review-report.json',
  test_report: 'test-report.json',
  release_readiness: 'release-readiness.json',
})

function matchesType(value, type) {
  if (type === 'null') return value === null
  if (type === 'array') return Array.isArray(value)
  if (type === 'integer') return Number.isInteger(value)
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value)
  return typeof value === type
}

export function validateJsonSchema(schema, value, path = '$') {
  const errors = []
  const types = schema.type === undefined ? [] : Array.isArray(schema.type) ? schema.type : [schema.type]
  if (types.length && !types.some(type => matchesType(value, type))) return [`${path} must have type ${types.join(' or ')}.`]
  if ('const' in schema && value !== schema.const) errors.push(`${path} must equal ${JSON.stringify(schema.const)}.`)
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} must be one of ${schema.enum.join(', ')}.`)
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path} is too short.`)
    if (schema.pattern && !(new RegExp(schema.pattern)).test(value)) errors.push(`${path} does not match ${schema.pattern}.`)
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${path} is below the minimum.`)
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path} has too few items.`)
    if (schema.uniqueItems && new Set(value.map(item => JSON.stringify(item))).size !== value.length) errors.push(`${path} items must be unique.`)
    if (schema.items) value.forEach((item, index) => errors.push(...validateJsonSchema(schema.items, item, `${path}[${index}]`)))
  }
  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}.${key} is required.`)
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) if (!(key in (schema.properties ?? {}))) errors.push(`${path}.${key} is not allowed.`)
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (key in value) errors.push(...validateJsonSchema(childSchema, value[key], `${path}.${key}`))
    }
  }
  if (schema.anyOf && !schema.anyOf.some(option => validateJsonSchema(option, value, path).length === 0)) {
    errors.push(`${path} does not match any allowed schema.`)
  }
  return errors
}

export function loadSchema(artifactType) {
  const file = ARTIFACT_FILES[artifactType]
  if (!file) throw new Error(`Unknown artifact type: ${artifactType}`)
  return JSON.parse(readFileSync(resolve(schemasDirectory, file.replace('.json', '.schema.json')), 'utf8'))
}

export function validateArtifact(artifact) {
  if (!artifact || !ARTIFACT_FILES[artifact.artifactType]) return ['Unknown artifact type.']
  return validateJsonSchema(loadSchema(artifact.artifactType), artifact)
}

function producer(role, identity) {
  return { role, identity: identity ?? 'coordinator' }
}

function evidenceReferences(state) {
  return (state.evidenceRefs ?? []).map(reference => ({
    id: reference.id,
    type: reference.type,
    candidateId: reference.candidateId ?? null,
    result: RESULTS.includes(reference.result) ? reference.result : 'blocked',
  }))
}

function envelope(state, artifactType, role, identity, result, candidateId = state.candidateId ?? null) {
  return {
    schemaVersion: '1.0.0',
    artifactType,
    taskId: state.packet.taskId,
    runId: state.runId,
    revision: state.revision,
    packetHash: state.packetHash,
    baseCommit: state.baseCommit,
    candidateId,
    producer: producer(role, identity),
    result,
    blockers: state.blockers.map(blocker => ({ code: blocker.code, message: blocker.message })),
    evidenceRefs: evidenceReferences(state),
  }
}

function productQaArtifact(state) {
  if (!state.packet.productQa.required) return {
    result: 'not_required',
    reason: state.packet.productQa.notRequiredReason,
    candidateId: null,
    producerType: 'coordinator',
    evidenceRef: 'packet:product-qa-not-required',
  }
  if (!state.productQaEvidence) return {
    result: 'not_run',
    reason: 'Human product QA evidence was not provided for the current candidate.',
    candidateId: state.candidateId ?? null,
    producerType: 'human',
    evidenceRef: 'missing',
  }
  return {
    result: state.productQaEvidence.result,
    reason: state.productQaEvidence.reason,
    candidateId: state.productQaEvidence.candidateId,
    producerType: state.productQaEvidence.producerType,
    evidenceRef: state.productQaEvidence.evidenceRef,
  }
}

export function buildArtifacts(state) {
  const ready = state.phase === 'READY_FOR_HANDOFF' && state.readinessVerified === true
  const terminalResult = ready ? 'pass' : 'blocked'
  const implementation = state.reports.implementation
  const review = state.reports.review
  const tests = state.reports.tests
  const reviewRequired = state.requiredRoles.includes('reviewer')
  const releaseActions = Object.fromEntries(RELEASE_ACTIONS.map(action => [action, 'outside_v1']))

  return {
    task_plan: {
      ...envelope(state, 'task_plan', 'coordinator', 'coordinator', terminalResult),
      risk: state.packet.risk,
      requiredRoles: state.requiredRoles,
      allowedPaths: state.packet.allowedPaths,
      productQa: productQaArtifact(state),
    },
    implementation_report: {
      ...envelope(state, 'implementation_report', 'implementer', implementation?.producer, implementation?.result ?? 'not_run'),
      changedPaths: Object.keys(state.candidateManifest).sort(),
      operations: implementation?.operations ?? [],
      correctionRound: state.correctionRounds,
    },
    review_report: {
      ...envelope(state, 'review_report', 'reviewer', review?.producer, review?.result ?? (reviewRequired ? 'not_run' : 'not_required')),
      required: reviewRequired,
      correctionRound: state.correctionRounds,
      findings: review?.findings ?? [],
    },
    test_report: {
      ...envelope(state, 'test_report', 'validator', 'fake-validation-adapter', tests?.result ?? 'not_run'),
      checks: tests?.checks ?? [],
    },
    release_readiness: {
      ...envelope(state, 'release_readiness', 'coordinator', 'coordinator', terminalResult),
      readiness: ready ? 'ready_for_handoff' : state.phase === 'CANCELLED' ? 'cancelled' : 'blocked',
      acceptedScopeSatisfied: ready,
      reviewSatisfied: ready && (!reviewRequired || review?.result === 'pass'),
      validationSatisfied: ready && tests?.result === 'pass',
      artifactsConsistent: ready,
      candidateUnstaged: ready && state.candidateUnstaged === true,
      releaseActions,
    },
  }
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

function evidenceFor(state, type) {
  return (state.evidenceRefs ?? []).filter(reference => reference.type === type)
}

export function validateReadinessState(state) {
  const errors = []
  const candidateId = state.candidateId
  const identities = state.agentRegistry?.identities ?? {}
  const calls = state.agentCallCounts ?? {}
  const requests = state.agentInvocationCounts ?? {}
  const requiredChecks = (state.packet.validation ?? []).filter(check => check.required)
  const reportedChecks = state.reports?.tests?.checks ?? []
  const risk = assessPacketRisk(state.packet)
  const approvedRoles = risk.mismatch ? null : requiredRoles(risk.detected, { requireIndependentReview: state.packet.requireIndependentReview })

  if (!candidateId) errors.push('Authoritative candidate identity is missing.')
  if (state.blockers?.length) errors.push('Ready state contains blockers.')
  if (state.candidateUnstaged !== true) errors.push('Candidate is not proven unstaged.')
  if ((state.agentRegistry?.active ?? []).length) errors.push('Ready state retains active agents.')
  const identityValues = Object.values(identities)
  if (!approvedRoles || stable(state.requiredRoles) !== stable(approvedRoles)) errors.push('Required roles do not match approved risk routing.')
  if (identityValues.length > LIMITS.maxAgentIdentities || new Set(identityValues).size !== identityValues.length) errors.push('Agent identity set exceeds limits or contains duplicates.')
  for (const role of state.requiredRoles ?? []) if (typeof identities[role] !== 'string' || !identities[role]) errors.push(`Required ${role} identity is missing.`)

  for (const [role, count] of Object.entries(calls)) if (!Number.isInteger(count) || count < 0) errors.push(`Logical call counter is invalid for ${role}.`)
  for (const [role, count] of Object.entries(requests)) if (!Number.isInteger(count) || count < 0) errors.push(`Adapter-request counter is invalid for ${role}.`)
  for (const role of Object.keys(calls)) if (!identities[role]) errors.push(`Logical call counter has no registered ${role} identity.`)
  for (const role of Object.keys(requests)) if (!identities[role]) errors.push(`Adapter-request counter has no registered ${role} identity.`)
  for (const role of Object.keys(identities)) {
    if (!Number.isInteger(calls[role]) || calls[role] < 0) errors.push(`Registered ${role} identity lacks valid logical-call accounting.`)
    if (!Number.isInteger(requests[role]) || requests[role] < 0) errors.push(`Registered ${role} identity lacks valid physical-request accounting.`)
    if (requests[role] !== calls[role]) errors.push(`Adapter-request count does not match logical calls for ${role}.`)
  }
  const totalCalls = Object.values(calls).reduce((sum, count) => sum + count, 0)
  if (Number.isInteger(state.packet.budget?.maxAgentCalls) && totalCalls > state.packet.budget.maxAgentCalls) errors.push('Logical call budget was exceeded.')
  if (!Number.isInteger(state.correctionRounds) || state.correctionRounds < 0 || state.correctionRounds > LIMITS.maxCorrectionRounds) errors.push('Correction counter is outside policy limits.')
  const attempt = state.correctionAttempt
  if (state.correctionRounds === 0 && attempt !== null) errors.push('Correction attempt contradicts zero completed rounds.')
  if (state.correctionRounds > 0 && (!attempt
    || attempt.dispatchStatus !== 'completed'
    || attempt.executionState !== 'response_persisted'
    || attempt.round !== state.correctionRounds
    || attempt.ordinal !== state.correctionRounds
    || attempt.identity !== identities.implementer
    || attempt.adapterRequests !== 1
    || typeof attempt.correctionAttemptId !== 'string' || !attempt.correctionAttemptId
    || !attempt.response)) errors.push('Correction attempt physical/logical accounting contradicts completed rounds.')

  const implementation = state.reports?.implementation
  if (implementation?.result !== 'pass' || implementation?.producer !== identities.implementer || implementation?.candidateId !== candidateId) {
    errors.push('Implementation report/result/producer/candidate is inconsistent.')
  }
  const implementationEvidence = evidenceFor(state, 'implementation')
  if (!implementationEvidence.length || implementationEvidence.some(reference => reference.result !== 'pass' || reference.candidateId !== candidateId)) {
    errors.push('Required implementation evidence is missing, failed, or stale.')
  }
  if (implementation && implementationEvidence.some(reference => !reference.id.startsWith(`implementation:${implementation.producer}:`))) errors.push('Implementation evidence producer is inconsistent.')
  if ((calls.implementer ?? 0) !== 1 + state.correctionRounds) errors.push('Implementer logical-call count does not match correction history.')

  const architectureRequired = state.requiredRoles?.includes('architect')
  if (architectureRequired) {
    const architecture = state.reports?.architecture
    const architectureEvidence = evidenceFor(state, 'architecture')
    if (architecture?.result !== 'pass' || architecture?.producer !== identities.architect || architecture?.candidateId !== null) errors.push('Required architecture report/producer is inconsistent.')
    if (!architectureEvidence.length || architectureEvidence.some(reference => reference.result !== 'pass' || reference.candidateId !== null)) errors.push('Required architecture evidence is missing or failed.')
    if (architecture && architectureEvidence.some(reference => !reference.id.startsWith(`architecture:${architecture.producer}:`))) errors.push('Architecture evidence producer is inconsistent.')
    if ((calls.architect ?? 0) !== 1) errors.push('Architect logical-call count is inconsistent.')
  }

  const reviewRequired = state.requiredRoles?.includes('reviewer')
  if (reviewRequired) {
    const review = state.reports?.review
    const reviewEvidence = evidenceFor(state, 'review')
    if (review?.result !== 'pass' || review?.producer !== identities.reviewer || review?.candidateId !== candidateId) errors.push('Required review report/result/producer/candidate is inconsistent.')
    if (!reviewEvidence.length || reviewEvidence.some(reference => reference.result !== 'pass' || reference.candidateId !== candidateId)) errors.push('Required review evidence is missing, failed, or stale.')
    if (review && reviewEvidence.some(reference => !reference.id.startsWith(`review:${review.producer}:`))) errors.push('Review evidence producer is inconsistent.')
    if ((calls.reviewer ?? 0) !== 1 + state.correctionRounds) errors.push('Reviewer logical-call count does not match correction history.')
  }

  const tests = state.reports?.tests
  if (tests?.result !== 'pass' || tests?.candidateId !== candidateId) errors.push('Test report result/candidate is inconsistent.')
  const seenChecks = new Map()
  for (const check of reportedChecks) {
    if (seenChecks.has(check.id)) errors.push(`Validation check ${check.id} is duplicated.`)
    seenChecks.set(check.id, check)
    const approved = state.packet.validation.find(definition => definition.id === check.id)
    if (!approved || approved.family !== check.family || approved.required !== check.required) errors.push(`Validation check ${check.id} is not the approved task-plan check.`)
  }
  for (const definition of requiredChecks) {
    const check = seenChecks.get(definition.id)
    if (!check) errors.push(`Required validation check ${definition.id} is missing.`)
    else if (check.result !== 'pass' || check.rawOutcome !== undefined || check.candidateId !== candidateId) errors.push(`Required validation check ${definition.id} is not a current pass.`)
    const references = (state.evidenceRefs ?? []).filter(reference => reference.id === `validation:${definition.id}` && reference.type === 'validation')
    if (references.length !== 1 || references[0].result !== 'pass' || references[0].candidateId !== candidateId) errors.push(`Required validation evidence reference ${definition.id} is missing, failed, or stale.`)
  }
  for (const check of reportedChecks) {
    const references = (state.evidenceRefs ?? []).filter(reference => reference.id === `validation:${check.id}` && reference.type === 'validation')
    if (references.length !== 1 || references[0].result !== check.result || references[0].candidateId !== check.candidateId) errors.push(`Validation evidence reference ${check.id} does not resolve to its authoritative check.`)
  }

  if (state.packet.productQa.required) {
    const qa = state.productQaEvidence
    const qaReferences = evidenceFor(state, 'product_qa')
    if (!qa || qa.taskId !== state.packet.taskId || qa.runId !== state.runId || qa.packetHash !== state.packetHash || qa.candidateId !== candidateId || qa.producerType !== 'human' || qa.result !== 'pass') {
      errors.push('Required human product QA is missing, failed, or stale.')
    }
    if (!qaReferences.length || qaReferences.some(reference => reference.result !== 'pass' || reference.candidateId !== candidateId)) errors.push('Required human-QA evidence reference is missing, failed, or stale.')
    if (qa && (qaReferences.length !== 1 || qaReferences[0].id !== qa.evidenceRef)) errors.push('Human-QA evidence reference does not resolve to the authoritative gate evidence.')
  } else if (typeof state.packet.productQa.notRequiredReason !== 'string' || !state.packet.productQa.notRequiredReason) errors.push('Product QA may be not_required only with an approved reason.')
  const allowedEvidenceTypes = new Set([
    'implementation',
    ...(architectureRequired ? ['architecture'] : []),
    ...(reviewRequired ? ['review'] : []),
    'validation',
    ...(state.packet.productQa.required ? ['product_qa'] : []),
  ])
  const evidenceIds = (state.evidenceRefs ?? []).map(reference => reference.id)
  if (new Set(evidenceIds).size !== evidenceIds.length) errors.push('Authoritative evidence reference ids are not unique.')
  for (const reference of state.evidenceRefs ?? []) if (!allowedEvidenceTypes.has(reference.type)) errors.push(`Evidence ${reference.id} is not required by the approved ready plan.`)
  return errors
}

export function validateArtifactSetSchema(artifacts) {
  const errors = []
  const expectedTypes = Object.keys(ARTIFACT_FILES)
  if (!artifacts || typeof artifacts !== 'object' || Array.isArray(artifacts)) return ['Artifact set must be an object.']
  if (stable(Object.keys(artifacts).sort()) !== stable(expectedTypes.sort())) errors.push('Artifact set does not contain exactly the five required types.')
  for (const type of expectedTypes) {
    const artifact = artifacts[type]
    if (!artifact) continue
    errors.push(...validateArtifact(artifact).map(error => `${type}: ${error}`))
    if (artifact.artifactType !== type) errors.push(`${type}: artifact type does not match filename.`)
  }
  return errors
}

export function validateArtifactSet(artifacts, expectedState) {
  if (!expectedState || typeof expectedState !== 'object' || !expectedState.packet) return ['Authoritative state is required for semantic validation.']
  const errors = validateArtifactSetSchema(artifacts)
  if (errors.length) return errors
  const expectedTypes = Object.keys(ARTIFACT_FILES)
  for (const type of expectedTypes) {
    const artifact = artifacts[type]
    for (const key of ['taskId', 'runId', 'packetHash', 'baseCommit', 'candidateId', 'revision']) {
      const expected = key === 'taskId' ? expectedState.packet.taskId : expectedState[key]
      if (artifact[key] !== expected) errors.push(`${type}: ${key} does not match authoritative state.`)
    }
  }
  if (expectedState.phase === 'READY_FOR_HANDOFF') errors.push(...validateReadinessState(expectedState).map(error => `state: ${error}`))
  const envelopes = expectedTypes.map(type => artifacts[type]).filter(Boolean)
  if (envelopes.length) {
    const evidence = stable(envelopes[0].evidenceRefs)
    const blockers = stable(envelopes[0].blockers)
    for (const artifact of envelopes.slice(1)) {
      if (stable(artifact.evidenceRefs) !== evidence) errors.push(`${artifact.artifactType}: cross-artifact evidence references differ.`)
      if (stable(artifact.blockers) !== blockers) errors.push(`${artifact.artifactType}: cross-artifact blockers differ.`)
    }
    const ids = envelopes[0].evidenceRefs.map(reference => reference.id)
    if (new Set(ids).size !== ids.length) errors.push('Cross-artifact evidence reference ids are not unique.')
    for (const reference of envelopes[0].evidenceRefs) {
      if (reference.type !== 'architecture' && reference.candidateId !== null && reference.candidateId !== envelopes[0].candidateId) {
        errors.push(`Evidence ${reference.id} is bound to another candidate.`)
      }
    }
    if (expectedState && stable(envelopes[0].evidenceRefs) !== stable(evidenceReferences(expectedState))) errors.push('Artifact evidence references do not match authoritative state.')
    if (expectedState && stable(envelopes[0].blockers) !== stable(expectedState.blockers ?? [])) errors.push('Artifact blockers do not match authoritative state.')
  }
  if (expectedState && artifacts.task_plan && expectedState.packet.productQa.required) {
    const qa = artifacts.task_plan.productQa
    if (expectedState.phase === 'READY_FOR_HANDOFF' && (qa.result !== 'pass' || qa.producerType !== 'human' || qa.candidateId !== expectedState.candidateId)) {
      errors.push('task_plan: product QA is not bound to the ready candidate.')
    }
  }
  if (expectedState?.phase === 'READY_FOR_HANDOFF' && artifacts.test_report) {
    for (const check of artifacts.test_report.checks) {
      if (check.candidateId !== expectedState.candidateId) errors.push(`test_report: ${check.id} is bound to another candidate.`)
    }
  }
  if (expectedState && artifacts.release_readiness) {
    const release = artifacts.release_readiness
    const ready = expectedState.phase === 'READY_FOR_HANDOFF' && expectedState.readinessVerified === true
    const expectedReadiness = ready ? 'ready_for_handoff' : expectedState.phase === 'CANCELLED' ? 'cancelled' : 'blocked'
    const expectedResult = ready ? 'pass' : 'blocked'
    if (release.result !== expectedResult || release.readiness !== expectedReadiness
      || release.acceptedScopeSatisfied !== ready
      || release.reviewSatisfied !== (ready && (!expectedState.requiredRoles.includes('reviewer') || expectedState.reports?.review?.result === 'pass'))
      || release.validationSatisfied !== (ready && expectedState.reports?.tests?.result === 'pass')
      || release.artifactsConsistent !== ready
      || release.candidateUnstaged !== (ready && expectedState.candidateUnstaged === true)) {
      errors.push('release_readiness: result/status/flags contradict authoritative state.')
    }
  }
  if (expectedState && artifacts.implementation_report) {
    const report = artifacts.implementation_report
    const expected = expectedState.reports?.implementation
    if (report.result !== (expected?.result ?? 'not_run')) errors.push('implementation_report: result contradicts authoritative state.')
    if (expected && report.candidateId !== expected.candidateId) errors.push('implementation_report: candidate contradicts authoritative state.')
    if (expected && (report.producer.role !== 'implementer' || report.producer.identity !== expected.producer)) errors.push('implementation_report: producer contradicts authoritative state.')
    if (report.correctionRound !== expectedState.correctionRounds) errors.push('implementation_report: correctionRound contradicts authoritative state.')
    if (stable(report.changedPaths) !== stable(Object.keys(expectedState.candidateManifest ?? {}).sort())) errors.push('implementation_report: changedPaths contradict authoritative manifest.')
    if (stable(report.operations) !== stable(expected?.operations ?? [])) errors.push('implementation_report: operations contradict authoritative state.')
  }
  if (expectedState && artifacts.review_report) {
    const report = artifacts.review_report
    const expected = expectedState.reports?.review
    const reviewRequired = expectedState.requiredRoles.includes('reviewer')
    const expectedResult = expected?.result ?? (expectedState.requiredRoles.includes('reviewer') ? 'not_run' : 'not_required')
    if (report.result !== expectedResult) errors.push('review_report: verdict contradicts authoritative state.')
    if (expected && (report.producer.role !== 'reviewer' || report.producer.identity !== expected.producer)) errors.push('review_report: producer contradicts authoritative state.')
    if (report.required !== reviewRequired) errors.push('review_report: required status contradicts approved routing.')
    if (report.correctionRound !== expectedState.correctionRounds) errors.push('review_report: correctionRound contradicts authoritative state.')
    if (stable(report.findings) !== stable(expected?.findings ?? [])) errors.push('review_report: findings contradict authoritative state.')
  }
  if (expectedState && artifacts.test_report) {
    const report = artifacts.test_report
    const expected = expectedState.reports?.tests
    if (report.result !== (expected?.result ?? 'not_run')) errors.push('test_report: result contradicts authoritative state.')
    if (stable(report.checks) !== stable(expected?.checks ?? [])) errors.push('test_report: checks contradict authoritative state.')
    if (report.producer.role !== 'validator' || report.producer.identity !== 'fake-validation-adapter') errors.push('test_report: producer contradicts authoritative validation.')
  }
  if (expectedState && artifacts.task_plan) {
    const ready = expectedState.phase === 'READY_FOR_HANDOFF' && expectedState.readinessVerified === true
    if (artifacts.task_plan.result !== (ready ? 'pass' : 'blocked')) errors.push('task_plan: result contradicts authoritative state.')
    if (artifacts.task_plan.producer.role !== 'coordinator' || artifacts.task_plan.producer.identity !== 'coordinator') errors.push('task_plan: producer contradicts authoritative coordinator.')
    if (stable(artifacts.task_plan.requiredRoles) !== stable(expectedState.requiredRoles)) errors.push('task_plan: required roles contradict authoritative state.')
    if (artifacts.task_plan.risk !== expectedState.packet.risk) errors.push('task_plan: risk contradicts approved packet.')
    if (stable(artifacts.task_plan.allowedPaths) !== stable(expectedState.packet.allowedPaths)) errors.push('task_plan: allowed paths contradict approved packet.')
    if (stable(artifacts.task_plan.productQa) !== stable(productQaArtifact(expectedState))) errors.push('task_plan: product QA contradicts authoritative state and approved plan.')
  }
  if (expectedState && artifacts.release_readiness
    && (artifacts.release_readiness.producer.role !== 'coordinator' || artifacts.release_readiness.producer.identity !== 'coordinator')) {
    errors.push('release_readiness: producer contradicts authoritative coordinator.')
  }
  return errors
}

function durableJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const temporary = `${path}.tmp-${randomUUID()}`
  const descriptor = openSync(temporary, 'wx', 0o600)
  try {
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
    fsyncSync(descriptor)
  } finally {
    closeSync(descriptor)
  }
  renameSync(temporary, path)
}

export function writeArtifacts(directory, artifacts, expectedState) {
  const errors = validateArtifactSet(artifacts, expectedState)
  if (errors.length) throw new Error(`Artifact validation failed:\n${errors.join('\n')}`)
  mkdirSync(directory, { recursive: true })
  for (const [type, artifact] of Object.entries(artifacts)) durableJson(resolve(directory, ARTIFACT_FILES[type]), artifact)
  return Object.values(ARTIFACT_FILES).map(file => resolve(directory, file))
}

export function readArtifactDirectory(directory) {
  const artifacts = {}
  for (const [type, file] of Object.entries(ARTIFACT_FILES)) {
    const path = resolve(directory, file)
    if (!existsSync(path)) continue
    artifacts[type] = JSON.parse(readFileSync(path, 'utf8'))
  }
  return artifacts
}

export function validateArtifactDirectorySchema(directory) {
  const results = {}
  let artifacts = {}
  try { artifacts = readArtifactDirectory(directory) } catch (error) { results.directory = [`Artifact JSON could not be read: ${error.message}`] }
  for (const [type] of Object.entries(ARTIFACT_FILES)) {
    results[type] = artifacts[type] ? validateArtifact(artifacts[type]) : ['Artifact is missing.']
  }
  results.schema = validateArtifactSetSchema(artifacts)
  return results
}

export function validateArtifactDirectory(directory, expectedState) {
  const results = validateArtifactDirectorySchema(directory)
  let artifacts = {}
  try { artifacts = readArtifactDirectory(directory) } catch { /* Schema results contain the read error. */ }
  results.semantic = validateArtifactSet(artifacts, expectedState)
  return results
}

export const schemaConstants = Object.freeze({ BLOCK_REASONS, RESULTS, RELEASE_ACTIONS })
