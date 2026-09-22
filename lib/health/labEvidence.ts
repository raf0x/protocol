import type { BiomarkerHistory, LabObservation, LabStatus, LabStatusSource } from './labs'

/** Pure derived lab facts. Identity comes from the existing biomarker registry.
 * No reads, persistence, unit conversion, assay inference, or journal inputs. */
export type LabGap = 'missing_comparator' | 'missing_unit' | 'incompatible_unit' | 'incompatible_biomarker'
  | 'qualitative_value' | 'missing_value' | 'malformed_value' | 'non_finite_value' | 'invalid_date'
  | 'missing_source_identity' | 'different_owners' | 'same_day_records' | 'conflicting_same_day'
  | 'unordered_dates' | 'non_finite_arithmetic' | 'percentage_unavailable' | 'assay_method_unknown'
  | 'reference_range_unavailable' | 'reference_ranges_differ' | 'prior_status_unknown'
  | 'current_status_unknown' | 'insufficient_history' | 'excluded_history' | 'incompatible_assay'

export const labGapText: Record<LabGap, string> = {
  missing_comparator: 'No eligible comparator is available.',
  missing_unit: 'A measurement unit is missing; no numeric comparison was made.',
  incompatible_unit: 'Different units are kept separate; no conversion was made.',
  incompatible_biomarker: 'Different biomarker identities cannot be compared.',
  qualitative_value: 'Qualitative results are preserved but not used in numeric comparisons.',
  missing_value: 'A numeric result is missing.',
  malformed_value: 'A stored numeric result is malformed; it was not coerced into a number.',
  non_finite_value: 'A non-finite numeric result cannot be compared.',
  invalid_date: 'A valid test date is required for comparison.',
  missing_source_identity: 'The source result or panel identity is missing.',
  different_owners: 'Results from different accounts cannot be compared.',
  same_day_records: 'Multiple results share a date. Equal values do not establish duplicate tests or equivalent assays; none was selected.',
  conflicting_same_day: 'Conflicting same-day results were excluded; none was selected or averaged.',
  unordered_dates: 'A comparison needs a reading on a strictly earlier date.',
  non_finite_arithmetic: 'Non-finite arithmetic was excluded.',
  percentage_unavailable: 'Percentage change is unavailable for a non-positive baseline or unrepresentable percentage.',
  assay_method_unknown: 'Assay/method compatibility is unverified; same-unit arithmetic does not establish equivalent tests.',
  reference_range_unavailable: 'A supplied reference range is unavailable; no range was invented.',
  reference_ranges_differ: 'Supplied reference ranges differ; no range transition was inferred.',
  prior_status_unknown: 'Prior range status is unknown; no transition was inferred.',
  current_status_unknown: 'Current range status is unknown; no transition was inferred.',
  insufficient_history: 'Fewer than two eligible measurement dates are available.',
  excluded_history: 'Some recorded dates are excluded; eligible history is not the complete recorded sequence.',
  incompatible_assay: 'Explicit assay, method, or specimen metadata differ; no numeric comparison was made.',
}
export const labLimitations = (gaps: readonly LabGap[]) => [...new Set(gaps)].map(gap => labGapText[gap])

export type LabEvidenceObservation = {
  biomarkerKey: string; name: string; resultId: string; panelId: string; ownerId: string | null
  date: string; value: number | null; unit: string; originalUnit: string
  // Only explicit source metadata, never inferred from provider or filenames.
  assay?: { assay: string | null; method: string | null; specimen: string | null }
  reference: { low: number | null; high: number | null; text: string | null; status: LabStatus; statusSource: LabStatusSource }
  provenance: {
    sourceType: string | null; filename: string | null; parser: string | null
    rowIndex: number | null; confidence: 'high' | 'medium' | 'low' | null
    // Raw content stays on the canonical panel/result, reached by the IDs above.
    // Do not repeat entire PDF extraction buffers in every derived comparison.
    rawAvailable: boolean; metadataAvailable: boolean
  }
  issues: LabGap[]
}
export type LabReading = LabEvidenceObservation & { value: number }
export type LabDateEvidence = { date: string; observations: LabEvidenceObservation[]; reading: LabReading | null; reasons: LabGap[] }
export type LabRangeState = 'inside' | 'outside' | 'unknown'
export type LabRangeTransition = 'newly_outside' | 'returned_inside' | 'persistently_outside' | 'remained_inside'
  | 'prior_status_unknown' | 'current_status_unknown' | 'reference_ranges_differ'
export type LabRangeFacts = { previous: LabRangeState; current: LabRangeState; transition: LabRangeTransition }
export type LabComparison = {
  previous: LabReading; current: LabReading; unit: string
  delta: number; absoluteDelta: number; percent: number | null; elapsedDays: number
  direction: 'increased' | 'decreased' | 'unchanged'; range: LabRangeFacts; limitations: LabGap[]
}
export type LabComparisonResult = { comparison: LabComparison | null; reasons: LabGap[]; observations: LabEvidenceObservation[] }
export type LabTrajectory = {
  dates: LabDateEvidence[]; ordered: LabReading[]; latest: LabReading | null; previous: LabReading | null; earliest: LabReading | null
  priorEligibleDates: number
  priorObservedExtent: { min: number; max: number; start: string; end: string; count: number } | null
  latestVsPrevious: LabComparisonResult; latestVsEarliest: LabComparisonResult
  latestRecordedPair: LabComparisonResult; limitations: LabGap[]
}

const unique = <T,>(items: T[]) => [...new Set(items)]
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value.trim() : null
const precise = (value: number) => Number(value.toPrecision(12))
function validDate(value: string) {
  const time = Date.parse(`${value}T12:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !value.startsWith('0000') && Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value
}

export function toLabEvidenceObservation(row: LabObservation, biomarkerKey: string): LabEvidenceObservation {
  const r = row.result, issues: LabGap[] = [], unit = text(r.unit) ?? ''
  const panelId = row.panelId || r.lab_panel_id
  if (!validDate(row.date)) issues.push('invalid_date')
  if (!r.id || !panelId) issues.push('missing_source_identity')
  if (r.user_id && row.source?.user_id && r.user_id !== row.source.user_id) issues.push('different_owners')
  if (!unit) issues.push('missing_unit')
  if (text(r.value_text)) issues.push('qualitative_value')
  else if (r.value == null) issues.push('missing_value')
  else if (typeof r.value !== 'number') issues.push('malformed_value')
  else if (!Number.isFinite(r.value)) issues.push('non_finite_value')
  const validBounds = (r.reference_low == null || finite(r.reference_low)) && (r.reference_high == null || finite(r.reference_high))
    && !(r.reference_low != null && r.reference_high != null && r.reference_low > r.reference_high)
  const source = r.status_source === 'reported' || r.status_source === 'derived' ? r.status_source : 'unknown'
  const status = ['normal', 'high', 'low', 'abnormal'].includes(r.status) && (source === 'reported' || (source === 'derived' && validBounds && (r.reference_low != null || r.reference_high != null))) ? r.status : 'unknown'
  return { biomarkerKey, name: r.biomarker_name, resultId: r.id, panelId, ownerId: text(r.user_id) ?? text(row.source?.user_id), date: row.date,
    value: finite(r.value) ? r.value : null, unit, originalUnit: typeof r.unit === 'string' ? r.unit : '',
    assay: { assay: text(r.source_raw?.assay), method: text(r.source_raw?.method), specimen: text(r.source_raw?.specimen) },
    reference: { low: validBounds ? r.reference_low ?? null : null, high: validBounds ? r.reference_high ?? null : null,
      text: text(r.reference_text), status, statusSource: source },
    provenance: { sourceType: row.source?.source_type ?? null, filename: row.source?.source_filename ?? null,
      parser: text(row.source?.source_metadata?.parser), rowIndex: r.source_row_index ?? null,
      confidence: ['high', 'medium', 'low'].includes(r.import_confidence ?? '') ? r.import_confidence! : null,
      rawAvailable: Boolean(r.source_raw), metadataAvailable: Boolean(row.source?.source_metadata) }, issues }
}

/** Calendar dates are sets, not an implicit intraday ordering. Even equal-valued
 * records remain distinct and ineligible for automatic selection. */
export function labDateEvidence(observations: LabEvidenceObservation[]): LabDateEvidence {
  const reasons = observations.flatMap(row => row.issues)
  if (!observations.length) reasons.push('missing_comparator')
  if (observations.length > 1) reasons.push(new Set(observations.map(row => row.value)).size > 1 ? 'conflicting_same_day' : 'same_day_records')
  const row = observations[0]
  return { date: row?.date ?? '', observations: [...observations], reasons: unique(reasons),
    reading: !reasons.length && row?.value != null ? row as LabReading : null }
}

export function labRangeState(row: LabEvidenceObservation): LabRangeState {
  return row.reference.status === 'normal' ? 'inside' : ['high', 'low', 'abnormal'].includes(row.reference.status) ? 'outside' : 'unknown'
}
function rangeFacts(previous: LabReading, current: LabReading): LabRangeFacts {
  const before = labRangeState(previous), after = labRangeState(current)
  let transition: LabRangeTransition
  if (before === 'unknown') transition = 'prior_status_unknown'
  else if (after === 'unknown') transition = 'current_status_unknown'
  else if (previous.reference.low !== current.reference.low || previous.reference.high !== current.reference.high || previous.reference.text !== current.reference.text) transition = 'reference_ranges_differ'
  else transition = before === 'inside' ? after === 'outside' ? 'newly_outside' : 'remained_inside' : after === 'inside' ? 'returned_inside' : 'persistently_outside'
  return { previous: before, current: after, transition }
}

/** The sole lab pair arithmetic/eligibility implementation. Callers choose dates. */
export function compareLabDates(before: LabDateEvidence | null, after: LabDateEvidence | null): LabComparisonResult {
  const observations = [...(before?.observations ?? []), ...(after?.observations ?? [])]
  const reasons: LabGap[] = [...(before?.reasons ?? ['missing_comparator']), ...(after?.reasons ?? ['missing_comparator'])]
  const a = before?.reading, b = after?.reading
  if (a && b) {
    if (a.unit !== b.unit) reasons.push('incompatible_unit')
    if (a.biomarkerKey !== b.biomarkerKey) reasons.push('incompatible_biomarker')
    if (a.ownerId && b.ownerId && a.ownerId !== b.ownerId) reasons.push('different_owners')
    if (assayFields.some(key => a.assay?.[key] && b.assay?.[key] && a.assay[key] !== b.assay[key])) reasons.push('incompatible_assay')
    if (a.date >= b.date) reasons.push('unordered_dates')
  }
  if (reasons.length || !a || !b) return { comparison: null, reasons: unique(reasons.length ? reasons : ['missing_comparator']), observations }
  const delta = precise(b.value - a.value)
  if (!Number.isFinite(delta)) return { comparison: null, reasons: ['non_finite_arithmetic'], observations }
  const ratio = a.value > 0 ? precise(delta / a.value * 100) : NaN
  const percent = Number.isFinite(ratio) ? ratio : null
  const range = rangeFacts(a, b)
  const limitations: LabGap[] = ['assay_method_unknown']
  if (percent == null) limitations.push('percentage_unavailable')
  if ([a, b].some(row => row.reference.low == null && row.reference.high == null && !row.reference.text)) limitations.push('reference_range_unavailable')
  if (['prior_status_unknown', 'current_status_unknown', 'reference_ranges_differ'].includes(range.transition)) limitations.push(range.transition as LabGap)
  return { reasons: [], observations, comparison: { previous: a, current: b, unit: a.unit, delta, absoluteDelta: Math.abs(delta), percent,
    elapsedDays: Math.round((Date.parse(b.date) - Date.parse(a.date)) / 86400000),
    direction: delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'unchanged', range, limitations } }
}

const assayFields = ['assay', 'method', 'specimen'] as const

export function buildLabTrajectory(observations: LabEvidenceObservation[]): LabTrajectory {
  const byDate = new Map<string, LabEvidenceObservation[]>()
  for (const row of observations) byDate.set(row.date, [...(byDate.get(row.date) ?? []), row])
  const dates = [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([, rows]) => labDateEvidence([...rows].sort((a, b) => a.resultId.localeCompare(b.resultId))))
  const seriesIssues: LabGap[] = []
  if (new Set(observations.map(row => row.unit)).size > 1) seriesIssues.push('incompatible_unit')
  if (new Set(observations.map(row => row.biomarkerKey)).size > 1) seriesIssues.push('incompatible_biomarker')
  if (new Set(observations.map(row => row.ownerId).filter(Boolean)).size > 1) seriesIssues.push('different_owners')
  if (assayFields.some(key => new Set(observations.map(row => row.assay?.[key]).filter(Boolean)).size > 1)) seriesIssues.push('incompatible_assay')
  const eligible = seriesIssues.length ? [] : dates.filter(group => group.reading)
  const ordered = eligible.map(group => group.reading!)
  const latest = ordered.at(-1) ?? null, previous = ordered.at(-2) ?? null, earliest = ordered[0] ?? null
  const prior = ordered.slice(0, -1)
  const pair = (a?: LabDateEvidence, b?: LabDateEvidence): LabComparisonResult => seriesIssues.length
    ? { comparison: null, reasons: [...seriesIssues], observations: [...observations] } : compareLabDates(a ?? null, b ?? null)
  return { dates, ordered, latest, previous, earliest, priorEligibleDates: prior.length,
    priorObservedExtent: prior.length ? { min: prior.reduce((v, row) => Math.min(v, row.value), Infinity), max: prior.reduce((v, row) => Math.max(v, row.value), -Infinity),
      start: prior[0].date, end: prior.at(-1)!.date, count: prior.length } : null,
    latestVsPrevious: pair(eligible.at(-2), eligible.at(-1)), latestVsEarliest: pair(eligible.length > 1 ? eligible[0] : undefined, eligible.at(-1)),
    // Compatibility adapter: do not label an older pair as the newest test.
    latestRecordedPair: pair(dates.at(-2), dates.at(-1)),
    limitations: unique([...seriesIssues, ...dates.flatMap(group => group.reasons), ...(dates.some(group => !group.reading) ? ['excluded_history' as const] : []),
      ...(ordered.length < 2 ? ['insufficient_history' as const] : []), ...(observations.length ? ['assay_method_unknown' as const] : [])]) }
}

export type LabPersonalHistory = {
  version: 1
  evidenceLevel: 'insufficient' | 'direct_comparison' | 'recorded_history' | 'descriptive_baseline'
  eligibleDates: number
  baseline: { median: number; min: number; max: number; count: number; start: string; end: string } | null
  personalExtreme: 'high' | 'low' | null
  movement: 'repeated_increase' | 'repeated_decrease' | 'reversal' | 'stable' | null
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : sorted[middle - 1] / 2 + sorted[middle] / 2
}

/** Descriptive history only, using canonical date eligibility and pair arithmetic.
 * Baseline excludes the latest date and needs three earlier eligible dates.
 * V1 stability requires an exact repeat; no tolerance or clinical threshold. */
export function labPersonalHistory(trajectory: LabTrajectory): LabPersonalHistory {
  const rows = trajectory.ordered, pair = trajectory.latestRecordedPair.comparison
  const prior = rows.slice(0, -1), extent = trajectory.priorObservedExtent
  const usable = Boolean(pair && rows.at(-1)?.resultId === pair.current.resultId)
  const baseline = usable && prior.length >= 3 && extent ? {
    median: median(prior.map(row => row.value)), min: extent.min, max: extent.max,
    count: prior.length, start: prior[0].date, end: prior.at(-1)!.date,
  } : null
  const result: LabPersonalHistory = {
    version: 1,
    evidenceLevel: !usable ? 'insufficient' : baseline ? 'descriptive_baseline' : rows.length >= 3 ? 'recorded_history' : 'direct_comparison',
    eligibleDates: rows.length, baseline, personalExtreme: null, movement: null,
  }
  if (!usable || !pair) return result
  if (extent && prior.length >= 2) result.personalExtreme = pair.current.value > extent.max ? 'high' : pair.current.value < extent.min ? 'low' : null
  // Consecutive recorded dates only; never bridge an excluded date for a pattern.
  const tail = trajectory.dates.slice(-3)
  const preceding = tail.length === 3 ? compareLabDates(tail[0], tail[1]).comparison : null
  if (preceding && preceding.current.resultId === pair.previous.resultId) {
    if (preceding.direction === pair.direction && pair.direction !== 'unchanged') result.movement = pair.direction === 'increased' ? 'repeated_increase' : 'repeated_decrease'
    else if (preceding.direction !== 'unchanged' && pair.direction !== 'unchanged') result.movement = 'reversal'
  }
  if (baseline && trajectory.dates.every(date => date.reading) && pair.current.value === pair.previous.value) result.movement = 'stable'
  return result
}

/** Identity-free projection of the same pair, safe for existing AI/report DTOs.
 * Do not spread the internal comparison: it includes source identities. */
export function labComparisonSummary(comparison: LabComparison) {
  return { previous: { date: comparison.previous.date, value: comparison.previous.value }, current: { date: comparison.current.date, value: comparison.current.value },
    unit: comparison.unit, delta: comparison.delta, absoluteDelta: comparison.absoluteDelta, percent: comparison.percent,
    elapsedDays: comparison.elapsedDays, direction: comparison.direction, range: { ...comparison.range }, limitations: [...comparison.limitations] }
}
export type LabComparisonSummary = ReturnType<typeof labComparisonSummary>

export const rangeTransitionText: Record<LabRangeTransition, string> = {
  newly_outside: 'Newly outside the supplied range or reported lab status.',
  returned_inside: 'Returned to the supplied in-range status.',
  persistently_outside: 'Outside the supplied range or reported lab status on both recorded dates.',
  remained_inside: 'Inside the supplied range or reported lab status on both recorded dates.',
  prior_status_unknown: labGapText.prior_status_unknown,
  current_status_unknown: labGapText.current_status_unknown,
  reference_ranges_differ: labGapText.reference_ranges_differ,
}

export type LabPanelMembership = {
  key: string; name: string; currentPanelId: string; previousPanelId: string | null
  currentResultIds: string[]; previousResultIds: string[]; currentUsable: boolean; previousUsable: boolean
  change: 'newly_measured' | 'absent_from_latest' | 'present_both' | 'no_previous_panel' | 'unordered_panels'
}
export function labPanelMembership(histories: BiomarkerHistory[], currentPanelId: string, previousPanelId: string | null): LabPanelMembership[] {
  const allRows = histories.flatMap(history => history.units.flatMap(group => group.observations))
  const currentDate = allRows.find(row => row.panelId === currentPanelId)?.date
  const previousDate = allRows.find(row => row.panelId === previousPanelId)?.date
  const unordered = currentDate && previousDate && previousDate >= currentDate
  return histories.flatMap(history => {
    const all = history.units.flatMap(group => group.observations)
    const current = all.filter(row => row.panelId === currentPanelId), previous = all.filter(row => row.panelId === previousPanelId)
    if (!current.length && !previous.length) return []
    const usable = (id: string | null) => history.units.some(group => {
      const entries = group.observations.filter(row => row.panelId === id).map(row => toLabEvidenceObservation(row, history.key))
      return Boolean(labDateEvidence(entries).reading)
    })
    return [{ key: history.key, name: history.name, currentPanelId, previousPanelId,
      currentResultIds: current.map(row => row.result.id), previousResultIds: previous.map(row => row.result.id),
      currentUsable: usable(currentPanelId), previousUsable: usable(previousPanelId),
      change: previousPanelId == null ? 'no_previous_panel' as const : unordered ? 'unordered_panels' as const : !current.length ? 'absent_from_latest' as const : !previous.length ? 'newly_measured' as const : 'present_both' as const }]
  })
}
