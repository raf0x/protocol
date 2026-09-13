import Link from 'next/link'
import { labGapText } from '../../lib/health/labEvidence'
import { type LabFinding, type LabFindingPriority, type LabFindingType } from '../../lib/health/labFindings'
import type { BiomarkerHistory, LabPanel } from '../../lib/health/labs'
import { formatTimelineDate } from '../../lib/health/timeline'
import styles from '../../app/health/health.module.css'

import { buildLabFindingsSummaryModel, type LabFindingsSummaryModel } from '../../lib/health/labFindingsSummary'
export { buildLabFindingsSummaryModel, type LabFindingsSummaryModel } from '../../lib/health/labFindingsSummary'

const findingLabels: Record<LabFindingType, string> = {
  newly_outside_range: 'Newly outside supplied range',
  returned_to_range: 'Returned to supplied range',
  persistently_outside_range: 'Outside supplied range on both eligible dates',
  newly_measured: 'Newly measured',
  missing_from_latest_panel: 'Not measured on latest panel',
  increased: 'Increased from previous eligible result',
  decreased: 'Decreased from previous eligible result',
  unchanged: 'Unchanged from previous eligible result',
  outside_previously_observed_values: 'Outside previously observed values',
  insufficient_history: 'Insufficient comparable history',
}

const priorityLabels: Record<LabFindingPriority, string> = {
  attention: 'Review',
  context: 'Context',
  informational: 'Info',
}

function valueText(value: number, unit: string) {
  return `${String(value)}${unit ? ` ${unit}` : ''}`
}

function changeText(finding: LabFinding) {
  const comparison = finding.evidence.comparison
  if (!comparison) return null
  const sign = comparison.delta > 0 ? '+' : ''
  const percent = comparison.percent == null ? '' : ` (${comparison.percent > 0 ? '+' : ''}${String(comparison.percent)}%)`
  return `${sign}${String(comparison.delta)}${comparison.current.unit ? ` ${comparison.current.unit}` : ''}${percent}`
}

function Evidence({ finding }: { finding: LabFinding }) {
  const current = finding.evidence.current
  const previous = finding.evidence.previous
  const comparison = finding.evidence.comparison
  const extent = finding.evidence.priorObservedExtent
  const limitations = [...new Set(finding.limitations)]

  return <details className={styles.formDetails}>
    <summary>Evidence</summary>
    <p className={styles.secondary}>{finding.reason}</p>
    {current && <p className={styles.secondary}><strong>Current:</strong> {valueText(current.value, current.unit)} · {formatTimelineDate(current.date)}</p>}
    {previous && <p className={styles.secondary}><strong>Previous:</strong> {valueText(previous.value, previous.unit)} · {formatTimelineDate(previous.date)}</p>}
    {comparison && <p className={styles.secondary}><strong>Change:</strong> {changeText(finding)} over {comparison.elapsedDays} days</p>}
    {extent && <p className={styles.secondary}><strong>Prior observed values:</strong> {valueText(extent.min, finding.unit)} to {valueText(extent.max, finding.unit)} across {extent.count} earlier eligible readings</p>}
    {limitations.length > 0 && <p className={styles.caption}><strong>Limitations:</strong> {limitations.map(gap => labGapText[gap]).join(' ')}</p>}
    <Link className={styles.textLink} href={`/health?biomarker=${encodeURIComponent(finding.biomarkerKey)}`}>View biomarker trend</Link>
  </details>
}

type Props = ({ model: LabFindingsSummaryModel; panels?: never; histories?: never } | { model?: undefined; panels: LabPanel[]; histories: BiomarkerHistory[] }) & { embedded?: boolean }

export default function LabFindingsSummary({ panels, histories, model: suppliedModel, embedded = false }: Props) {
  const model = suppliedModel ?? buildLabFindingsSummaryModel(panels!, histories!)
  const Heading = embedded ? 'h3' : 'h2'
  const FindingHeading = embedded ? 'h4' : 'h3'
  if (model.state === 'empty') return null

  return <section aria-labelledby="lab-findings-heading">
    <div className={styles.sectionHeading}><Heading id="lab-findings-heading">What changed</Heading></div>
    {model.state === 'ambiguous_latest' ? <div className={styles.card}><p>Multiple lab panels share the latest recorded test date. MyPepProtocol will not guess which panel is newest.</p></div>
      : model.state === 'insufficient' ? <div className={styles.card}><p>There is not enough comparable lab history yet to highlight changes.</p></div>
      : <>
        {model.headlines.length ? <div className={styles.findingsList} data-count={model.headlines.length}>{model.headlines.map(finding => {
          const current = finding.evidence.current
          return <article className={styles.card} data-finding-type={finding.type} data-priority={finding.priority} key={finding.id}>
            <div className={styles.rowHeading}>
              <div><span className={styles.eyebrow}>{priorityLabels[finding.priority]}</span><FindingHeading>{finding.biomarkerName}</FindingHeading></div>
              {current && <p className={styles.value}>{valueText(current.value, current.unit)}</p>}
            </div>
            <p className={styles.summary}><strong>{findingLabels[finding.type]}</strong></p>
            <Evidence finding={finding} />
          </article>
        })}</div> : <div className={styles.card}><p>No headline changes identified from the comparable results in this panel.</p></div>}

        {!embedded && model.previousPanelAmbiguous && <p className={styles.findingsNote}>Some older results share the same test date, so new or missing biomarker comparisons are omitted.</p>}
        {model.newlyMeasuredCount > 1 && <p className={styles.caption}>{model.newlyMeasuredCount} biomarkers are newly measured on this panel. They are grouped here to avoid repetitive cards.</p>}
        {!embedded && model.missingFromLatestCount > 0 && <p className={styles.caption}>{model.missingFromLatestCount} {model.missingFromLatestCount === 1 ? 'biomarker from the previous panel was' : 'biomarkers from the previous panel were'} not recorded on the latest panel.</p>}
      </>}
  </section>
}
