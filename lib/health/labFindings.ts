import type {
  LabComparison,
  LabGap,
  LabPanelMembership,
  LabReading,
  LabTrajectory,
} from './labEvidence'
import { labPersonalHistory, type LabPersonalHistory } from './labEvidence'

/**
 * Deterministic, derived lab findings built only from Shared Lab Evidence.
 * No reads, persistence, AI, protocol attribution, diagnosis, or risk scoring.
 */
export type LabFindingType =
  | 'newly_outside_range'
  | 'returned_to_range'
  | 'persistently_outside_range'
  | 'newly_measured'
  | 'missing_from_latest_panel'
  | 'increased'
  | 'decreased'
  | 'unchanged'
  | 'outside_previously_observed_values'
  | 'insufficient_history'
  | 'repeated_direction'
  | 'reversal'
  | 'stable_history'
  | 'incompatible_comparison'

export type LabFindingPriority = 'attention' | 'context' | 'informational'

export type LabFindingObservationRef = {
  resultId: string
  panelId: string
  date: string
  value: number
  unit: string
  reference?: LabReading['reference']
  provenance?: Pick<LabReading['provenance'], 'sourceType' | 'parser' | 'rowIndex' | 'confidence'>
}

export type LabFindingComparisonEvidence = {
  previous: LabFindingObservationRef
  current: LabFindingObservationRef
  delta: number
  absoluteDelta: number
  percent: number | null
  elapsedDays: number
  direction: LabComparison['direction']
  range: LabComparison['range']
}

export type LabFindingMembershipEvidence = {
  currentPanelId: string
  previousPanelId: string | null
  currentResultIds: string[]
  previousResultIds: string[]
  currentUsable: boolean
  previousUsable: boolean
  change: LabPanelMembership['change']
}

export type LabFindingEvidence = {
  current: LabFindingObservationRef | null
  previous: LabFindingObservationRef | null
  comparison: LabFindingComparisonEvidence | null
  priorObservedExtent: LabTrajectory['priorObservedExtent']
  membership: LabFindingMembershipEvidence | null
  personalHistory: LabPersonalHistory
  history: LabFindingObservationRef[]
}

export type LabFinding = {
  id: string
  biomarkerKey: string
  biomarkerName: string
  unit: string
  type: LabFindingType
  priority: LabFindingPriority
  observedAt: string | null
  reason: string
  limitations: LabGap[]
  evidence: LabFindingEvidence
}

export type LabFindingSeriesInput = {
  biomarkerKey: string
  biomarkerName: string
  unit: string
  trajectory: LabTrajectory
}

export type LabFindingDerivationInput = {
  series: readonly LabFindingSeriesInput[]
  memberships?: readonly LabPanelMembership[]
}

const specificityRank: Record<LabFindingType, number> = {
  newly_outside_range: 0,
  returned_to_range: 1,
  persistently_outside_range: 2,
  outside_previously_observed_values: 3,
  repeated_direction: 4,
  reversal: 4,
  stable_history: 5,
  increased: 6,
  decreased: 6,
  unchanged: 6,
  newly_measured: 7,
  missing_from_latest_panel: 7,
  insufficient_history: 7,
  incompatible_comparison: 7,
}

const unique = <T,>(items: readonly T[]) => [...new Set(items)]
const observationRef = (reading: LabReading | null | undefined): LabFindingObservationRef | null => reading ? {
  resultId: reading.resultId,
  panelId: reading.panelId,
  date: reading.date,
  value: reading.value,
  unit: reading.unit,
  reference: { ...reading.reference },
  provenance: { sourceType: reading.provenance.sourceType, parser: reading.provenance.parser,
    rowIndex: reading.provenance.rowIndex, confidence: reading.provenance.confidence },
} : null

const comparisonEvidence = (comparison: LabComparison | null): LabFindingComparisonEvidence | null => comparison ? {
  previous: observationRef(comparison.previous)!,
  current: observationRef(comparison.current)!,
  delta: comparison.delta,
  absoluteDelta: comparison.absoluteDelta,
  percent: comparison.percent,
  elapsedDays: comparison.elapsedDays,
  direction: comparison.direction,
  range: { ...comparison.range },
} : null

const membershipEvidence = (membership: LabPanelMembership | null): LabFindingMembershipEvidence | null => membership ? {
  currentPanelId: membership.currentPanelId,
  previousPanelId: membership.previousPanelId,
  currentResultIds: [...membership.currentResultIds],
  previousResultIds: [...membership.previousResultIds],
  currentUsable: membership.currentUsable,
  previousUsable: membership.previousUsable,
  change: membership.change,
} : null

function findingId(key: string, unit: string, type: LabFindingType, observedAt: string | null) {
  return [key, unit || 'unit-unknown', observedAt ?? 'date-unknown', type].join(':')
}

function baseFinding(
  series: LabFindingSeriesInput,
  type: LabFindingType,
  priority: LabFindingPriority,
  reason: string,
  comparison: LabComparison | null,
  limitations: readonly LabGap[],
  membership: LabPanelMembership | null = null,
): LabFinding {
  const latestRecorded = series.trajectory.dates.at(-1)?.reading ?? null
  const current = comparison?.current ?? latestRecorded
  const previous = comparison?.previous ?? null
  const observedAt = current?.date ?? null
  return {
    id: findingId(series.biomarkerKey, series.unit, type, observedAt),
    biomarkerKey: series.biomarkerKey,
    biomarkerName: series.biomarkerName,
    unit: series.unit,
    type,
    priority,
    observedAt,
    reason,
    limitations: unique(limitations),
    evidence: {
      current: observationRef(current),
      previous: observationRef(previous),
      comparison: comparisonEvidence(comparison),
      priorObservedExtent: series.trajectory.priorObservedExtent ? { ...series.trajectory.priorObservedExtent } : null,
      membership: membershipEvidence(membership),
      personalHistory: labPersonalHistory(series.trajectory),
      history: series.trajectory.ordered.map(row => observationRef(row)!),
    },
  }
}

function movingFurtherOutside(comparison: LabComparison) {
  const status = comparison.current.reference.status
  return (status === 'high' && comparison.direction === 'increased')
    || (status === 'low' && comparison.direction === 'decreased')
}

function trajectoryFinding(series: LabFindingSeriesInput): LabFinding | null {
  const { trajectory } = series
  // Shared Lab Evidence treats mixed-owner series as ineligible. Findings must not
  // summarize or expose a cross-owner series even as an "insufficient" result.
  if (trajectory.limitations.includes('different_owners')) return null

  const recordedPair = trajectory.latestRecordedPair
  const comparison = recordedPair.comparison
  if (!comparison) {
    const latestRecorded = trajectory.dates.at(-1)?.reading ?? null
    const limitations = unique([...trajectory.limitations, ...recordedPair.reasons])
    if (!trajectory.dates.length) return null
    return baseFinding(
      series,
      limitations.some(gap => gap === 'incompatible_unit' || gap === 'incompatible_assay') ? 'incompatible_comparison' : 'insufficient_history',
      'informational',
      latestRecorded
        ? 'No eligible prior result is available for a deterministic comparison.'
        : 'The latest recorded result is not eligible for a deterministic comparison.',
      null,
      limitations.length ? limitations : ['insufficient_history'],
    )
  }

  const commonLimitations = unique([...trajectory.limitations, ...comparison.limitations])
  switch (comparison.range.transition) {
    case 'newly_outside':
      return baseFinding(series, 'newly_outside_range', 'attention',
        'The current result is outside the supplied range or reported status after a known prior in-range result.',
        comparison, commonLimitations)
    case 'returned_inside':
      return baseFinding(series, 'returned_to_range', 'context',
        'The current result is inside the supplied range or reported status after a known prior outside-range result.',
        comparison, commonLimitations)
    case 'persistently_outside':
      return baseFinding(series, 'persistently_outside_range', movingFurtherOutside(comparison) ? 'attention' : 'context',
        'The result is outside the same supplied range or reported status on both eligible comparison dates.',
        comparison, commonLimitations)
  }

  const personal = labPersonalHistory(trajectory)
  if (personal.personalExtreme) {
    const side = personal.personalExtreme === 'high' ? 'above' : 'below'
    return baseFinding(series, 'outside_previously_observed_values', 'context',
      `The current result is ${side} the prior eligible values recorded for this biomarker and unit.`,
      comparison, commonLimitations)
  }

  if (personal.movement === 'stable') return baseFinding(series, 'stable_history', 'context',
    'The latest value matches the previous recorded value within your prior observed span.', comparison, commonLimitations)
  if (personal.movement === 'reversal') return baseFinding(series, 'reversal', 'context',
    'The latest change reversed the direction of the preceding recorded change.', comparison, commonLimitations)
  if (personal.movement?.startsWith('repeated_')) return baseFinding(series, 'repeated_direction', 'context',
    `The last three eligible recorded dates show two consecutive ${comparison.direction === 'increased' ? 'increases' : 'decreases'}.`, comparison, commonLimitations)

  const directionType: Extract<LabFindingType, 'increased' | 'decreased' | 'unchanged'> = comparison.direction
  return baseFinding(series, directionType, 'informational',
    comparison.direction === 'unchanged'
      ? 'The current result is unchanged from the eligible previous result.'
      : `The current result ${comparison.direction} from the eligible previous result.`,
    comparison, commonLimitations)
}

function membershipFinding(
  membership: LabPanelMembership,
  series: readonly LabFindingSeriesInput[],
): LabFinding | null {
  const candidates = series.filter(item => item.biomarkerKey === membership.key)
  if (!candidates.length || candidates.some(item => item.trajectory.limitations.includes('different_owners'))) return null
  const targetIds = new Set(membership.change === 'absent_from_latest' ? membership.previousResultIds : membership.currentResultIds)
  const representative = [...candidates].sort((a, b) => {
    const aMatches = a.trajectory.dates.some(group => group.observations.some(row => targetIds.has(row.resultId))) ? 1 : 0
    const bMatches = b.trajectory.dates.some(group => group.observations.some(row => targetIds.has(row.resultId))) ? 1 : 0
    if (aMatches !== bMatches) return bMatches - aMatches
    const ad = a.trajectory.dates.at(-1)?.date ?? ''
    const bd = b.trajectory.dates.at(-1)?.date ?? ''
    return bd.localeCompare(ad) || a.unit.localeCompare(b.unit)
  })[0]

  if (membership.change === 'newly_measured') {
    return baseFinding(representative, 'newly_measured', 'informational',
      'This biomarker is recorded on the latest panel but not on the previous panel.',
      null, representative.trajectory.limitations, membership)
  }
  if (membership.change === 'absent_from_latest') {
    const finding = baseFinding(representative, 'missing_from_latest_panel', 'informational',
      'This biomarker was recorded on the previous panel but is not recorded on the latest panel.',
      null, representative.trajectory.limitations, membership)
    return { ...finding, observedAt: null, id: findingId(representative.biomarkerKey, representative.unit, 'missing_from_latest_panel', null),
      evidence: { ...finding.evidence, current: null } }
  }
  return null
}

/**
 * Derive at most one trajectory finding per exact biomarker/unit series, then apply
 * panel-membership precedence for newly measured or absent biomarkers.
 */
export function deriveLabFindings(input: LabFindingDerivationInput): LabFinding[] {
  const overridden = new Set<string>()
  const findings: LabFinding[] = []

  for (const membership of input.memberships ?? []) {
    if (membership.change !== 'newly_measured' && membership.change !== 'absent_from_latest') continue
    const finding = membershipFinding(membership, input.series)
    if (finding) { findings.push(finding); overridden.add(membership.key) }
  }

  for (const series of input.series) {
    if (overridden.has(series.biomarkerKey)) continue
    const finding = trajectoryFinding(series)
    if (finding) findings.push(finding)
  }

  return rankLabFindings(findings)
}

/** Ascending tuple: category, newest date first, name, unit, exact identity.
 * Ordering is presentation priority, never clinical urgency or a risk score. */
export function labFindingPriorityTuple(finding: LabFinding): readonly [number, number, string, string, string] {
  return [specificityRank[finding.type], finding.observedAt ? -Number(finding.observedAt.replaceAll('-', '')) : 0,
    finding.biomarkerName, finding.unit, finding.id]
}

export function labFindingLabel(finding: LabFinding): string {
  if (finding.type === 'outside_previously_observed_values') return finding.evidence.personalHistory.personalExtreme === 'low' ? 'New recorded personal low' : 'New recorded personal high'
  const labels: Record<LabFindingType, string> = {
    newly_outside_range: 'Newly outside supplied range', returned_to_range: 'Returned to supplied range',
    persistently_outside_range: 'Persistently outside supplied range', outside_previously_observed_values: 'New recorded personal extreme',
    repeated_direction: 'Repeated directional movement', reversal: 'Direction reversed', stable_history: 'Stable near prior recorded history',
    increased: 'Increased from previous eligible result', decreased: 'Decreased from previous eligible result', unchanged: 'Unchanged from previous eligible result',
    newly_measured: 'Newly measured', missing_from_latest_panel: 'Not measured on latest panel',
    insufficient_history: 'Insufficient comparable history', incompatible_comparison: 'Incompatible comparison',
  }
  return labels[finding.type]
}

export function rankLabFindings(findings: readonly LabFinding[]) {
  return [...findings].sort((a, b) => {
    const left = labFindingPriorityTuple(a), right = labFindingPriorityTuple(b)
    for (let i = 0; i < left.length; i++) {
      if (left[i] < right[i]) return -1
      if (left[i] > right[i]) return 1
    }
    return 0
  })
}

export function findingsForBiomarker(findings: readonly LabFinding[], biomarkerKey: string) {
  return rankLabFindings(findings.filter(finding => finding.biomarkerKey === biomarkerKey))
}

export function highestPriorityFindings(findings: readonly LabFinding[]) {
  const ranked = rankLabFindings(findings)
  if (!ranked.length) return []
  const category = labFindingPriorityTuple(ranked[0])[0]
  return ranked.filter(finding => labFindingPriorityTuple(finding)[0] === category)
}

/** Low-signal unchanged/insufficient facts remain auditable in all findings but
 * do not displace more useful headline candidates. */
export function selectHeadlineFindings(findings: readonly LabFinding[], limit = 5) {
  if (!Number.isInteger(limit) || limit < 0) throw new Error('Headline finding limit must be a non-negative integer.')
  return rankLabFindings(findings)
    .filter(finding => !['unchanged', 'insufficient_history', 'incompatible_comparison'].includes(finding.type))
    .slice(0, limit)
}
