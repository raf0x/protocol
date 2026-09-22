import Link from 'next/link'
import { labGapText } from '../../lib/health/labEvidence'
import { labFindingLabel, labFindingPriorityTuple, type LabFinding, type LabFindingPriority } from '../../lib/health/labFindings'
import { labReference } from '../../lib/health/labs'
import type { BiomarkerHistory, LabPanel } from '../../lib/health/labs'
import type { BriefingSupplementalLabUpdate } from '../../lib/health/healthBriefing'
import { formatTimelineDate } from '../../lib/health/timeline'
import styles from '../../app/health/health.module.css'

import { buildLabFindingsSummaryModel, type LabFindingsSummaryModel } from '../../lib/health/labFindingsSummary'
export { buildLabFindingsSummaryModel, type LabFindingsSummaryModel } from '../../lib/health/labFindingsSummary'

const priorityLabels: Record<LabFindingPriority, string> = {
  attention: 'Review',
  context: 'Context',
  informational: 'Info',
}

function valueText(value: number, unit: string) {
  return `${String(value)}${unit ? ` ${unit}` : ''}`
}

function formatPercent(value: number) {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function changeText(finding: LabFinding) {
  const comparison = finding.evidence.comparison
  if (!comparison) return null
  const sign = comparison.delta > 0 ? '+' : ''
  const percent = comparison.percent == null ? '' : ` (${comparison.percent > 0 ? '+' : ''}${formatPercent(comparison.percent)}%)`
  return `${sign}${String(comparison.delta)}${comparison.current.unit ? ` ${comparison.current.unit}` : ''}${percent}`
}

export function ComparisonPreview({ finding }: { finding: LabFinding }) {
  const rows = finding.evidence.history.slice(-3)
  if (!rows.length) return null
  return <ol className={styles.personalHistoryTrack} aria-label="Recent eligible recorded values" data-comparison-preview>
    {rows.map(row => <li key={row.date}><strong>{valueText(row.value, row.unit)}</strong><time dateTime={row.date}>{formatTimelineDate(row.date)}</time></li>)}
  </ol>
}

export function FindingEvidence({ finding }: { finding: LabFinding }) {
  const current = finding.evidence.current
  const previous = finding.evidence.previous
  const comparison = finding.evidence.comparison
  const extent = finding.evidence.priorObservedExtent
  const limitations = [...new Set(finding.limitations)]
  const personal = finding.evidence.personalHistory
  const baseline = personal.baseline

  return <details className={styles.formDetails}>
    <summary aria-label={`View details for ${finding.biomarkerName}`}>View details</summary>
    <p className={styles.secondary}>{finding.reason}</p>
    {current && <p className={styles.secondary}><strong>Current:</strong> {valueText(current.value, current.unit)} · {formatTimelineDate(current.date)}</p>}
    {previous && <p className={styles.secondary}><strong>Previous:</strong> {valueText(previous.value, previous.unit)} · {formatTimelineDate(previous.date)}</p>}
    {comparison && <p className={styles.secondary}><strong>Change:</strong> {changeText(finding)} over {comparison.elapsedDays} days</p>}
    {extent && <p className={styles.secondary}><strong>Prior observed values:</strong> {valueText(extent.min, finding.unit)} to {valueText(extent.max, finding.unit)} across {extent.count} earlier eligible readings</p>}
    <p className={styles.secondary}><strong>Personal baseline:</strong> {baseline
      ? `Median ${valueText(baseline.median, finding.unit)} from ${baseline.count} earlier eligible dates (${baseline.start} to ${baseline.end}); the latest result is excluded.`
      : 'Not established: at least three earlier eligible measurement dates are required.'}</p>
    {personal.movement === 'stable' && <p className={styles.caption}>History method V1 labels stability only for an exact repeat of the previous value, with at least three earlier eligible dates and no excluded dates.</p>}
    <p className={styles.caption}>Historical values are descriptive, not a medical reference interval; assay equivalence remains unverified.</p>
    <p className={styles.caption}>Presentation order: newly outside range, returned to range, persistent abnormality, personal departure, directional movement, stable context, then other comparisons. Ties use newest date, name, unit, and source identity. Category priority: {labFindingPriorityTuple(finding)[0] + 1}; this is not clinical urgency.</p>
    <ul className={styles.personalHistorySources} aria-label="Source evidence">{finding.evidence.history.map(row => <li key={row.date}>
      <time dateTime={row.date}>{row.date}</time>: {valueText(row.value, row.unit)}
      {row.reference && <> · Supplied range: {labReference({ reference_low: row.reference.low, reference_high: row.reference.high, reference_text: row.reference.text })} · {row.reference.status} ({row.reference.statusSource})</>}
      {row.provenance && <> · {row.provenance.sourceType || 'Source unknown'}{row.provenance.rowIndex != null && `, source row ${row.provenance.rowIndex}`}{row.provenance.confidence && `, import confidence ${row.provenance.confidence}`}</>}
    </li>)}</ul>
    {limitations.length > 0 && <p className={styles.caption}><strong>Limitations:</strong> {limitations.map(gap => labGapText[gap]).join(' ')}</p>}
    <Link className={styles.textLink} href={`/health?biomarker=${encodeURIComponent(finding.biomarkerKey)}`}>View biomarker trend</Link>
  </details>
}

function SupplementalEvidence({ item }: { item: BriefingSupplementalLabUpdate }) {
  const reasons = [...new Set(item.evidenceReasons)]
  const reasonText = reasons.filter(reason => reason !== 'missing_comparator').map(reason => labGapText[reason])

  return <details className={styles.formDetails}>
    <summary>Evidence</summary>
    <p className={styles.secondary}><strong>Current:</strong> {valueText(item.value, item.unit)} · {formatTimelineDate(item.date)}</p>
    {item.panelName && <p className={styles.secondary}><strong>Panel:</strong> {item.panelName}</p>}
    {item.provider && <p className={styles.secondary}><strong>Provider:</strong> {item.provider}</p>}
    <p className={styles.secondary}><strong>Comparison:</strong> No eligible prior comparison is recorded.</p>
    {reasonText.length > 0 && <p className={styles.caption}><strong>Why:</strong> {reasonText.join(' ')}</p>}
    <Link className={styles.textLink} href={item.href}>View biomarker trend</Link>
  </details>
}

type Props = ({ model: LabFindingsSummaryModel; panels?: never; histories?: never } | { model?: undefined; panels: LabPanel[]; histories: BiomarkerHistory[] }) & { embedded?: boolean; supplemental?: BriefingSupplementalLabUpdate[] }

export default function LabFindingsSummary({ panels, histories, model: suppliedModel, embedded = false, supplemental = [] }: Props) {
  const model = suppliedModel ?? buildLabFindingsSummaryModel(panels!, histories!)
  const Heading = embedded ? 'h3' : 'h2'
  const FindingHeading = embedded ? 'h4' : 'h3'
  if (model.state === 'empty') return null
  const visibleHeadlines = embedded ? model.headlines.slice(0, 4) : model.headlines
  const visibleSupplemental = embedded ? supplemental.slice(0, Math.max(0, 4 - visibleHeadlines.length)) : []
  const visibleUpdateCount = visibleHeadlines.length + visibleSupplemental.length
  const hasVisibleUpdates = visibleUpdateCount > 0

  return <section aria-labelledby="lab-findings-heading">
    <div className={styles.sectionHeading}><Heading id="lab-findings-heading">{embedded ? 'Lab updates' : 'What changed'}</Heading></div>
    {model.state === 'ambiguous_latest' ? <div className={styles.card}><p>Multiple lab panels share the latest recorded test date. MyPepProtocol will not guess which panel is newest.</p></div>
      : hasVisibleUpdates ? <>
        <div className={styles.findingsList} data-count={model.headlines.length} data-visible-count={visibleUpdateCount}>
          {visibleHeadlines.map(finding => {
            const current = finding.evidence.current
            return <article className={`${styles.card} ${embedded ? styles.briefingFinding : ''}`} data-finding-type={finding.type} data-priority={finding.priority} key={finding.id}>
              {!embedded && <span className={styles.eyebrow}>{priorityLabels[finding.priority]}</span>}
              <FindingHeading className={embedded ? styles.briefingUpdateName : undefined}>{finding.biomarkerName}</FindingHeading>
              {finding.evidence.history.length ? <ComparisonPreview finding={finding} /> : current && <p className={styles.value}>{valueText(current.value, current.unit)} · {formatTimelineDate(current.date)}</p>}
              <p className={styles.summary}><strong>{labFindingLabel(finding)}</strong></p>
              <FindingEvidence finding={finding} />
            </article>
          })}
          {visibleSupplemental.map(item => <article className={`${styles.card} ${styles.briefingFinding} ${styles.briefingSupplemental}`} data-update-kind={item.kind} key={item.id}>
            <FindingHeading className={styles.briefingUpdateName}>{item.biomarkerName}</FindingHeading>
            <p className={`${styles.value} ${styles.briefingUpdateValue}`}>{valueText(item.value, item.unit)}</p>
            <p className={styles.summary}><strong>{item.label}</strong></p>
            <SupplementalEvidence item={item} />
          </article>)}
        </div>

        {!embedded && model.previousPanelAmbiguous && <p className={styles.findingsNote}>Some older results share the same test date, so new or missing biomarker comparisons are omitted.</p>}
        {model.newlyMeasuredCount > 1 && <p className={styles.caption}>{model.newlyMeasuredCount} biomarkers are newly measured on this panel. They are grouped here to avoid repetitive cards.</p>}
        {!embedded && model.missingFromLatestCount > 0 && <p className={styles.caption}>{model.missingFromLatestCount} {model.missingFromLatestCount === 1 ? 'biomarker from the previous panel was' : 'biomarkers from the previous panel were'} not recorded on the latest panel.</p>}
      </> : model.state === 'insufficient' ? <div className={styles.card}><p>There is not enough comparable lab history yet to highlight changes.</p></div>
        : <div className={styles.card}><p>No headline changes identified from the comparable results in this panel.</p></div>}
  </section>
}
