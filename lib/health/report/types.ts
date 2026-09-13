import type { DataConfidence } from '../analyst/types'
import type { LabComparisonSummary, LabGap, LabReading } from '../labEvidence'
import type { LabFinding } from '../labFindings'
import type { BiomarkerCategory } from '../biomarkerIntelligence'
import type { Intervention, ProtocolState } from '../longitudinal/types'

export type ReportRange = '3m' | '6m' | '12m' | 'all'
export type ReportSections = { protocols: boolean; history: boolean; labs: boolean; weight: boolean; journal: boolean }
export type ReportProtocol = { name: string; dose: string; frequency: string | null; route: string | null; startDate: string | null; status: string; verified: boolean }
export type ReportHistoryEvent = { date: string; title: string; detail: string | null; confidence: DataConfidence; source: string }
export type ReportLabPanel = { date: string; name: string; provider: string | null; resultCount: number }
export type ReportLabResult = { date: string; name: string; value: string; reference: string; status: string }
export type ReportTrend = { name: string; unit: string; latestDate: string; previousDate: string; latest: number; previous: number; delta: number; percent: number | null; direction: string; flagged: boolean; comparison?: LabComparisonSummary }
export type ReportWeight = { earliestDate: string; earliest: number; latestDate: string; latest: number; delta: number; points: { date: string; value: number }[] }
export type ReportJournal = { entryCount: number; firstDate: string; lastDate: string; averages: { label: string; value: number; unit: string }[] }
export type ReportTiming = { labDate: string; panel: string; eventDate: string; event: string; timing: string }
export type ReportReading = Pick<LabReading, 'resultId' | 'panelId' | 'date' | 'value' | 'unit' | 'reference'>
export type ReportBiomarkerRow = {
  biomarkerKey: string; name: string; unit: string; readings: ReportReading[]
  latestRecordedDate: string | null; comparison: LabComparisonSummary | null; limitations: LabGap[]
}
export type ReportContextNote =
  | { kind: 'period'; start: string | null; end: string }
  | { kind: 'latest_panel'; date: string }
  | { kind: 'active_items'; count: number; date: string }
  | { kind: 'limitation'; text: string }
export type ReportVerification = { code: string; text: string }
export type ReportReviewItem = ReportVerification & { findingIds: string[] }
export type ReportProtocolTimelineItem = Intervention & {
  contextDate: string
  recordedStates: Pick<ProtocolState, 'protocolId' | 'compoundId' | 'phaseId' | 'name' | 'medication' | 'frequency' | 'route' | 'provenance' | 'sources' | 'limitations'>[]
}
export type ReportIntelligence = {
  contextNotes: ReportContextNote[]
  biomarkerDomains: { category: BiomarkerCategory; rows: ReportBiomarkerRow[] }[]
  protocolTimeline: ReportProtocolTimelineItem[]
  headlineChanges: LabFinding[]
  reviewItems: ReportReviewItem[]
  verification: ReportVerification[]
}
export type DoctorReport = {
  intelligence: ReportIntelligence
  generatedAt: string; asOfDate: string; range: ReportRange; periodLabel: string
  currentProtocols: ReportProtocol[]; protocolHistory: ReportHistoryEvent[]
  labPanels: ReportLabPanel[]; highlightedResults: ReportLabResult[]; trends: ReportTrend[]
  weight: ReportWeight | null; journal: ReportJournal | null; protocolLabContext: ReportTiming[]; limitations: string[]
}
export type ReportAiSummary = { overview: string }
export type DoctorReportResponse = { report: DoctorReport; aiSummary: ReportAiSummary | null; aiError: string | null }
