import Link from 'next/link'
import { buildLabTrajectory, labGapText, labPanelMembership, toLabEvidenceObservation } from '../../lib/health/labEvidence'
import { deriveLabFindings, selectHeadlineFindings, type LabFinding, type LabFindingPriority, type LabFindingType } from '../../lib/health/labFindings'
import type { BiomarkerHistory, LabPanel } from '../../lib/health/labs'
import { formatTimelineDate } from '../../lib/health/timeline'
import styles from '../../app/health/health.module.css'

const MAX_HEADLINES = 4

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

export default function LabFindingsSummary({ panels, histories }: { panels: LabPanel[]; histories: BiomarkerHistory[] }) {
  const model = buildLabFindingsSummaryModel(panels, histories)
  if (model.state === 'empty') return null

  return <section aria-labelledby="lab-findings-heading">
    <div className={styles.sectionHeading}><h2 id="lab-findings-heading">What changed</h2></div>
    {model.state === 'ambiguous_latest' ? <div className={styles.card}><p>Multiple lab panels share the latest recorded test date. MyPepProtocol will not guess which panel is newest.</p></div>
      : model.state === 'insufficient' ? <div className={styles.card}><p>There is not enough comparable lab history yet to highlight changes.</p></div>
      : <>
        {model.headlines.length ? <div className={styles.findingsList} data-count={model.headlines.length}>{model.headlines.map(finding => {
          const current = finding.evidence.current
          return <article className={styles.card} data-finding-type={finding.type} data-priority={finding.priority} key={finding.id}>
            <div className={styles.rowHeading}>
              <div><span className={styles.eyebrow}>{priorityLabels[finding.priority]}</span><h3>{finding.biomarkerName}</h3></div>
              {current && <p className={styles.value}>{valueText(current.value, current.unit)}</p>}
            </div>
            <p className={styles.summary}><strong>{findingLabels[finding.type]}</strong></p>
            <Evidence finding={finding} />
          </article>
        })}</div> : <div className={styles.card}><p>No headline changes identified from the comparable results in this panel.</p></div>}

        {model.previousPanelAmbiguous && <p className={styles.findingsNote}>Some older results share the same test date, so new or missing biomarker comparisons are omitted.</p>}
        {model.newlyMeasuredCount > 1 && <p className={styles.caption}>{model.newlyMeasuredCount} biomarkers are newly measured on this panel. They are grouped here to avoid repetitive cards.</p>}
        {model.missingFromLatestCount > 0 && <p className={styles.caption}>{model.missingFromLatestCount} {model.missingFromLatestCount === 1 ? 'biomarker from the previous panel was' : 'biomarkers from the previous panel were'} not recorded on the latest panel.</p>}
      </>}
  </section>
}
