import 'server-only'
import { validateHealthAnalysis } from './schema'
import { createHealthAnalystProvider } from './provider'
import type { AnalystResult, HealthAnalystContext, HealthAnalystProvider } from './types'

export async function analyzeHealthContext(context: HealthAnalystContext, provider?: HealthAnalystProvider): Promise<AnalystResult> {
  if (!context.evidence.length) return { intent: context.intent, generatedAt: new Date().toISOString(), evidence: [], analysis: {
    summary: 'There is not enough recorded health data to build an evidence-based analysis yet.', findings: [],
    uncertainties: context.gaps.map(item => item.text).slice(0, 5),
    nextObservations: ['A dated lab result, protocol record, weight, or structured check-in would provide a starting point.'],
  } }
  const analysis = validateHealthAnalysis(await (provider ?? createHealthAnalystProvider()).generate(context), new Set(context.evidence.map(item => item.id)))
  const used = new Set(analysis.findings.flatMap(item => item.evidenceIds))
  return { analysis, evidence: context.evidence.filter(item => used.has(item.id)), intent: context.intent, generatedAt: new Date().toISOString() }
}
