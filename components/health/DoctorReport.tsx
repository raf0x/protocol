'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { DoctorReportResponse, ReportContextNote, ReportRange, ReportReading, ReportProtocolTimelineItem } from '../../lib/health/report/types'
import type { LabFinding } from '../../lib/health/labFindings'
import styles from '../../app/health/report/report.module.css'
import AiConsentDialog from './AiConsentDialog'

const ranges: { value: ReportRange; label: string }[] = [
  { value: '3m', label: '3 months' },
  { value: '6m', label: '6 months' },
  { value: '12m', label: '12 months' },
  { value: 'all', label: 'All history' },
]

const formatDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const compactDate = (value: string) => new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
const number = (value: number) => Number(value.toPrecision(5))
const decimal = (value: number, digits = 1) => Number(value.toFixed(digits))
const signed = (value: number) => `${value > 0 ? '+' : ''}${number(value)}`
const signedPercent = (value: number) => `${value > 0 ? '+' : ''}${decimal(value)}%`
const medication = (value: { value: number; unit: string } | null) => value ? `${number(value.value)} ${value.unit}` : null

function contextNote(note: ReportContextNote) {
  if (note.kind === 'period') return { label: 'Report period', value: note.start ? `${formatDate(note.start)} – ${formatDate(note.end)}` : `All recorded history through ${formatDate(note.end)}` }
  if (note.kind === 'latest_panel') return { label: 'Latest labs', value: formatDate(note.date) }
  if (note.kind === 'active_items') return { label: 'Current protocols', value: `${note.count} active recorded ${note.count === 1 ? 'item' : 'items'}` }
  return { label: 'Important context', value: note.text }
}

function readingStatus(reading: ReportReading) {
  if (reading.reference.status === 'normal') return 'Within supplied range/status'
  if (['high', 'low', 'abnormal'].includes(reading.reference.status)) return 'Outside supplied range/status'
  return 'Range/status unavailable'
}

function findingLabel(type: LabFinding['type']) {
  const labels: Record<LabFinding['type'], string> = {
    newly_outside_range: 'Newly outside supplied range',
    returned_to_range: 'Returned inside supplied range',
    persistently_outside_range: 'Outside supplied range on both dates',
    newly_measured: 'Newly measured',
    missing_from_latest_panel: 'Missing from latest panel',
    increased: 'Increased',
    decreased: 'Decreased',
    unchanged: 'Unchanged',
    outside_previously_observed_values: 'Outside previously observed values',
    insufficient_history: 'Insufficient comparison history',
  }
  return labels[type]
}

function findingFacts(finding: LabFinding) {
  const comparison = finding.evidence.comparison
  if (comparison) return {
    current: `${number(comparison.current.value)} ${finding.unit} · ${formatDate(comparison.current.date)}`,
    detail: `${number(comparison.previous.value)} ${finding.unit} → ${number(comparison.current.value)} ${finding.unit} · ${signed(comparison.delta)} ${finding.unit}${comparison.percent == null ? '' : ` · ${signedPercent(comparison.percent)}`} over ${comparison.elapsedDays} days`,
  }
  const current = finding.evidence.current
  return { current: current ? `${number(current.value)} ${finding.unit} · ${formatDate(current.date)}` : finding.reason, detail: finding.reason }
}

function sameMedication(a: ReportProtocolTimelineItem['before'], b: ReportProtocolTimelineItem['after']) {
  return Boolean(a && b && a.value === b.value && a.unit === b.unit)
}

function timelineDetail(item: ReportProtocolTimelineItem) {
  const parts: string[] = []
  if ((item.before || item.after) && !sameMedication(item.before, item.after)) parts.push(`${medication(item.before) ?? 'not recorded'} → ${medication(item.after) ?? 'not recorded'}`)
  const state = item.recordedStates[0]
  if (state) {
    const recorded = [medication(state.medication), state.frequency, state.route].filter(Boolean).join(' · ')
    if (recorded) parts.push(recorded)
  }
  return parts
}

function overviewBullets(text: string) {
  const humanized = text.replace(/\b(\d{4}-\d{2}-\d{2})\b/g, match => formatDate(match))
  const sentences = humanized.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [humanized]
  return sentences.map(item => item.trim()).filter(Boolean).slice(0, 3)
}

function reviewText(finding: LabFinding) {
  const current = finding.evidence.current
  const value = current ? `${number(current.value)} ${finding.unit}` : null
  if (finding.type === 'outside_previously_observed_values') return `${finding.biomarkerName}: ${value ?? 'the latest recorded value'} is outside the previously observed eligible values.`
  if (finding.type === 'newly_outside_range') return `${finding.biomarkerName}: the latest recorded result is newly outside its supplied range or reported status.`
  if (finding.type === 'persistently_outside_range') return `${finding.biomarkerName}: eligible recorded results remain outside the supplied range or reported status.`
  if (finding.type === 'missing_from_latest_panel') return `${finding.biomarkerName}: no eligible result is recorded in the latest panel.`
  return null
}

export default function DoctorReport() {
  const [range, setRange] = useState<ReportRange>('6m')
  const [includeAi, setIncludeAi] = useState(true)
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [response, setResponse] = useState<DoctorReportResponse | null>(null)
  const [message, setMessage] = useState('')
  const [consentOpen, setConsentOpen] = useState(false)

  async function generate(ai = includeAi) {
    setStatus('loading'); setMessage('')
    try {
      const request = await fetch('/api/health-report', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Timezone': Intl.DateTimeFormat().resolvedOptions().timeZone }, body: JSON.stringify({ range, includeAi: ai }) })
      const body = await request.json() as DoctorReportResponse & { error?: string; code?: string; retryAfter?: number }
      if (request.status === 403 && body.code === 'AI_CONSENT_REQUIRED') {
        setStatus('idle'); setConsentOpen(true); return
      }
      if (request.status === 429 && body.code === 'RATE_LIMITED') {
        const minutes = Math.max(1, Math.ceil((body.retryAfter ?? 60) / 60))
        throw new Error(`You've reached the report limit. Try again in about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`)
      }
      if (!request.ok) throw new Error(body.error || 'The report is temporarily unavailable.')
      setResponse(body); setStatus('ready')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The report is temporarily unavailable.')
      setStatus('error')
    }
  }

  function printReport() {
    const previous = document.title
    document.title = `MyPepProtocol-health-report-${response?.report.asOfDate ?? 'export'}`
    window.print()
    window.setTimeout(() => { document.title = previous }, 500)
  }

  const report = response?.report
  const intelligence = report?.intelligence
  const timeline = intelligence?.protocolTimeline.slice(0, 16) ?? []
  const additionalTimeline = Math.max(0, (intelligence?.protocolTimeline.length ?? 0) - timeline.length)
  const visibleDomains = intelligence?.biomarkerDomains.map(domain => ({ ...domain, rows: domain.rows.filter(row => row.readings.length > 0) })).filter(domain => domain.rows.length > 0) ?? []
  const incompleteMarkerCount = intelligence?.biomarkerDomains.flatMap(domain => domain.rows).filter(row => row.readings.length === 0).length ?? 0
  const specificReviews = intelligence ? [
    ...intelligence.reviewItems.filter(item => item.findingIds.length > 0).map(item => item.text),
    ...intelligence.headlineChanges.map(reviewText).filter((item): item is string => Boolean(item)),
  ].filter((item, index, rows) => rows.indexOf(item) === index).slice(0, 5) : []
  const qualitativeReviews = report?.highlightedResults.filter(item => !/[0-9]/.test(item.value) && item.status !== 'normal')
    .map(item => `${item.name}: ${item.value} · ${formatDate(item.date)} · ${item.status} reported status`).slice(0, Math.max(0, 5 - specificReviews.length)) ?? []
  const reviewItems = [...specificReviews, ...qualitativeReviews].slice(0, 5)
  const reviewSet = new Set(reviewItems)
  const verification = intelligence ? intelligence.verification.filter(item => !reviewSet.has(item.text)).map(item => item.text) : []
  if (incompleteMarkerCount > 0 && !intelligence?.verification.some(item => ['measurement_units', 'comparison_gaps'].includes(item.code))) {
    verification.unshift(`${incompleteMarkerCount} recorded biomarker ${incompleteMarkerCount === 1 ? 'entry could' : 'entries could'} not be placed in the longitudinal table because usable numeric evidence was incomplete.`)
  }
  const verificationItems = verification.filter((item, index, rows) => rows.indexOf(item) === index).slice(0, 6)

  return <main className={styles.page}>
    <AiConsentDialog open={consentOpen} onCancel={() => setConsentOpen(false)} onGranted={() => { setConsentOpen(false); void generate(true) }} />

    <header className={styles.appHeader}>
      <span>Clinician-ready summary</span>
      <h1>Create health report</h1>
      <p>Turn your recorded labs and protocol history into a concise longitudinal report.</p>
      <Link href="/health">Back to Health</Link>
    </header>

    <section className={styles.controls} aria-labelledby="report-settings">
      <div className={styles.controlHeading}><div><span>Report setup</span><h2 id="report-settings">Choose the period</h2></div><p>Facts stay deterministic. AI only phrases an optional short overview.</p></div>
      <div className={styles.segmented} aria-label="Report period">{ranges.map(item => <button type="button" key={item.value} aria-pressed={range === item.value} onClick={() => { setRange(item.value); setResponse(null); setStatus('idle') }}>{item.label}</button>)}</div>
      <label className={styles.aiToggle}><input type="checkbox" checked={includeAi} onChange={event => { setIncludeAi(event.target.checked); setResponse(null); setStatus('idle') }} /><span><strong>AI-assisted overview</strong><small>Optional wording only. The report facts do not depend on AI.</small></span></label>
      <button className={styles.primary} type="button" onClick={() => void generate()} disabled={status === 'loading'}>{status === 'loading' ? 'Preparing report…' : response ? 'Refresh report' : 'Preview report'}</button>
    </section>

    {status === 'error' && <div className={styles.error} role="alert"><strong>Report unavailable</strong><p>{message}</p></div>}
    {status === 'loading' && <p className={styles.loading} role="status">Assembling your recorded evidence…</p>}

    {report && intelligence && <>
      <div className={styles.exportBar}><div><strong>Report preview</strong><span>{report.periodLabel}</span></div><button type="button" onClick={printReport}>Save PDF</button></div>

      <article className={styles.report} aria-label="Longitudinal health report preview">
        <header className={styles.reportHeader}>
          <div><span>MyPepProtocol</span><h1>Longitudinal Health Summary</h1><p>Recorded evidence organized for clinical review.</p></div>
          <dl><div><dt>Generated</dt><dd>{formatDate(report.asOfDate)}</dd></div><div><dt>Period</dt><dd>{report.periodLabel}</dd></div></dl>
        </header>

        <section className={styles.reportSection} aria-labelledby="context-notes-heading">
          <div className={styles.sectionTitle}><span>01</span><div><h2 id="context-notes-heading">Key Context Notes</h2><p>The minimum context needed to read the report correctly.</p></div></div>
          <div className={styles.contextGrid}>{intelligence.contextNotes.map((note, index) => { const item = contextNote(note); return <div key={`${note.kind}-${index}`}><span>{item.label}</span><strong>{item.value}</strong></div> })}</div>
          {includeAi && <div className={styles.aiOverview}><span>AI-assisted overview</span>{response.aiSummary ? <ul>{overviewBullets(response.aiSummary.overview).map((item, index) => <li key={index}>{item}</li>)}</ul> : <p>{response.aiError || 'The optional overview is unavailable. The deterministic report below is complete.'}</p>}</div>}
        </section>

        <section className={styles.reportSection} aria-labelledby="domains-heading">
          <div className={styles.sectionTitle}><span>02</span><div><h2 id="domains-heading">Longitudinal Biomarker Domains</h2><p>Selected recorded dates, grouped by biomarker domain. Same-day ambiguity is never averaged.</p></div></div>
          {visibleDomains.length ? <div className={styles.domainList}>{visibleDomains.map(domain => <section className={styles.domain} key={domain.category}>
            <div className={styles.domainHeading}><h3>{domain.category}</h3><span>{domain.rows.length} {domain.rows.length === 1 ? 'marker' : 'markers'}</span></div>
            <div className={styles.domainTableHeader} aria-hidden="true"><span>Biomarker</span><span>Recorded values</span><span>Change</span><span>Latest status</span></div>
            <div className={styles.biomarkerTable}>{domain.rows.map(row => {
              const latest = row.readings.at(-1)!
              const newestRecordedExcluded = Boolean(row.latestRecordedDate && latest.date !== row.latestRecordedDate)
              return <div className={styles.biomarkerRow} key={`${row.biomarkerKey}:${row.unit}`}>
                <div className={styles.biomarkerName}><strong>{row.name}</strong><span>{row.unit || 'Unit not recorded'}</span></div>
                <div className={styles.readingTrack}>{row.readings.map(reading => <div key={`${reading.resultId}:${reading.date}`}><time>{compactDate(reading.date)}</time><strong>{number(reading.value)}</strong></div>)}</div>
                <div className={styles.biomarkerChange}>{row.comparison ? <strong>{signed(row.comparison.delta)} {row.unit}<span>{row.comparison.percent == null ? '' : signedPercent(row.comparison.percent)}</span></strong> : <span>—</span>}</div>
                <div className={styles.biomarkerStatus}><span>{newestRecordedExcluded ? `Latest ${compactDate(row.latestRecordedDate!)} not eligible` : readingStatus(latest)}</span></div>
              </div>
            })}</div>
          </section>)}</div> : <p className={styles.empty}>No eligible numeric biomarker history is recorded in this period.</p>}
          {incompleteMarkerCount > 0 && <p className={styles.incompleteNote}>{incompleteMarkerCount} additional recorded biomarker {incompleteMarkerCount === 1 ? 'entry has' : 'entries have'} incomplete numeric evidence and {incompleteMarkerCount === 1 ? 'is' : 'are'} summarized under verification.</p>}
        </section>

        <section className={styles.reportSection} aria-labelledby="timeline-heading">
          <div className={styles.sectionTitle}><span>03</span><div><h2 id="timeline-heading">Recorded Protocol Timeline</h2><p>Recorded treatment context only. Timing does not establish why a lab value changed.</p></div></div>
          {timeline.length ? <ol className={styles.timeline}>{timeline.map(item => <li key={item.id}>
            <time>{formatDate(item.date)}</time><div><strong>{item.title}</strong>{timelineDetail(item).map((line, index) => <p key={index}>{line}</p>)}</div>
          </li>)}</ol> : <p className={styles.empty}>No recorded protocol changes are available in this report period.</p>}
          {additionalTimeline > 0 && <p className={styles.truncatedNote}>+{additionalTimeline} additional recorded changes omitted from this concise view.</p>}
        </section>

        <section className={styles.reportSection} aria-labelledby="headline-heading">
          <div className={styles.sectionTitle}><span>04</span><div><h2 id="headline-heading">Top Headline Changes</h2><p>Canonical deterministic findings, ranked by the shared Health findings model.</p></div></div>
          {intelligence.headlineChanges.length ? <div className={styles.headlineList}>{intelligence.headlineChanges.map(finding => { const facts = findingFacts(finding); return <div className={styles.headline} key={finding.id}>
            <div><span>{findingLabel(finding.type)}</span><h3>{finding.biomarkerName}</h3></div><strong>{facts.current}</strong><p>{facts.detail}</p>
          </div> })}</div> : <p className={styles.empty}>No headline lab changes were derived from the eligible recorded evidence.</p>}
        </section>

        <section className={styles.reportSection} aria-labelledby="review-heading">
          <div className={styles.sectionTitle}><span>05</span><div><h2 id="review-heading">Items to Review</h2><p>Specific recorded facts worth verifying or discussing. These are not treatment recommendations.</p></div></div>
          {reviewItems.length ? <ul className={styles.reviewList}>{reviewItems.map(item => <li key={item}><span aria-hidden="true">•</span><p>{item}</p></li>)}</ul> : <p className={styles.empty}>No specific additional review items were identified from the recorded evidence.</p>}
        </section>

        <section className={styles.reportSection} aria-labelledby="verification-heading">
          <div className={styles.sectionTitle}><span>06</span><div><h2 id="verification-heading">Data Verification &amp; Limitations</h2><p>Report-wide evidence quality and completeness notes.</p></div></div>
          {verificationItems.length ? <ul className={styles.verificationList}>{verificationItems.map(item => <li key={item}>{item}</li>)}</ul> : <p className={styles.empty}>No material verification limitations were detected in the selected report period.</p>}
        </section>

        <footer><span>Generated by MyPepProtocol</span><span>Recorded evidence for discussion with a qualified healthcare professional</span></footer>
      </article>
    </>}
  </main>
}
