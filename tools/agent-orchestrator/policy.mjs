import { isAbsolute, posix, win32 } from 'node:path'

export const LIMITS = Object.freeze({
  maxConcurrentAgents: 2,
  maxAgentIdentities: 3,
  maxCorrectionRounds: 2,
})

export const TERMINAL_STATES = Object.freeze([
  'READY_FOR_HANDOFF',
  'BLOCKED',
  'CANCELLED',
])

export const BLOCK_REASONS = Object.freeze([
  'SCOPE_EXPANSION',
  'UNAUTHORIZED_PATH',
  'RISK_MISMATCH',
  'PRODUCT_DECISION_REQUIRED',
  'MISSING_EVIDENCE',
  'REVIEW_LIMIT',
  'VALIDATION_FAILED',
  'RELEASE_AUTHORIZATION_ABSENT',
  'DESTRUCTIVE_OR_PRODUCTION_MUTATION',
  'BUDGET_EXHAUSTED',
  'RUNTIME_FAILURE',
  'INTEGRITY_FAILURE',
  'WORKSPACE_DRIFT',
])

export const RESULTS = Object.freeze(['pass', 'fail', 'blocked', 'not_run', 'not_required'])
export const RELEASE_ACTIONS = Object.freeze(['stage', 'commit', 'push', 'deploy', 'supabase'])

const RISK_ORDER = Object.freeze({ low: 0, medium: 1, high: 2 })
const HIGH_RISK_AREAS = new Set([
  'auth',
  'authorization',
  'owner_scoping',
  'medical_calculation',
  'privacy',
  'schema',
  'migrations',
  'payments',
  'destructive_operations',
  'deployment_configuration',
])

const WINDOWS_RESERVED_NAME = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i

export function compareRisk(left, right) {
  if (!(left in RISK_ORDER) || !(right in RISK_ORDER)) throw new Error('Risk must be low, medium, or high.')
  return RISK_ORDER[left] - RISK_ORDER[right]
}

export function classifyRisk({ requestedRisk = 'low', userFacing = false, areas = [] } = {}) {
  if (!(requestedRisk in RISK_ORDER)) throw new Error(`Unsupported risk: ${requestedRisk}`)
  if (areas.some(area => HIGH_RISK_AREAS.has(area))) return 'high'
  if (userFacing && compareRisk(requestedRisk, 'medium') < 0) return 'medium'
  return requestedRisk
}

export function requiredRoles(risk, { requireIndependentReview = false } = {}) {
  const routes = {
    low: ['implementer'],
    medium: ['implementer', 'reviewer'],
    high: ['architect', 'implementer', 'reviewer'],
  }
  if (!routes[risk]) throw new Error(`Unsupported risk: ${risk}`)
  const roles = [...routes[risk]]
  if (requireIndependentReview && !roles.includes('reviewer')) roles.push('reviewer')
  return roles
}

function hasWindowsRoot(path) {
  return win32.isAbsolute(path) || /^[a-z]:/i.test(path) || /^[/\\]{2}/.test(path)
}

export function normalizeRelativePath(input) {
  if (typeof input !== 'string' || input.length === 0) throw new Error('Path must be a non-empty string.')
  if (input.includes('\0')) throw new Error('NUL bytes are not allowed in paths.')
  if (isAbsolute(input) || hasWindowsRoot(input)) throw new Error(`Absolute paths are not allowed: ${input}`)

  const segments = input.split(/[\\/]+/)
  if (segments.some(segment => segment === '..')) throw new Error(`Path traversal is not allowed: ${input}`)
  if (segments.some(segment => segment === '' || segment === '.')) throw new Error(`Ambiguous path segments are not allowed: ${input}`)
  if (segments.some(segment => segment.endsWith('.') || segment.endsWith(' '))) {
    throw new Error(`Windows trailing-dot/space aliases are not allowed: ${input}`)
  }
  if (segments.some(segment => segment.includes(':') || WINDOWS_RESERVED_NAME.test(segment))) {
    throw new Error(`Windows aliases are not allowed: ${input}`)
  }

  const normalized = posix.normalize(segments.join('/'))
  if (normalized.split('/').some(segment => segment.toLowerCase() === '.git')) {
    throw new Error(`Git metadata is not writable: ${input}`)
  }
  return normalized
}

function normalizedRule(rule) {
  return normalizeRelativePath(rule.replace(/\/\*\*$/, '/placeholder')).replace(/\/placeholder$/, '')
}

function allowedMatch(path, rule) {
  const canonical = normalizedRule(rule)
  if (rule.endsWith('/**')) return path.startsWith(`${canonical}/`)
  return path === canonical
}

export function assertAllowedPath(path, allowedPaths) {
  const normalized = normalizeRelativePath(path)
  if (!Array.isArray(allowedPaths)) throw new Error('Approved write scope is missing.')
  const caseInsensitive = allowedPaths.find(rule => {
    const canonical = normalizedRule(rule)
    return rule.endsWith('/**')
      ? normalized.toLowerCase().startsWith(`${canonical.toLowerCase()}/`)
      : normalized.toLowerCase() === canonical.toLowerCase()
  })
  if (caseInsensitive && !allowedMatch(normalized, caseInsensitive)) {
    throw new Error(`Case-insensitive Windows alias does not match approved casing: ${path}`)
  }
  if (!allowedPaths.some(rule => allowedMatch(normalized, rule))) {
    throw new Error(`Path is outside the approved write scope: ${path}`)
  }
  return normalized
}

export function assessPacketRisk(packet) {
  const detected = classifyRisk({
    requestedRisk: packet.risk,
    userFacing: packet.userFacing,
    areas: packet.riskAreas,
  })
  return {
    approved: packet.risk,
    detected,
    mismatch: compareRisk(detected, packet.risk) > 0,
  }
}
