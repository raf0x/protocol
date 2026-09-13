import { buildLabTrajectory, labPanelMembership, toLabEvidenceObservation } from './labEvidence'
import { deriveLabFindings, selectHeadlineFindings, type LabFinding } from './labFindings'
import type { BiomarkerHistory, LabPanel } from './labs'

const MAX_HEADLINES = 4

export type LabFindingsSummaryModel = {
  state: 'empty' | 'insufficient' | 'ambiguous_latest' | 'ready'
  latestDate: string | null
  headlines: LabFinding[]
  newlyMeasuredCount: number
  missingFromLatestCount: number
  previousPanelAmbiguous: boolean
}

/**
 * Presentation model only. Comparison eligibility, range transitions, priority,
 * precedence and ordering remain owned by Shared Lab Evidence + Findings V1.
 */
export function buildLabFindingsSummaryModel(
  panels: readonly LabPanel[],
  histories: readonly BiomarkerHistory[],
  limit = MAX_HEADLINES,
): LabFindingsSummaryModel {
  if (!panels.length) return {
    state: 'empty', latestDate: null, headlines: [], newlyMeasuredCount: 0,
    missingFromLatestCount: 0, previousPanelAmbiguous: false,
  }

  const dates = [...new Set(panels.map(panel => panel.test_date))].sort((a, b) => b.localeCompare(a))
  const latestDate = dates[0]
  const latestPanels = panels.filter(panel => panel.test_date === latestDate)
  if (latestPanels.length !== 1) return {
    state: 'ambiguous_latest', latestDate, headlines: [], newlyMeasuredCount: 0,
    missingFromLatestCount: 0, previousPanelAmbiguous: false,
  }
  if (dates.length < 2) return {
    state: 'insufficient', latestDate, headlines: [], newlyMeasuredCount: 0,
    missingFromLatestCount: 0, previousPanelAmbiguous: false,
  }

  const currentPanel = latestPanels[0]
  const previousDate = dates[1]
  const previousPanels = panels.filter(panel => panel.test_date === previousDate)
  const previousPanel = previousPanels.length === 1 ? previousPanels[0] : null

  const series = histories.flatMap(history => history.units.map(group => ({
    biomarkerKey: history.key,
    biomarkerName: history.name,
    unit: group.unit,
    trajectory: buildLabTrajectory(group.observations.map(row => toLabEvidenceObservation(row, history.key))),
  })))
  const memberships = previousPanel ? labPanelMembership([...histories], currentPanel.id, previousPanel.id) : []
  const findings = deriveLabFindings({ series, memberships })

  // A latest-panel briefing must never promote an older series merely because it
  // has an eligible historical pair. Membership facts are anchored to currentPanel.
  const currentFindings = findings.filter(finding =>
    finding.evidence.current?.panelId === currentPanel.id
    || finding.evidence.membership?.currentPanelId === currentPanel.id)

  const missingFromLatestCount = currentFindings.filter(finding => finding.type === 'missing_from_latest_panel').length
  const newlyMeasured = currentFindings.filter(finding => finding.type === 'newly_measured')
  const headlinePool = currentFindings.filter(finding => finding.type !== 'missing_from_latest_panel')

  // Findings V1 owns ranking. Presentation only collapses repeated newly-measured
  // cards so informational coverage does not crowd out the briefing.
  const selected = selectHeadlineFindings(headlinePool, Math.max(limit * 2, limit))
  let keptNewlyMeasured = false
  const headlines = selected.filter(finding => {
    if (finding.type !== 'newly_measured') return true
    if (keptNewlyMeasured) return false
    keptNewlyMeasured = true
    return true
  }).slice(0, limit)

  return {
    state: 'ready',
    latestDate,
    headlines,
    newlyMeasuredCount: newlyMeasured.length,
    missingFromLatestCount,
    previousPanelAmbiguous: previousPanels.length > 1,
  }
}

