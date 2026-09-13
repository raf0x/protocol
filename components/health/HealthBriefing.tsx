'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { buildHealthBriefing, type BriefingProtocols, type HealthBriefingModel } from '../../lib/health/healthBriefing'
import { loadProtocolOverlay } from '../../lib/health/loadProtocolOverlay'
import type { BiomarkerHistory, LabPanel } from '../../lib/health/labs'
import { formatTimelineDate } from '../../lib/health/timeline'
import LabFindingsSummary from './LabFindingsSummary'
import styles from '../../app/health/health.module.css'

export function HealthBriefingView({ model }: { model: HealthBriefingModel }) {
  if (model.state === 'empty') return null
  const snapshot = model.currentSnapshot
  const context = model.protocolContext
  return <section className={styles.briefing} aria-labelledby="health-briefing-heading">
    <div className={styles.sectionHeading}><h2 id="health-briefing-heading">Health briefing</h2><span className={styles.caption}>From your recorded evidence</span></div>

    <section className={styles.card} aria-labelledby="briefing-snapshot-heading">
      <div className={styles.rowHeading}><h3 id="briefing-snapshot-heading">Current snapshot</h3>{snapshot.asOf && <span className={styles.caption}>As of <time dateTime={snapshot.asOf}>{formatTimelineDate(snapshot.asOf)}</time></span>}</div>
      <p className={styles.secondary}>{snapshot.latestDate ? <>
        Latest labs: <time dateTime={snapshot.latestDate}>{formatTimelineDate(snapshot.latestDate)}</time>
        {snapshot.biomarkerCount != null && <> · {snapshot.biomarkerCount} {snapshot.biomarkerCount === 1 ? 'biomarker' : 'biomarkers'}</>}
        {snapshot.latestPanelCount > 1 && <> · {snapshot.latestPanelCount} panels share this date</>}
        {snapshot.latestPanel && (snapshot.latestPanel.panel_name || snapshot.latestPanel.provider) && <span className={styles.briefingSource}>{[snapshot.latestPanel.panel_name, snapshot.latestPanel.provider].filter(Boolean).join(' · ')}</span>}
      </> : 'No lab history is recorded yet.'}</p>
      {snapshot.protocolStatus === 'loading' && <p className={styles.caption} role="status">Loading recorded protocols…</p>}
      {snapshot.compounds.length > 0 && <ul className={styles.briefingRows} aria-label="Recorded active compounds">{snapshot.compounds.map(item => <li key={`${item.protocolId}:${item.compoundId}`}>
        <strong>{item.name}</strong>
        <span>{[item.medication ? `${item.medication.value} ${item.medication.unit}` : 'Dose not confirmed', item.frequency, item.route].filter(Boolean).join(' · ')}</span>
      </li>)}</ul>}
      {snapshot.additionalCompounds > 0 && <p className={styles.caption}>+{snapshot.additionalCompounds} more recorded compounds</p>}
      {snapshot.protocolStatus === 'ready' && !snapshot.compounds.length && <p className={styles.caption}>No confirmed active compound state is recorded for this date.</p>}
    </section>

    <LabFindingsSummary model={model.findings} embedded />

    {snapshot.latestDate && snapshot.protocolStatus === 'ready' && (context.items.length ? <section className={styles.briefingSection} aria-labelledby="briefing-context-heading">
      <h3 id="briefing-context-heading">Recorded protocol context</h3>
      <>
        <p className={styles.secondary}>Recorded between compared tests. Timing alone does not explain a lab change.</p>
        <ul className={styles.briefingRows}>{context.items.map(item => <li key={item.id}><strong>{item.title}</strong><time dateTime={item.date}>{formatTimelineDate(item.date)}</time></li>)}</ul>
        {context.additionalCount > 0 && <p className={styles.caption}>+{context.additionalCount} other recorded changes</p>}
      </>
      <Link className={styles.textLink} href="/health?view=changes">Explore protocol changes</Link>
    </section> : <p className={styles.briefingEmptyContext}>{context.hasComparison ? 'No recorded protocol changes fell strictly between the compared test dates.' : 'Comparable lab dates are needed to place recorded protocol changes in context.'}</p>)}

    {model.gaps.length > 0 && <section className={styles.briefingSection} aria-labelledby="briefing-gaps-heading"><h3 id="briefing-gaps-heading">Gaps in the recorded evidence</h3><ul className={styles.briefingGaps}>{model.gaps.map(gap => <li key={gap.key}>{gap.text}</li>)}</ul></section>}
    {model.reviewActions.length > 0 && <section className={styles.briefingSection} aria-labelledby="briefing-review-heading"><h3 id="briefing-review-heading">Next review</h3><div className={styles.briefingActions}>{model.reviewActions.map((action, index) => <Link className={index === 0 && model.findings.headlines.length === 1 ? styles.primary : styles.textLink} key={action.href} href={action.href}>{action.label}<span aria-hidden="true"> ›</span></Link>)}</div></section>}
  </section>
}

export default function HealthBriefing({ panels, histories }: { panels: LabPanel[]; histories: BiomarkerHistory[] }) {
  const [protocols, setProtocols] = useState<BriefingProtocols>({ status: 'loading', asOf: null })
  const dates = useMemo(() => panels.map(panel => panel.test_date).sort(), [panels])
  const earliestLab = dates[0], latestLab = dates.at(-1)
  useEffect(() => {
    let live = true
    // Client-local calendar date only after hydration. It is an explicit input to
    // the pure model, never a server clock or an inferred lab date.
    const now = new Date()
    const asOf = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const earliest = earliestLab && earliestLab < asOf ? earliestLab : asOf
    const latest = latestLab && latestLab > asOf ? latestLab : asOf
    loadProtocolOverlay(earliest, latest).then(data => {
      if (live) setProtocols({ status: 'ready', asOf, data })
    }).catch(() => {
      if (live) setProtocols({ status: 'unavailable', asOf })
    })
    return () => { live = false }
  }, [earliestLab, latestLab])
  const model = useMemo(() => buildHealthBriefing({ panels, histories, protocols }), [panels, histories, protocols])
  if (!panels.length && protocols.status === 'loading') return null
  return <HealthBriefingView model={model} />
}
