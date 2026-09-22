import type { LabFinding, LabFindingObservationRef } from './labFindings'
import { resolveLabStatus } from './labs'

/** Consumer projection only. Raw source ranges and canonical comparison facts
 * stay intact for report/audit readers. Partial or suspicious bounds are omitted. */
export function consumerSuppliedRange(reading: Pick<LabFindingObservationRef, 'value' | 'reference'> | null) {
  const reference = reading?.reference
  if (!reference || !reading || !Number.isFinite(reading.value)) return null
  const { low, high } = reference
  if (typeof low !== 'number' || typeof high !== 'number' || !Number.isFinite(low) || !Number.isFinite(high) || low >= high) return null
  const status = resolveLabStatus(reading.value, low, high).status
  // A contradictory printed flag is not a trustworthy numeric-range summary.
  if (reference.status !== 'unknown' && reference.status !== status && !(reference.status === 'abnormal' && status !== 'normal')) return null
  return { outside: status !== 'normal', text: `${status === 'normal' ? 'Within' : 'Outside'} the supplied ${low}–${high} range` }
}

export function findingNeedsVerification(finding: LabFinding) {
  return finding.limitations.includes('low_import_confidence')
    || finding.evidence.history.some(row => row.provenance?.confidence === 'low')
    || finding.evidence.current?.provenance?.confidence === 'low'
}

/** Keep canonical ranking; only suppress a no-comparison, single-reading filler. */
export function meaningfulConsumerFinding(finding: LabFinding) {
  return Boolean(finding.evidence.comparison || finding.evidence.history.length > 1
    || consumerSuppliedRange(finding.evidence.current)?.outside || findingNeedsVerification(finding))
}

export function consumerChangeText(finding: LabFinding) {
  const comparison = finding.evidence.comparison
  if (!comparison) return `${consumerSuppliedRange(finding.evidence.current)?.outside ? 'Outside supplied range · ' : ''}${finding.evidence.history.length || 1} ${finding.evidence.history.length > 1 ? 'readings' : 'reading'}`
  const since = new Date(`${comparison.previous.date}T12:00:00`).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', ...(comparison.previous.date.slice(0, 4) !== comparison.current.date.slice(0, 4) ? { year: 'numeric' } : {}),
  })
  if (comparison.direction === 'unchanged') return `Unchanged since ${since}`
  const percent = comparison.percent == null ? '' : ` (${comparison.percent > 0 ? '+' : ''}${comparison.percent.toLocaleString('en-US', { maximumFractionDigits: 1 })}%)`
  return `${comparison.direction === 'increased' ? 'Up' : 'Down'} ${comparison.absoluteDelta}${percent} since ${since}`
}

export function consumerUncertainty(finding: LabFinding) {
  if (findingNeedsVerification(finding)) return 'Imported result needs verification'
  if (finding.limitations.some(gap => gap === 'incompatible_assay' || gap === 'incompatible_unit' || gap === 'missing_unit')) return 'Different or missing test details limit this comparison.'
  if (finding.limitations.some(gap => gap === 'same_day_records' || gap === 'conflicting_same_day')) return 'Multiple readings share a date; they were not combined.'
  if (finding.limitations.includes('assay_method_unknown') && finding.evidence.comparison) return 'Test methods may differ between results.'
  return null
}
