import type { GuidedAnalystAction } from './actions'
import type { LongitudinalAnalystEvidence } from '../longitudinal/types'
import type { AnalystDeterministicFinding, AnalystFindingScope } from './findings'
import type { LabComparisonSummary } from '../labEvidence'

export type AnalystIntent = GuidedAnalystAction | 'general'
export type DataConfidence = 'high' | 'medium' | 'low'
export type EvidenceType = 'lab_result' | 'lab_panel' | 'lab_comparison' | 'protocol_event' | 'protocol_state' | 'weight' | 'journal_signal' | 'data_gap' | 'longitudinal_observation'

export type AnalystEvidence = {
  id: string
  type: EvidenceType
  date: string | null
  title: string
  detail: string
  confidence: DataConfidence
  sourceLabel: string
  longitudinal?: LongitudinalAnalystEvidence
  comparison?: LabComparisonSummary
}

export type ContextFact = { text: string; evidenceIds: string[] }
export type HealthAnalystContext = {
  action?: GuidedAnalystAction
  intent: AnalystIntent
  question: string
  asOfDate: string
  scope: string
  facts: ContextFact[]
  evidence: AnalystEvidence[]
  gaps: ContextFact[]
  deterministicFindings?: AnalystDeterministicFinding[]
  currentFindingScope?: AnalystFindingScope
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
