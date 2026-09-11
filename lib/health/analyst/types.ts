export type AnalystIntent = 'since_last_labs' | 'current_snapshot' | 'protocol_context' | 'largest_changes' | 'missing_data' | 'general'
export type DataConfidence = 'high' | 'medium' | 'low'
export type EvidenceType = 'lab_result' | 'lab_comparison' | 'protocol_event' | 'protocol_state' | 'weight' | 'journal_signal' | 'data_gap'

export type AnalystEvidence = {
  id: string
  type: EvidenceType
  date: string | null
  title: string
  detail: string
  confidence: DataConfidence
  sourceLabel: string
}

export type ContextFact = { text: string; evidenceIds: string[] }
export type HealthAnalystContext = {
  intent: AnalystIntent
  question: string
  asOfDate: string
  scope: string
  facts: ContextFact[]
  evidence: AnalystEvidence[]
  gaps: ContextFact[]
}

export type AnalystFinding = {
  title: string
  detail: string
  evidenceIds: string[]
  confidence: DataConfidence
}

export type HealthAnalysis = {
  summary: string
  findings: AnalystFinding[]
  uncertainties: string[]
  nextObservations: string[]
}

export type AnalystResult = { analysis: HealthAnalysis; evidence: AnalystEvidence[]; intent: AnalystIntent; generatedAt: string }

export interface HealthAnalystProvider {
  generate(context: HealthAnalystContext): Promise<unknown>
}
