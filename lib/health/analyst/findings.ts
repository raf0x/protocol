import { buildLabTrajectory, toLabEvidenceObservation, type LabComparisonSummary, type LabGap } from '../labEvidence'
import type { LabFinding, LabFindingPriority, LabFindingType } from '../labFindings'
import type { CurrentLabFindingSet } from '../labFindingsSummary'
import type { BiomarkerHistory } from '../labs'
import type { AnalystEvidence } from './types'

/** Provider DTO. No canonical identity/provenance objects may be spread into it. */
export type AnalystDeterministicFinding = {
  type: LabFindingType
  presentationPriority: LabFindingPriority
  biomarkerName: string
  unit: string
  reason: string
  current: { value: number; date: string } | null
  previous: { value: number; date: string } | null
  comparison: LabComparisonSummary | null
  priorObservedExtent: LabFinding['evidence']['priorObservedExtent']
  membership: { currentDate: string; previousDate: string; currentRecorded: boolean; previousRecorded: boolean } | null
  limitations: LabGap[]
  evidenceIds: string[]
}
export type AnalystFindingScope = {
  state: CurrentLabFindingSet['state']
  latestDate: string | null
  previousDate: string | null
  previousPanelAmbiguous: boolean
  omittedFindingCount: number
}
export type FindingCandidate = { finding: LabFinding; evidence: AnalystEvidence[] }

/** Internal exact source references, never name-based joins. */
export function findingSourceIds(finding: LabFinding): string[] {
  const { current, previous, comparison, membership } = finding.evidence
  return [...new Set([
    ...(comparison ? [`comparison:${comparison.previous.resultId}:${comparison.current.resultId}`] : []),
    ...(current ? [`lab:${current.resultId}`] : []),
    ...(previous ? [`lab:${previous.resultId}`] : []),
    ...(membership ? [
      `panel:${membership.currentPanelId}`,
      ...(membership.previousPanelId ? [`panel:${membership.previousPanelId}`] : []),
      ...membership.currentResultIds.map(id => `lab:${id}`),
      ...membership.previousResultIds.map(id => `lab:${id}`),
    ] : []),
  ])]
}

/** Atomically select a finding and its inspectable support, or omit it. */
export function findingCandidates(
  current: CurrentLabFindingSet,
  histories: readonly BiomarkerHistory[],
  evidence: ReadonlyMap<string, AnalystEvidence>,
): FindingCandidate[] {
  return current.findings.flatMap(finding => {
    const ids = findingSourceIds(finding)
    if (finding.type === 'outside_previously_observed_values') {
      const group = histories.find(row => row.key === finding.biomarkerKey)?.units.find(row => row.unit === finding.unit)
      if (!group) return []
      const trajectory = buildLabTrajectory(group.observations.map(row => toLabEvidenceObservation(row, finding.biomarkerKey)))
      ids.push(...trajectory.ordered.slice(0, -1).map(row => `lab:${row.resultId}`))
    }
    const unique = [...new Set(ids)]
    // Keep one biomarker from occupying the entire context. No unsupported extent
    // is projected when a longer history cannot fit its source observations.
    if (!unique.length || unique.length > 8 || unique.some(id => !evidence.has(id))) return []
    return [{ finding, evidence: unique.map(id => evidence.get(id)!) }]
  })
}

export function projectAnalystFinding(
  candidate: FindingCandidate,
  scope: CurrentLabFindingSet,
  idMap: ReadonlyMap<string, string>,
): AnalystDeterministicFinding | null {
  const evidenceIds = candidate.evidence.map(row => idMap.get(row.id))
  if (!evidenceIds.length || evidenceIds.some(id => !id || !/^E[1-9][0-9]*$/.test(id))) return null
  const f = candidate.finding, e = f.evidence, c = e.comparison
  const point = (value: typeof e.current) => value ? { value: value.value, date: value.date } : null
  return {
    type: f.type, presentationPriority: f.priority, biomarkerName: f.biomarkerName,
    unit: f.unit, reason: f.reason, current: point(e.current), previous: point(e.previous),
    comparison: c ? {
      previous: { value: c.previous.value, date: c.previous.date }, current: { value: c.current.value, date: c.current.date },
      unit: f.unit, delta: c.delta, absoluteDelta: c.absoluteDelta, percent: c.percent,
      elapsedDays: c.elapsedDays, direction: c.direction,
      range: { previous: c.range.previous, current: c.range.current, transition: c.range.transition },
      limitations: [...f.limitations],
    } : null,
    // This extent requires every contributing prior observation selected above.
    priorObservedExtent: f.type === 'outside_previously_observed_values' && e.priorObservedExtent
      ? { min: e.priorObservedExtent.min, max: e.priorObservedExtent.max, start: e.priorObservedExtent.start,
        end: e.priorObservedExtent.end, count: e.priorObservedExtent.count } : null,
    membership: e.membership && scope.latestDate && scope.previousDate ? {
      currentDate: scope.latestDate, previousDate: scope.previousDate,
      currentRecorded: e.membership.currentResultIds.length > 0,
      previousRecorded: e.membership.previousResultIds.length > 0,
    } : null,
    limitations: [...f.limitations], evidenceIds: evidenceIds as string[],
  }
}
