import { addDays, day, daysBetween } from './dates'
import { healthStateAtDate } from './history'
import { detectInterventions } from './interventions'
import { normalizeMeasurements } from './measurements'
import type { EvidenceStrength, Intervention, LongitudinalObservation, LongitudinalResult, LongitudinalSource, Measurement, ObservationWindow } from './types'

// Generic observation horizons, not drug-specific response-time assumptions.
export const defaultWindow: ObservationWindow = { baselineDays: 90, followupStartDays: 1, followupEndDays: 84 }
export const strengthLabels: Record<EvidenceStrength['level'], string> = {
  repeated: 'Repeated measurements', limited: 'Limited measurements', insufficient: 'Insufficient comparable data',
}
function checkedWindow(input: Partial<ObservationWindow>): ObservationWindow {
  const window = { ...defaultWindow, ...input }
  if (Object.values(window).some(value => !Number.isInteger(value) || value < 1 || value > 730) || window.followupStartDays > window.followupEndDays) throw new Error('Choose valid observation windows between 1 and 730 days.')
  return window
}
const precise = (value: number) => Number(value.toPrecision(12))

function observation(intervention: Intervention, series: Measurement[], all: Measurement[], interventions: Intervention[], asOf: string, window: ObservationWindow): LongitudinalObservation {
  const low = addDays(intervention.date, -window.baselineDays), from = addDays(intervention.date, window.followupStartDays)
  const to = [addDays(intervention.date, window.followupEndDays), asOf].sort()[0]
  const limitations: string[] = [...intervention.limitations]
  const before = series.filter(row => row.date >= low && row.date < intervention.date)
  const baselineDate = before.at(-1)?.date
  const nearest = before.filter(row => row.date === baselineDate)
  // Multiple same-day results cannot be ordered. Equal values are harmless;
  // disagreeing values are not arbitrarily averaged or selected by database ID.
  const baseline = new Set(nearest.map(row => row.value)).size === 1 ? nearest[0] : null
  if (nearest.length > 1) limitations.push('Multiple baseline readings share a date; differing values are not resolved automatically.')
  const candidates = series.filter(row => row.date >= from && row.date <= to)
  const byDate = new Map<string, Measurement[]>()
  for (const row of candidates) byDate.set(row.date, [...(byDate.get(row.date) ?? []), row])
  const followups = [...byDate.values()].filter(rows => {
    if (new Set(rows.map(row => row.value)).size > 1) { limitations.push('Conflicting same-day follow-up values were excluded.'); return false }
    return true
  }).map(rows => rows[0])
  if (series.some(row => row.date === intervention.date)) limitations.push('Readings on the change date are excluded because within-day order is unknown.')
  if (all.some(row => row.key === series[0].key && row.unit !== series[0].unit && row.date >= low && row.date <= to)) limitations.push('Other units exist in this period and were not converted or compared.')
  const knownUnit = Boolean(series[0].unit.trim())
  if (!knownUnit) limitations.push('Measurement unit is missing; no numeric comparison was made.')
  const changes = baseline && knownUnit ? followups.flatMap(row => {
    const delta = precise(row.value - baseline.value)
    const percent = row.percentageAllowed && baseline.value > 0 ? precise(delta / baseline.value * 100) : null
    if (!Number.isFinite(delta) || (percent != null && !Number.isFinite(percent))) { limitations.push('Non-finite arithmetic was excluded.'); return [] }
    return [{ measurementId: row.id, delta, percent, direction: delta > 0 ? 'increased' as const : delta < 0 ? 'decreased' as const : 'unchanged' as const,
      daysAfter: daysBetween(intervention.date, row.date), daysBetween: daysBetween(baseline.date, row.date) }]
  }) : []
  const end = followups.at(-1)?.date ?? to
  const confounders = interventions.filter(item => item.id !== intervention.id && item.date >= (baseline?.date ?? low) && item.date <= end)
  const reasons: string[] = []
  if (!baseline) reasons.push('No unambiguous same-unit baseline within the selected window.')
  else reasons.push(`Baseline recorded ${daysBetween(baseline.date, intervention.date)} days before the change.`)
  reasons.push(`${followups.length} follow-up measurement date${followups.length === 1 ? '' : 's'}.`)
  if (confounders.length) reasons.push(`${confounders.length} other recorded change${confounders.length === 1 ? '' : 's'} overlap the baseline-to-follow-up period; attribution is ambiguous.`)
  const directions = new Set(changes.map(change => change.direction))
  if (changes.length > 1) reasons.push(directions.size === 1 ? 'Repeated readings moved in the same direction relative to baseline.' : 'Repeated readings moved in mixed directions relative to baseline.')
  const close = baseline && daysBetween(baseline.date, intervention.date) <= 30
  if (baseline && !close) reasons.push('The baseline is more than 30 days before the change.')
  if (to < addDays(intervention.date, window.followupEndDays)) limitations.push('The follow-up window is still in progress.')
  // Coverage labels are deliberately not probability, effect size, p-values,
  // causality, or clinical/practical significance. Confounding caps strength.
  const level = !changes.length ? 'insufficient' : changes.length >= 3 && close && directions.size === 1 && !confounders.length && !limitations.length ? 'repeated' : 'limited'
  reasons.push('Coverage describes recorded data only. Clinical and statistical significance are not assessed.')
  return { id: `${intervention.id}:${series[0].key}:${series[0].unit}`, intervention, metric: { key: series[0].key, name: series[0].name, unit: series[0].unit },
    window, baseline, followups, changes, confounders, strength: { level, reasons }, limitations: [...new Set(limitations)] }
}

export function buildLongitudinal(source: LongitudinalSource, asOf: string, options: Partial<ObservationWindow> = {}): LongitudinalResult {
  if (day(asOf) !== asOf) throw new Error('A valid analysis date is required.')
  const window = checkedWindow(options), allInterventions = detectInterventions(source, asOf), measurements = normalizeMeasurements(source, asOf)
  const interventions = allInterventions.slice(0, 60)
  const groups = new Map<string, Measurement[]>()
  for (const row of measurements) {
    const key = JSON.stringify([row.key, row.unit])
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  const observations: LongitudinalObservation[] = []
  for (const intervention of interventions) for (const series of groups.values()) {
    if (!series.some(row => row.date >= addDays(intervention.date, -window.baselineDays) && row.date <= addDays(intervention.date, window.followupEndDays))) continue
    observations.push(observation(intervention, series, measurements, allInterventions, asOf, window))
  }
  // Recent changes first; for each change, comparable observations precede gaps.
  observations.sort((a, b) => b.intervention.date.localeCompare(a.intervention.date) || Number(Boolean(b.changes.length)) - Number(Boolean(a.changes.length)) || a.id.localeCompare(b.id))
  const boundaries = [...new Set(allInterventions.map(item => item.date))].sort().slice(-120)
  const versions = boundaries.map((start, index) => {
    const endExclusive = boundaries[index + 1] ?? null
    return { id: `period:${start}`, start, endExclusive,
      interventionIds: allInterventions.filter(item => item.date === start).map(item => item.id),
      protocols: healthStateAtDate(source, start),
      measurementIds: measurements.filter(row => row.date >= start && (!endExclusive || row.date < endExclusive)).map(row => row.id) }
  })
  const limitations = [
    'Observations describe timing, not causality. Actual administration, adherence, lifestyle and unrecorded changes are not established.',
    'Periods use effective calendar dates with an exclusive end. Same-day measurements cannot establish before/after order.',
    'Saved plans are mutable. Missing removal/reactivation events, boundary-only edits and deleted records cannot always be reconstructed.',
    'Edits to phases that do not cover the recorded edit date are not treated as interventions on that date.',
    'Journal weight follows the existing pounds storage convention; no per-entry weight-unit history exists.',
  ]
  if (source.protocols.length >= 250 || source.protocolEvents.length >= 1000 || source.journal.length >= 1000) limitations.push('A source loading limit was reached; older history and additional changes may be missing.')
  if (allInterventions.length > 60 || observations.length > 200 || new Set(allInterventions.map(item => item.date)).size > 120) limitations.push('This view is limited to the latest 60 changes, 200 observations and 120 derived periods. Confounder checks use all loaded changes.')
  if (source.panels.some(panel => panel.results.some(result => result.value == null || result.value_text))) limitations.push('Qualitative lab results remain in Labs; they are not turned into numerical changes.')
  return { asOf, window, interventions, observations: observations.slice(0, 200), versions, limitations }
}
