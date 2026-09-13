import { buildLabFindingsSummaryModel, type LabFindingsSummaryModel } from './labFindingsSummary'
import type { BiomarkerHistory, LabPanel } from './labs'
import type { ProtocolOverlayData } from './protocolOverlay'
import { healthStateAtDate, protocolActivityAtDate } from './longitudinal/history'
import { detectInterventions } from './longitudinal/interventions'
import type { Intervention, ProtocolState } from './longitudinal/types'
import type { LabFinding } from './labFindings'

export type BriefingProtocols =
  | { status: 'loading' | 'unavailable'; asOf: string | null }
  | { status: 'ready'; asOf: string; data: ProtocolOverlayData }

export type HealthBriefingModel = {
  state: 'empty' | 'ready'
  currentSnapshot: {
    asOf: string | null
    latestDate: string | null
    latestPanel: Pick<LabPanel, 'id' | 'panel_name' | 'provider'> | null
    biomarkerCount: number | null
    latestPanelCount: number
    protocolStatus: BriefingProtocols['status']
    compounds: ProtocolState[]
    additionalCompounds: number
  }
  findings: LabFindingsSummaryModel
  protocolContext: { items: Intervention[]; additionalCount: number; hasComparison: boolean }
  gaps: { key: string; text: string }[]
  reviewActions: { label: string; href: string }[]
}

/** Context belongs to the union of visible, eligible pairs, never a fabricated
 * min/max window. Same-day events establish no intraday ordering. */
export function briefingInterventions(findings: readonly LabFinding[], interventions: readonly Intervention[]): Intervention[] {
  const windows = findings.flatMap(finding => finding.evidence.comparison ? [finding.evidence.comparison] : [])
  const unique = new Map<string, Intervention>()
  for (const item of interventions) {
    if (windows.some(window => window.previous.date < item.date && item.date < window.current.date) && !unique.has(item.id)) unique.set(item.id, item)
  }
  // ID is only a stable display tie-breaker, never chronology or state resolution.
  return [...unique.values()].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

/** Presentation composition only. No fetching, clock, persistence, new lab
 * arithmetic, protocol replay, or intervention interpretation lives here. */
export function buildHealthBriefing({ panels, histories, protocols }: {
  panels: readonly LabPanel[]
  histories: readonly BiomarkerHistory[]
  protocols: BriefingProtocols
}): HealthBriefingModel {
  const findings = buildLabFindingsSummaryModel(panels, histories)
  const latestPanels = panels.filter(panel => panel.test_date === findings.latestDate)
  const latestPanel = latestPanels.length === 1 ? latestPanels[0] : null
  const source = protocols.status === 'ready' ? { protocols: protocols.data.protocols, protocolEvents: protocols.data.events } : null
  const current = source && protocols.asOf ? healthStateAtDate(source, protocols.asOf) : []
  const windows = findings.headlines.flatMap(finding => finding.evidence.comparison ? [finding.evidence.comparison] : [])
  // Only structured event-backed interventions belong in this concise context.
  // Legacy events and saved phase boundaries remain available in Protocol Changes.
  const structuredIds = new Set(source?.protocolEvents.filter(event => event.metadata?.version === 1).map(event => event.id))
  const interventions = source && protocols.asOf && windows.length
    ? detectInterventions({ ...source, panels: [], journal: [] }, protocols.asOf).filter(item =>
      item.provenance === 'event' && item.sources.some(ref => ref.table === 'protocol_events' && structuredIds.has(ref.id)))
    : []
  const context = briefingInterventions(findings.headlines, interventions)
  const historicalDates = [...new Set(windows.flatMap(window => [window.previous.date, window.current.date]))]
  const historicalStates = source ? historicalDates.flatMap(date => healthStateAtDate(source, date)) : []
  const activityDates = [...new Set([...historicalDates, ...context.map(item => item.date), ...(protocols.asOf ? [protocols.asOf] : [])])]
  const ambiguousActivity = source?.protocols.some(protocol => activityDates.some(date => protocolActivityAtDate(protocol, date, source.protocolEvents) === 'ambiguous'))

  const gaps: HealthBriefingModel['gaps'] = []
  if (protocols.status === 'unavailable') gaps.push({ key: 'protocol_unavailable', text: 'Protocol context is temporarily unavailable.' })
  // Latest-date and insufficient-history states already have one explanation in
  // What changed. Avoid repeating them in this compact gap list.
  if (ambiguousActivity) gaps.push({ key: 'protocol_ambiguous', text: 'Some recorded protocol activity has uncertain timing. No active state is assumed for those intervals.' })
  if (findings.previousPanelAmbiguous) gaps.push({ key: 'previous_panel_ambiguous', text: 'Some older results share the same test date, so new or missing biomarker comparisons are omitted.' })
  if (findings.missingFromLatestCount) gaps.push({ key: 'missing_measurements', text: `${findings.missingFromLatestCount} previously measured ${findings.missingFromLatestCount === 1 ? 'biomarker was' : 'biomarkers were'} not recorded on the latest panel.` })
  if (current.some(item => !item.medication)) gaps.push({ key: 'unconfirmed_dose', text: 'Some current medication doses are not confirmed. Administration details are kept separate.' })
  if (historicalStates.some(item => item.provenance === 'unknown')) gaps.push({ key: 'historical_unknown', text: 'Some historical phase details are not known from the recorded history.' })
  if (historicalStates.some(item => item.provenance === 'saved_plan')) gaps.push({ key: 'historical_plan', text: 'Some protocol history is reconstructed from saved plans rather than recorded change snapshots.' })

  const reviewActions: HealthBriefingModel['reviewActions'] = []
  const first = findings.headlines[0]
  if (first) reviewActions.push({ label: `Review the evidence for ${first.biomarkerName}`, href: `/health?biomarker=${encodeURIComponent(first.biomarkerKey)}` })
  if (context.length) reviewActions.push({ label: 'Review recorded protocol changes', href: '/health?view=changes' })
  if (panels.length) reviewActions.push({ label: 'Create clinician report', href: '/health/report' })
  else if (current.length) reviewActions.push({ label: 'Add your first lab panel', href: '/health?action=add' })

  return {
    state: !panels.length && protocols.status === 'ready' && !source?.protocols.length && !source?.protocolEvents.length ? 'empty' : 'ready',
    currentSnapshot: {
      asOf: protocols.asOf, latestDate: findings.latestDate,
      latestPanel: latestPanel ? { id: latestPanel.id, panel_name: latestPanel.panel_name, provider: latestPanel.provider } : null,
      biomarkerCount: latestPanel?.results.length ?? null, latestPanelCount: latestPanels.length,
      protocolStatus: protocols.status, compounds: current.slice(0, 5), additionalCompounds: Math.max(0, current.length - 5),
    },
    findings,
    protocolContext: { items: context.slice(0, 3), additionalCount: Math.max(0, context.length - 3), hasComparison: windows.length > 0 },
    gaps: gaps.slice(0, 3), reviewActions: reviewActions.slice(0, 3),
  }
}
