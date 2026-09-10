'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { DoctorReportResponse, ReportRange, ReportSections } from '../../lib/health/report/types'
import styles from '../../app/health/report/report.module.css'

const ranges: { value: ReportRange; label: string }[] = [{ value: '3m', label: '3 months' }, { value: '6m', label: '6 months' }, { value: '12m', label: '12 months' }, { value: 'all', label: 'All history' }]
const sectionLabels: [keyof ReportSections, string][] = [['protocols', 'Current protocols'], ['history', 'Protocol changes'], ['labs', 'Labs and trends'], ['weight', 'Weight'], ['journal', 'Journal summary']]
const formatDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const signed = (value: number) => `${value > 0 ? '+' : ''}${Number(value.toPrecision(5))}`

export default function DoctorReport() {
  const [range, setRange] = useState<ReportRange>('6m')
  const [includeAi, setIncludeAi] = useState(true)
  const [sections, setSections] = useState<ReportSections>({ protocols: true, history: true, labs: true, weight: true, journal: true })
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [response, setResponse] = useState<DoctorReportResponse | null>(null)
  const [message, setMessage] = useState('')
  async function generate(ai = includeAi) {
    setStatus('loading'); setMessage('')
    try {
      const request = await fetch('/api/health-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ range, includeAi: ai }) })
      const body = await request.json() as DoctorReportResponse & { error?: string }
      if (!request.ok) throw new Error(body.error || 'The report is temporarily unavailable.')
      setResponse(body); setStatus('ready')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'The report is temporarily unavailable.'); setStatus('error') }
  }
  function printReport() {
    const previous = document.title
    document.title = `MyPepProtocol-health-report-${response?.report.asOfDate ?? 'export'}`
    window.print(); window.setTimeout(() => { document.title = previous }, 500)
  }
  const report = response?.report
  return <main className={styles.page}>
    <header className={styles.appHeader}><span>Clinician-ready summary</span><h1>Create health report</h1><p>Build a concise report from the health data you have already recorded.</p><Link href="/health">Back to Health</Link></header>
    <section className={styles.controls} aria-labelledby="report-settings"><h2 id="report-settings">Report settings</h2>
      <fieldset><legend>Time period</legend><div className={styles.segmented}>{ranges.map(item => <button type="button" key={item.value} aria-pressed={range === item.value} onClick={() => setRange(item.value)}>{item.label}</button>)}</div></fieldset>
      <fieldset><legend>Include</legend><div className={styles.checkGrid}>{sectionLabels.map(([key, label]) => <label key={key}><input type="checkbox" checked={sections[key]} onChange={event => setSections(value => ({ ...value, [key]: event.target.checked }))} />{label}</label>)}</div></fieldset>
      <label className={styles.aiToggle}><input type="checkbox" checked={includeAi} onChange={event => setIncludeAi(event.target.checked)} /><span><strong>AI-generated executive summary</strong><small>Optional, evidence-grounded, and never required for the factual report.</small></span></label>
      <button className={styles.primary} type="button" onClick={() => void generate()} disabled={status === 'loading'}>{status === 'loading' ? 'Preparing report…' : response ? 'Refresh report data' : 'Preview report'}</button>
      {response && <p className={styles.controlNote}>Changing visible sections updates the preview and PDF without another AI request.</p>}
    </section>
    {status === 'error' && <div className={styles.error} role="alert"><strong>Report unavailable</strong><p>{message}</p></div>}
    {status === 'loading' && <p className={styles.loading} role="status">Assembling the deterministic health record…</p>}
    {report && <>
      <div className={styles.exportBar}><div><strong>Report preview</strong><span>{report.periodLabel}</span></div><button type="button" onClick={printReport}>Download PDF</button></div>
      <article className={styles.report} aria-label="Health report preview">
        <header className={styles.reportHeader}><div><span>MyPepProtocol</span><h1>Longitudinal Health Summary</h1></div><dl><div><dt>Generated</dt><dd>{formatDate(report.asOfDate)}</dd></div><div><dt>Period</dt><dd>{report.periodLabel}</dd></div></dl></header>
        {includeAi && <section className={styles.reportSection}><h2>AI-generated executive summary</h2>{response.aiSummary ? <><p className={styles.lead}>{response.aiSummary.summary}</p><ul>{response.aiSummary.findings.map(item => <li key={item.title}><strong>{item.title}:</strong> {item.detail} <small>{item.confidence} data confidence</small></li>)}</ul></> : <p className={styles.empty}>{response.aiError || 'No AI summary was requested. The factual report remains complete.'}</p>}<p className={styles.disclaimer}>This summary organizes recorded data. It does not diagnose, recommend treatment, or establish causality.</p></section>}
        {sections.protocols && <section className={styles.reportSection}><h2>Current protocols</h2>{report.currentProtocols.length ? <div className={styles.protocolTable}>{report.currentProtocols.map((item, index) => <div className={styles.protocolRow} key={`${item.name}-${index}`}><div><strong>{item.name}</strong><span>{item.status}{item.startDate ? ` · Started ${formatDate(item.startDate)}` : ''}</span></div><div><strong>{item.dose}</strong><span>{[item.frequency, item.route].filter(Boolean).join(' · ')}</span>{!item.verified && <small>Unverified dose semantics</small>}</div></div>)}</div> : <p className={styles.empty}>No active protocols were recorded as of this report date.</p>}</section>}
        {sections.history && <section className={styles.reportSection}><h2>Protocol history</h2>{report.protocolHistory.length ? <ol className={styles.history}>{report.protocolHistory.map((item, index) => <li key={`${item.date}-${item.title}-${index}`}><time>{formatDate(item.date)}</time><div><strong>{item.title}</strong>{item.detail && <p>{item.detail}</p>}<small>{item.source} · {item.confidence} data confidence</small></div></li>)}</ol> : <p className={styles.empty}>No protocol changes were recorded in this period.</p>}</section>}
        {sections.labs && <><section className={styles.reportSection}><h2>Laboratory summary</h2>{report.labPanels.length ? <div className={styles.panelList}>{report.labPanels.map((panel, index) => <div key={`${panel.date}-${index}`}><strong>{formatDate(panel.date)}</strong><span>{panel.name}{panel.provider ? ` · ${panel.provider}` : ''}</span><small>{panel.resultCount} results</small></div>)}</div> : <p className={styles.empty}>No lab panels were recorded in this period.</p>}{report.highlightedResults.length > 0 && <><h3>Outside supplied ranges or stored flags</h3><div className={styles.resultTable}>{report.highlightedResults.map((item, index) => <div key={`${item.date}-${item.name}-${index}`}><strong>{item.name}</strong><span>{item.value}</span><small>{item.status} · {item.reference} · {formatDate(item.date)}</small></div>)}</div></>}</section>
          <section className={styles.reportSection}><h2>Largest recorded biomarker changes</h2>{report.trends.length ? <div className={styles.trendTable}>{report.trends.map(item => <div key={`${item.name}-${item.unit}`}><div><strong>{item.name}</strong><small>{formatDate(item.previousDate)} to {formatDate(item.latestDate)}</small></div><span>{item.previous} → {item.latest} {item.unit}</span><b>{signed(item.delta)} {item.unit}{item.percent == null ? '' : ` · ${signed(item.percent)}%`}</b></div>)}</div> : <p className={styles.empty}>No repeated same-unit numeric biomarkers were available for comparison.</p>}</section></>}
        {sections.weight && <section className={styles.reportSection}><h2>Weight trend</h2>{report.weight ? <><div className={styles.weightSummary}><div><span>Latest</span><strong>{report.weight.latest} lb</strong><small>{formatDate(report.weight.latestDate)}</small></div><div><span>Change</span><strong>{signed(report.weight.delta)} lb</strong><small>from {report.weight.earliest} lb</small></div></div>{report.weight.points.length > 1 && <WeightChart points={report.weight.points} />}</> : <p className={styles.empty}>No weight entries were recorded in this period.</p>}</section>}
        {sections.journal && <section className={styles.reportSection}><h2>Structured journal summary</h2>{report.journal ? <><p>{report.journal.entryCount} check-ins from {formatDate(report.journal.firstDate)} through {formatDate(report.journal.lastDate)}.</p><div className={styles.metricGrid}>{report.journal.averages.map(item => <div key={item.label}><span>{item.label}</span><strong>{item.value}{item.unit}</strong></div>)}</div></> : <p className={styles.empty}>Structured mood, energy, sleep, and hunger entries were sparse or unavailable.</p>}</section>}
        {sections.labs && sections.history && <section className={styles.reportSection}><h2>Protocol changes around lab dates</h2>{report.protocolLabContext.length ? <ul className={styles.contextList}>{report.protocolLabContext.map((item, index) => <li key={`${item.labDate}-${item.eventDate}-${index}`}><strong>{item.panel} · {formatDate(item.labDate)}</strong><span>{item.event} · {formatDate(item.eventDate)}</span><small>{item.timing}. Timing alone does not establish cause.</small></li>)}</ul> : <p className={styles.empty}>No recorded protocol changes occurred within 30 days of a lab panel in this period.</p>}</section>}
        <section className={styles.reportSection}><h2>Data limitations</h2>{report.limitations.length ? <ul>{report.limitations.map(item => <li key={item}>{item}</li>)}</ul> : <p>No material data limitations were detected in the selected report sections.</p>}</section>
        <footer><span>Generated by MyPepProtocol</span><span>For discussion with a qualified healthcare professional</span></footer>
      </article>
    </>}
  </main>
}

function WeightChart({ points }: { points: { date: string; value: number }[] }) {
  const values = points.map(point => point.value), min = Math.min(...values), max = Math.max(...values), span = max - min
  const path = points.map((point, index) => `${12 + index / (points.length - 1) * 276},${92 - (span ? (point.value - min) / span : .5) * 64}`).join(' ')
  return <figure className={styles.weightChart}><svg viewBox="0 0 300 112" role="img" aria-label={`Weight from ${points[0].value} to ${points.at(-1)!.value} pounds`}><polyline points={path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg><figcaption>{formatDate(points[0].date)} to {formatDate(points.at(-1)!.date)}</figcaption></figure>
}
