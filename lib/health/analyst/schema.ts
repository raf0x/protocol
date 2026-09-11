import type { AnalystFinding, DataConfidence, HealthAnalysis } from './types'

export const healthAnalysisSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    findings: { type: 'array', maxItems: 6, items: { type: 'object', additionalProperties: false,
      properties: {
        title: { type: 'string' },
        detail: { type: 'string' },
        evidenceIds: { type: 'array', minItems: 1, maxItems: 8, items: { type: 'string', pattern: '^E[1-9][0-9]*$' } },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      }, required: ['title', 'detail', 'evidenceIds', 'confidence'],
    } },
    uncertainties: { type: 'array', maxItems: 5, items: { type: 'string' } },
    nextObservations: { type: 'array', maxItems: 5, items: { type: 'string' } },
  }, required: ['summary', 'findings', 'uncertainties', 'nextObservations'],
} as const

export class AnalystOutputError extends Error {
  constructor(message: string) { super(message); this.name = 'AnalystOutputError' }
}
const confidence = new Set<DataConfidence>(['high', 'medium', 'low'])
const plainObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
const text = (value: unknown, max: number) => typeof value === 'string' && value.trim().length > 0 && value.length <= max
const stringList = (value: unknown, maxItems: number, maxLength: number): value is string[] => Array.isArray(value)
  && value.length <= maxItems && value.every(item => text(item, maxLength))

function unsafeLanguage(value: string) {
  const normalized = value.toLowerCase()
  if (/\b(?:caused|causes|resulted from|is due to)\b/.test(normalized)) return true
  if (/\b(?:you have|you are diagnosed with|diagnosed as|suffering from)\b/.test(normalized)) return true
  return /\b(?:you should|i recommend|we recommend|you need to)\b[^.!?]{0,100}\b(?:start|stop|increase|decrease|adjust|change|skip)\b[^.!?]{0,80}\b(?:dose|medication|medicine|protocol|drug)\b/.test(normalized)
}

export function validateHealthAnalysis(value: unknown, validEvidenceIds: Set<string>): HealthAnalysis {
  if (!plainObject(value) || !text(value.summary, 900) || !Array.isArray(value.findings)
    || value.findings.length > 6 || !stringList(value.uncertainties, 5, 300)
    || !stringList(value.nextObservations, 5, 300)) throw new AnalystOutputError('The analyst returned an invalid response shape.')
  const findings: AnalystFinding[] = value.findings.map(item => {
    if (!plainObject(item) || !text(item.title, 140) || !text(item.detail, 700)
      || !Array.isArray(item.evidenceIds) || item.evidenceIds.length < 1 || item.evidenceIds.length > 8
      || !item.evidenceIds.every(id => typeof id === 'string' && validEvidenceIds.has(id))
      || typeof item.confidence !== 'string' || !confidence.has(item.confidence as DataConfidence)) {
      throw new AnalystOutputError('The analyst returned a finding without valid evidence.')
    }
    return { title: (item.title as string).trim(), detail: (item.detail as string).trim(), evidenceIds: [...new Set(item.evidenceIds as string[])], confidence: item.confidence as DataConfidence }
  })
  const allText = [value.summary, ...findings.flatMap(item => [item.title, item.detail]), ...value.uncertainties, ...value.nextObservations].join(' ')
  if (unsafeLanguage(allText)) throw new AnalystOutputError('The analyst response did not meet the safety rules.')
  return { summary: (value.summary as string).trim(), findings, uncertainties: value.uncertainties.map(item => item.trim()), nextObservations: value.nextObservations.map(item => item.trim()) }
}
