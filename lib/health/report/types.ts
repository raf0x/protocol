import type { DataConfidence, HealthAnalysis } from '../analyst/types'

export type ReportRange = '3m' | '6m' | '12m' | 'all'
export type ReportSections = { protocols: boolean; history: boolean; labs: boolean; weight: boolean; journal: boolean }
export type ReportProtocol = { name: string; dose: string; frequency: string | null; route: string | null; startDate: string | null; status: string; verified: boolean }
export type ReportHistoryEvent = { date: string; title: string; detail: string | null; confidence: DataConfidence; source: string }
export type ReportLabPanel = { date: string; name: string; provider: string | null; resultCount: number }
export type ReportLabResult = { date: string; name: string; value: string; reference: string; status: string }
export type ReportTrend = { name: string; unit: string; latestDate: string; previousDate: string; latest: number; previous: number; delta: number; percent: number | null; direction: string; flagged: boolean }
export type ReportWeight = { earliestDate: string; earliest: number; latestDate: string; latest: number; delta: number; points: { date: string; value: number }[] }
export type ReportJournal = { entryCount: number; firstDate: string; lastDate: string; averages: { label: string; value: number; unit: string }[] }
export type ReportTiming = { labDate: string; panel: string; eventDate: string; event: string; timing: string }
export type DoctorReport = {
  generatedAt: string; asOfDate: string; range: ReportRange; periodLabel: string
  currentProtocols: ReportProtocol[]; protocolHistory: ReportHistoryEvent[]
  labPanels: ReportLabPanel[]; highlightedResults: ReportLabResult[]; trends: ReportTrend[]
  weight: ReportWeight | null; journal: ReportJournal | null; protocolLabContext: ReportTiming[]; limitations: string[]
}
export type DoctorReportResponse = { report: DoctorReport; aiSummary: HealthAnalysis | null; aiError: string | null }
