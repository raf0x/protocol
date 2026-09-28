const ALLOWED_FAMILIES = new Set([
  'validate:focused',
  'validate:types',
  'validate:regression',
  'validate:build',
  'validate:browser',
  'validate:git',
])

const FAILURE_RESULTS = new Set(['fail', 'timeout', 'cancelled', 'skipped'])

export class FakeValidationAdapter {
  constructor(script = {}) {
    this.script = script
  }

  async run(check, { candidateId }) {
    if (check.family === 'validate:git') {
      return {
        id: check.id,
        family: check.family,
        required: check.required,
        result: 'not_run',
        candidateId,
        details: 'Exact staged-file validation requires later human-authorized staging.',
      }
    }
    const scripted = this.script[check.id]
    if (scripted === undefined) return {
      id: check.id,
      family: check.family,
      required: check.required,
      result: 'not_run',
      candidateId,
      details: 'No scripted evidence.',
    }
    const result = typeof scripted === 'function' ? await scripted({ check, candidateId }) : structuredClone(scripted)
    const rawOutcome = ['timeout', 'cancelled', 'skipped'].includes(result.result) ? result.result : result.rawOutcome
    return {
      id: check.id,
      family: check.family,
      required: check.required,
      ...(rawOutcome ? { rawOutcome, result: 'not_run' } : {}),
      ...(!rawOutcome ? { result: result.result ?? 'not_run' } : {}),
      candidateId: result.candidateId ?? candidateId,
      details: result.details ?? `Synthetic ${result.result ?? 'not_run'} result.`,
    }
  }
}

export function validateCheckDefinition(check) {
  if (!check || typeof check.id !== 'string' || !ALLOWED_FAMILIES.has(check.family)) {
    throw new Error('Validation checks require an id and approved command family.')
  }
  if (typeof check.required !== 'boolean') throw new Error(`Validation check ${check.id} must declare required.`)
  if (!check.required && (typeof check.notRequiredReason !== 'string' || !check.notRequiredReason)) {
    throw new Error(`Validation check ${check.id} needs an approved not-required reason.`)
  }
  if (check.family === 'validate:git' && check.required) {
    throw new Error('validate:git cannot be automatically required before human-authorized staging.')
  }
  return check
}

export function evaluateChecks(checks, candidateId) {
  for (const check of checks) {
    if (check.candidateId !== candidateId) {
      return { ok: false, code: 'INTEGRITY_FAILURE', message: `Validation evidence is stale for ${check.id}.` }
    }
    if (!check.required) continue
    if (check.result === 'pass') continue
    const outcome = check.rawOutcome ?? check.result
    if (FAILURE_RESULTS.has(outcome)) {
      return { ok: false, code: outcome === 'fail' ? 'VALIDATION_FAILED' : 'MISSING_EVIDENCE', message: `Required check ${check.id} did not pass: ${outcome}.` }
    }
    return { ok: false, code: 'MISSING_EVIDENCE', message: `Required check ${check.id} has no passing evidence.` }
  }
  return { ok: true }
}

export const REAL_VALIDATION_COMMANDS = Object.freeze({
  focused: ['npm', ['run', 'validate:focused', '--']],
  types: ['npm', ['run', 'validate:types']],
  regression: ['npm', ['run', 'validate:regression']],
  build: ['npm', ['run', 'validate:build']],
  browser: ['npm', ['run', 'validate:browser', '--']],
  git: ['npm', ['run', 'validate:git', '--']],
})
