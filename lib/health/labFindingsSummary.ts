import { buildLabTrajectory, labPanelMembership, toLabEvidenceObservation } from './labEvidence'
import { deriveLabFindings, selectHeadlineFindings, type LabFinding } from './labFindings'
import type { BiomarkerHistory, LabPanel } from './labs'
import { meaningfulConsumerFinding } from './labFindingPresentation'

const MAX_HEADLINES = 4

export type LabFindingsSummaryModel = {
  state: 'empty' | 'insufficient' | 'ambiguous_latest' | 'ready'
  latestDate: string | null
  latestPanelId: string | null
  headlines: LabFinding[]
  totalFindingsCount: number
  newlyMeasuredCount: number
  missingFromLatestCount: number
  previousPanelAmbiguous: boolean
}

/** The shared current-panel anchor, before any consumer headline cap/collapse. */
export type CurrentLabFindingSet = {
  state: LabFindingsSummaryModel['state']
  latestDate: string | null
  previousDate: string | null
  latestPanelId: string | null
  previousPanelId: string | null
  previousPanelAmbiguous: boolean
  findings: LabFinding[]
}

export function deriveCurrentLabFindingSet(
  panels: readonly LabPanel[],
  histories: readonly BiomarkerHistory[],
): CurrentLabFindingSet {
  const empty: CurrentLabFindingSet = {
    state: 'empty', latestDate: null, previousDate: null,
    latestPanelId: null, previousPanelId: null, previousPanelAmbiguous: false, findings: [],
  }
  if (!panels.length) return empty
  const dates = [...new Set(panels.map(panel => panel.test_date))].sort((a, b) => b.localeCompare(a))
  const latestDate = dates[0]
  const latestPanels = panels.filter(panel => panel.test_date === latestDate)
  if (latestPanels.length !== 1) return { ...empty, state: 'ambiguous_latest', latestDate }
  const currentPanel = latestPanels[0]
  if (dates.length < 2) return { ...empty, state: 'insufficient', latestDate, latestPanelId: currentPanel.id }
  const previousDate = dates[1]
  const previousPanels = panels.filter(panel => panel.test_date === previousDate)
  const previousPanel = previousPanels.length === 1 ? previousPanels[0] : null
  const series = histories.flatMap(history => history.units.map(group => ({
    biomarkerKey: history.key,
    biomarkerName: history.name,
    unit: group.unit,
    trajectory: (() => {
      const trajectory = buildLabTrajectory(group.observations.map(row => toLabEvidenceObservation(row, history.key)))
      if (history.units.length > 1) trajectory.limitations.push('incompatible_unit')
      return trajectory
    })(),
  })))
  const memberships = previousPanel ? labPanelMembership([...histories], currentPanel.id, previousPanel.id) : []
  const findings = deriveLabFindings({ series, memberships }).filter(finding =>
    finding.evidence.current?.panelId === currentPanel.id
    || finding.evidence.membership?.currentPanelId === currentPanel.id)
  return { state: 'ready', latestDate, previousDate, latestPanelId: currentPanel.id,
    previousPanelId: previousPanel?.id ?? null, previousPanelAmbiguous: previousPanels.length > 1, findings }
}

/** Presentation only: Findings V1 still owns precedence, priority and ordering. */
export function buildLabFindingsSummaryModel(
  panels: readonly LabPanel[],
  histories: readonly BiomarkerHistory[],
  limit = MAX_HEADLINES,
): LabFindingsSummaryModel {
  const current = deriveCurrentLabFindingSet(panels, histories)
  const currentFindings = current.findings
  const missingFromLatestCount = currentFindings.filter(finding => finding.type === 'missing_from_latest_panel').length
  const newlyMeasured = currentFindings.filter(finding => finding.type === 'newly_measured')
  const headlinePool = currentFindings.filter(finding => finding.type !== 'missing_from_latest_panel' && meaningfulConsumerFinding(finding))
  const selected = selectHeadlineFindings(headlinePool, Math.max(limit * 2, limit))
  let keptNewlyMeasured = false
  const headlines = selected.filter(finding => {
    if (finding.type !== 'newly_measured') return true
    if (keptNewlyMeasured) return false
    keptNewlyMeasured = true
    return true
  }).slice(0, limit)
  return { state: current.state, latestDate: current.latestDate, latestPanelId: current.latestPanelId, headlines,
    totalFindingsCount: headlinePool.length,
    newlyMeasuredCount: newlyMeasured.length, missingFromLatestCount,
    previousPanelAmbiguous: current.previousPanelAmbiguous }
}
