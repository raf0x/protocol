import { biomarkerCategories } from '../biomarkerIntelligence'
import { buildLabTrajectory, labComparisonSummary, labGapText, toLabEvidenceObservation, type LabGap, type LabTrajectory } from '../labEvidence'
import { selectHeadlineFindings } from '../labFindings'
import { deriveCurrentLabFindingSet } from '../labFindingsSummary'
import type { BiomarkerHistory, LabPanel } from '../labs'
import { healthStateAtDate, protocolActivityAtDate } from '../longitudinal/history'
import { detectInterventions } from '../longitudinal/interventions'
import type { LongitudinalSource, ProtocolState } from '../longitudinal/types'
import type { ReportBiomarkerRow, ReportContextNote, ReportIntelligence, ReportReading, ReportReviewItem, ReportVerification } from './types'

/** Compact chronology, never a second comparator policy. The recorded-pair
 * comparison remains authoritative even when older eligible dates are shown. */
function selectedReadings(trajectory: LabTrajectory): ReportReading[] {
  const selected = new Map<string, NonNullable<LabTrajectory['latest']>>()
  const add = (row: LabTrajectory['latest']) => { if (row) selected.set(row.date, row) }
  add(trajectory.latest)
  add(trajectory.latestRecordedPair.comparison?.previous ?? null)
  add(trajectory.earliest)
  // Lower middle remaining date: chronology only, independent of values or IDs.
  const intermediate = trajectory.ordered.filter(row => !selected.has(row.date))
  if (intermediate.length) add(intermediate[Math.floor((intermediate.length - 1) / 2)])
  return [...selected.values()].sort((a, b) => a.date.localeCompare(b.date)).map(row => ({
    resultId: row.resultId, panelId: row.panelId, date: row.date, value: row.value,
    unit: row.unit, reference: { ...row.reference },
  }))
}

/** Pure projection of already owner-scoped data. Labs are period-scoped by the
 * caller; full loaded protocol history is retained for canonical replay. */
export function buildReportIntelligence(
  source: LongitudinalSource,
  panels: LabPanel[],
  histories: BiomarkerHistory[],
  currentState: ProtocolState[],
  start: string | null,
  today: string,
): ReportIntelligence {
  const currentFindings = deriveCurrentLabFindingSet(panels, histories)
  const headlineChanges = selectHeadlineFindings(currentFindings.findings, 5)
  const labGaps = new Set<LabGap>()
  const domains = new Map<BiomarkerHistory['category'], ReportBiomarkerRow[]>()
  for (const history of histories) {
    const rows = domains.get(history.category) ?? []
    for (const group of history.units) {
      const trajectory = buildLabTrajectory(group.observations.map(row => toLabEvidenceObservation(row, history.key)))
      const comparison = trajectory.latestRecordedPair.comparison
      const gaps = new Set([...trajectory.limitations, ...trajectory.latestRecordedPair.reasons, ...(comparison?.limitations ?? [])])
      if (history.units.length > 1) gaps.add('incompatible_unit')
      if (trajectory.dates.some(date => date.observations.some(row => row.reference.low == null && row.reference.high == null && !row.reference.text))) gaps.add('reference_range_unavailable')
      for (const gap of gaps) labGaps.add(gap)
      // A mixed-owner series is not reportable, even as selected raw readings.
      if (gaps.has('different_owners')) continue
      rows.push({ biomarkerKey: history.key, name: history.name, unit: group.unit,
        readings: selectedReadings(trajectory), latestRecordedDate: trajectory.dates.at(-1)?.date ?? null,
        comparison: comparison ? labComparisonSummary(comparison) : null, limitations: [...gaps] })
    }
    if (rows.length) domains.set(history.category, rows)
  }
  const biomarkerDomains = biomarkerCategories.flatMap(category => domains.has(category) ? [{ category, rows: domains.get(category)! }] : [])

  const statesByDate = new Map<string, ProtocolState[]>([[today, currentState]])
  const protocolTimeline = detectInterventions(source, today).filter(item => !start || item.date >= start).map(item => {
    let states = statesByDate.get(item.date)
    if (!states) { states = healthStateAtDate(source, item.date); statesByDate.set(item.date, states) }
    // A stopped/removed item may have no state on its effective date. Never fill
    // that absence from today's dose or a neighbouring phase/compound.
    const recordedStates = states.filter(state => state.protocolId === item.protocolId
      && (!item.compoundId || state.compoundId === item.compoundId)
      && (!item.phaseId || state.phaseId === item.phaseId)).map(state => ({
      protocolId: state.protocolId, compoundId: state.compoundId, phaseId: state.phaseId,
      name: state.name, medication: state.medication, frequency: state.frequency, route: state.route,
      provenance: state.provenance, sources: state.sources, limitations: state.limitations,
    }))
    return { ...item, contextDate: item.date, recordedStates }
  })
  const relevantStates = [...currentState, ...protocolTimeline.flatMap(item => item.recordedStates)]
  const savedPlan = relevantStates.some(state => state.provenance === 'saved_plan') || protocolTimeline.some(item => item.provenance === 'saved_plan')
  const timingUncertain = source.protocols.some(protocol => protocolActivityAtDate(protocol, today, source.protocolEvents) === 'ambiguous')
    || relevantStates.some(state => state.provenance === 'unknown') || protocolTimeline.some(item => item.limitations.length > 0 && item.provenance === 'event')
  const doseUnconfirmed = relevantStates.some(state => !state.medication)
  const verification: ReportVerification[] = []
  const add = (code: string, text: string) => { if (!verification.some(item => item.code === code)) verification.push({ code, text }) }
  if (currentFindings.state === 'ambiguous_latest' || currentFindings.previousPanelAmbiguous) add('panel_ambiguity', 'Multiple panels share the latest or previous test date; panel membership is not unambiguous.')
  if (labGaps.has('same_day_records') || labGaps.has('conflicting_same_day')) add('same_day_results', 'Multiple results share a date; none was selected or averaged for that date.')
  if (timingUncertain) add('protocol_timing', 'Some recorded protocol timing or phase state cannot be verified from structured history.')
  if (doseUnconfirmed) add('dose_unconfirmed', 'Some recorded medication doses are unconfirmed; syringe markings and volume are not medication doses.')
  if (labGaps.has('incompatible_unit') || labGaps.has('missing_unit')) add('measurement_units', 'Different or missing units limit comparisons; no unit conversion was inferred.')
  if (savedPlan) add('saved_plan', 'Some protocol history is reconstructed from saved plans rather than recorded change snapshots.')
  if (source.protocolEvents.length >= 1000 || source.protocols.length >= 250 || source.journal.length >= 1000) add('source_limit', 'A report loading limit was reached; some older source history may be unavailable.')
  const rangeGaps: LabGap[] = ['reference_range_unavailable', 'reference_ranges_differ', 'prior_status_unknown', 'current_status_unknown']
  if (rangeGaps.some(gap => labGaps.has(gap))) add('supplied_ranges', 'Missing, changed, or unverified supplied ranges/status limit range interpretation; no external range was added.')
  const grouped = new Set<LabGap>([...rangeGaps, 'same_day_records', 'conflicting_same_day', 'incompatible_unit', 'missing_unit', 'excluded_history', 'assay_method_unknown'])
  const otherGaps = [...labGaps].filter(gap => !grouped.has(gap))
  if (otherGaps.length) add('comparison_gaps', [...new Set(otherGaps.map(gap => labGapText[gap]))].join(' '))
  if (labGaps.has('assay_method_unknown')) add('assay_method', labGapText.assay_method_unknown)
  if (!panels.length) add('no_labs', 'No lab panels are recorded in the selected report period.')
  if (relevantStates.some(state => state.limitations.some(text => text.includes('Snapshot schedule days/times were not retained')))) add('snapshot_schedule', 'Historical snapshots retain frequency and route, but not schedule days or times.')

  const reviewItems: ReportReviewItem[] = headlineChanges.filter(finding => finding.evidence.comparison?.range.current === 'outside')
    .map(finding => ({ code: 'supplied_range', text: `${finding.biomarkerName}: the recorded result is outside its supplied range or reported status.`, findingIds: [finding.id] }))
  for (const item of verification) reviewItems.push({ ...item, findingIds: [] })
  const contextNotes: ReportContextNote[] = [{ kind: 'period', start, end: today }]
  if (currentFindings.latestPanelId && currentFindings.latestDate) contextNotes.push({ kind: 'latest_panel', date: currentFindings.latestDate })
  contextNotes.push({ kind: 'active_items', count: currentState.length, date: today })
  const keyLimitation = verification.find(item => ['panel_ambiguity', 'protocol_timing', 'saved_plan'].includes(item.code))
  if (keyLimitation) contextNotes.push({ kind: 'limitation', text: keyLimitation.text })
  return { contextNotes, biomarkerDomains, protocolTimeline, headlineChanges,
    reviewItems: reviewItems.slice(0, 5), verification: verification.slice(0, 6) }
}
