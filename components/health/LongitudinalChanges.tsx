'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { LongitudinalObservation, LongitudinalResult, Measurement } from '../../lib/health/longitudinal/types'
import { comparableLabObservations, protocolChangeOptions, protocolChangeUrl } from '../../lib/health/longitudinal/presentation'
import { formatTimelineDate } from '../../lib/health/timeline'
import styles from '../../app/health/health.module.css'

const number = (value: number) => Number(value.toPrecision(6)).toString()
const strength = { repeated: 'Repeated measurements', limited: 'Limited measurements', insufficient: 'Insufficient comparable data' }
function Reading({ row }: { row: Measurement }) {
  const href = `/health?panel=${encodeURIComponent(row.source.parentId!)}`
  return <li className={styles.result}><div className={styles.rowHeading}><strong>{number(row.value)} {row.unit}</strong><time dateTime={row.date}>{formatTimelineDate(row.date)}</time></div>
    <Link className={styles.textLink} href={href}>{row.source.label}</Link>
    {row.reference && <p className={styles.secondary}>Supplied reference: {row.reference.low ?? ''}{row.reference.low != null && row.reference.high != null ? '–' : ''}{row.reference.high ?? ''} {row.unit} {row.reference.text || ''}{row.reference.low == null && row.reference.high == null && !row.reference.text ? '(not supplied)' : ''}</p>}
  </li>
}

export default function LongitudinalChanges() {
  const router = useRouter()
  const query = useSearchParams()
  const changeId = query.get('change') || ''
  const [result, setResult] = useState<LongitudinalResult | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health-longitudinal', { cache: 'no-store', signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error(response.status === 401 ? 'Sign in again to view your recorded changes.' : 'Your recorded changes are temporarily unavailable. Please try again.')
      const data: LongitudinalResult = await response.json()
      if (!controller.signal.aborted) setResult(data)
    }).catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load recorded changes.') })
    return () => controller.abort()
  }, [attempt])
  if (error) return <section className={styles.card} role="alert"><h2>History unavailable</h2><p>{error}</p><button type="button" onClick={() => { setError(''); setAttempt(value => value + 1) }}>Try again</button><Link className={styles.textLink} href="/auth/login">Sign in</Link></section>
  if (!result) return <p role="status">Matching recorded changes and measurements…</p>
  const options = protocolChangeOptions(result.interventions)
  const unavailable = Boolean(changeId && !options.some(item => item.id === changeId))
  return <section aria-labelledby="longitudinal-heading">
    <div className={styles.card}><span className={styles.eyebrow}>Recorded patterns · No AI needed</span><h2 id="longitudinal-heading">Changes following protocol updates</h2>
      <p>Lab biomarkers measured before and afterward, with the dates and other changes that matter. This shows timing, not what caused a change.</p>
      <p className={styles.caption}>Nearest baseline within {result.window.baselineDays} days before each update; follow-up {result.window.followupStartDays}–{result.window.followupEndDays} days afterward, through {formatTimelineDate(result.asOf)}. These are comparison windows, not expected medication response times.</p>
    </div>
    <div className={styles.form}><label htmlFor="protocol-change">Protocol change
      <select id="protocol-change" value={changeId} onChange={event => router.push(protocolChangeUrl(query.toString(), event.target.value), { scroll: false })}>
        <option value="">All changes</option>
        {unavailable && <option value={changeId}>Unavailable protocol change</option>}
        {options.map(item => <option key={item.id} value={item.id}>{item.title} · {formatTimelineDate(item.date)}</option>)}
      </select>
    </label></div>
    <ObservationList key={changeId} observations={comparableLabObservations(result.observations, changeId)} selected={Boolean(changeId)} unavailable={unavailable} />
    <details className={styles.trend}><summary><strong>Derived health periods</strong><span>Regimen at each recorded boundary, not an administration log</span></summary>
      {result.versions.slice().reverse().map(version => <div key={version.id} className={styles.trendGroup}><h3>{version.start} → {version.endExclusive ? `${version.endExclusive} (exclusive)` : `${result.asOf} (through today)`}</h3>
        <p className={styles.secondary}>{version.measurementIds.length} lab measurements recorded in this period.</p>
        {version.protocols.length ? <ul className={styles.secondary}>{version.protocols.map(state => <li key={`${state.protocolId}:${state.compoundId}`}><strong>{state.name}</strong> · {state.medication ? `${number(state.medication.value)} ${state.medication.unit}` : state.administration || 'Medication dose not confirmed'}{state.frequency ? ` · ${state.frequency}` : ''}{state.route ? ` · ${state.route}` : ''}<p>{state.provenance === 'snapshot' ? 'Recorded snapshot' : 'Saved-plan reconstruction'}. {state.limitations.join(' ')}</p></li>)}</ul> : <p className={styles.secondary}>No reconstructable active regimen at this boundary.</p>}
      </div>)}
    </details>
    <details className={styles.formDetails}><summary>Coverage & interpretation limits</summary><ul className={styles.secondary}>{result.limitations.map(value => <li key={value}>{value}</li>)}</ul></details>
  </section>
}

// A changed URL key remounts only this list, resetting pagination for selection
// and browser back/forward while keeping focus on the persistent select.
export function ObservationList({ observations, selected, unavailable = false }: { observations: LongitudinalObservation[]; selected: boolean; unavailable?: boolean }) {
  const [visible, setVisible] = useState(8)
  if (!observations.length) return <div className={styles.card} role="status">
    <h3>{unavailable ? 'This protocol change is not available in the loaded history.' : selected ? 'No comparable lab changes were recorded around this protocol update.' : 'No comparable lab changes recorded yet.'}</h3>
    <p>{selected ? 'Lab measurements need a comparable result before and after the selected change.' : 'Lab measurements need comparable results before and after a recorded protocol change.'}</p>
    <Link className={styles.textLink} href="/timeline">View recorded history</Link>
  </div>
  return <>
    {observations.slice(0, visible).map(item => {
      const latest = item.changes.at(-1), reading = item.followups.find(row => row.id === latest?.measurementId)
      return <article key={item.id} className={styles.card}>
        <div className={styles.rowHeading}><span className={styles.eyebrow}>{item.intervention.title}</span><time dateTime={item.intervention.date} className={styles.caption}>{formatTimelineDate(item.intervention.date)}</time></div>
        <h3>{item.metric.name}</h3>
        {latest && reading && item.baseline ? <><p className={styles.value}>{latest.delta > 0 ? '+' : ''}{number(latest.delta)} {item.metric.unit}</p>
          <p className={styles.secondary}>{number(item.baseline.value)} → {number(reading.value)} {item.metric.unit} · {latest.daysAfter} days after the update{latest.percent == null ? '' : ` · ${latest.percent > 0 ? '+' : ''}${number(latest.percent)}%`}</p>
        </> : <p>No comparable before-and-after pair in this window.</p>}
        <span className={styles.badge}>{strength[item.strength.level]}</span>
        {item.confounders.length > 0 && <p className={styles.secondary}>{item.confounders.length} other recorded change{item.confounders.length === 1 ? '' : 's'} overlap this period. This change cannot be attributed to one protocol.</p>}
        <details className={styles.formDetails}><summary>Measurements, context & limitations</summary>
          <h4>Baseline</h4>{item.baseline ? <ul className={styles.observations}><Reading row={item.baseline} /></ul> : <p className={styles.secondary}>No unambiguous comparable baseline.</p>}
          <h4>Follow-up</h4>{item.followups.length ? <ul className={styles.observations}>{item.followups.map(row => <Reading key={row.id} row={row} />)}</ul> : <p className={styles.secondary}>No follow-up in this window.</p>}
          {item.confounders.length > 0 && <><h4>Other changes in the measurement period</h4><ul className={styles.secondary}>{item.confounders.map(change => <li key={change.id}>{change.date} · {change.title}</li>)}</ul></>}
          <h4>Why this evidence label?</h4><ul className={styles.secondary}>{[...item.strength.reasons, ...item.limitations].map((reason, index) => <li key={index}>{reason}</li>)}</ul>
          <p className={styles.caption}>Intervention source: {item.intervention.sources.map(source => source.label).join(' · ')}</p><Link className={styles.textLink} href="/timeline">Open Timeline</Link>
        </details>
      </article>
    })}
    {visible < observations.length && <button type="button" onClick={() => setVisible(count => count + 8)}>Show more recorded comparisons</button>}
  </>
}
