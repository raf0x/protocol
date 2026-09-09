'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { loadTimeline, TimelineAuthError } from '../../lib/health/loadTimeline'
import { formatTimelineDate, groupTimeline, protocolMetadataChips, type CurrentBaseline, type TimelineEvent } from '../../lib/health/timeline'
import styles from './timeline.module.css'

const filters = ['All', 'Protocols', 'Weight', 'Journal', 'Labs'] as const
type Filter = typeof filters[number]

export default function TimelinePage() {
  const router = useRouter()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [baseline, setBaseline] = useState<CurrentBaseline | null>(null)
  const [filter, setFilter] = useState<Filter>('All')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadTimeline().then(data => {
      if (!cancelled) { setEvents(data.events); setBaseline(data.baseline); setStatus('ready') }
    }).catch(error => {
      if (cancelled) return
      if (error instanceof TimelineAuthError) { router.replace('/auth/login'); return }
      setStatus('error')
    })
    return () => { cancelled = true }
  }, [router, attempt])

  const visible = events.filter(event => filter === 'All' || event.category === (filter === 'Protocols' ? 'Protocol' : filter))

  return (
    <main className={styles.page}>
      <header>
        <h1>Timeline</h1>
        <p>Your protocols, weight, and daily check-ins over time.</p>
      </header>
      {status === 'ready' && baseline && <section className={styles.baseline} aria-labelledby="baseline-title">
        <h2 id="baseline-title">Current Baseline</h2>
        <dl className={styles.baselineStats}>
          <div><dt>Latest weight</dt><dd>{baseline.weight != null ? `${baseline.weight} lbs` : 'Not recorded'}</dd>
            {baseline.weightDate && <small>Recorded {formatTimelineDate(baseline.weightDate)}</small>}</div>
          <div><dt>Active protocols</dt><dd>{baseline.activeProtocolCount}</dd></div>
        </dl>
        {baseline.activeProtocols.length > 0 ? <ul className={styles.baselineProtocols} aria-label="Active protocols">
          {baseline.activeProtocols.map(protocol => <li key={protocol.id}>
            <div className={styles.protocolHeading}>
              <h3>{protocol.name || 'Protocol'}</h3>
            </div>
            {protocol.compounds.map(compound => <div className={styles.baselineCompound} key={compound.id}>
              {compound.name && compound.name !== protocol.name && <strong>{compound.name}</strong>}
              {compound.details.length > 0 && <p>{compound.details.join(' · ')}</p>}
              {compound.issue && <p>{compound.issue} <Link href={`/protocol/manage?protocol=${protocol.id}`}>Review phases</Link></p>}
            </div>)}
            {(protocol.week != null || protocol.startDate) && <p className={styles.protocolTiming}>
              {protocol.week != null && <span>Week {protocol.week}</span>}
              {protocol.startDate && <span>Started <time dateTime={protocol.startDate}>{formatTimelineDate(protocol.startDate)}</time></span>}
            </p>}
          </li>)}
        </ul> : <p className={styles.count}>No active protocols recorded</p>}
        <div className={styles.lastChange}>
          <p>Last protocol change</p>
          {baseline.lastProtocolChangeDate ? <>
            <time dateTime={baseline.lastProtocolChangeDate}>{formatTimelineDate(baseline.lastProtocolChangeDate)}</time>
            {baseline.lastProtocolChangeTitle && <span>{baseline.lastProtocolChangeTitle}</span>}
          </> : <span>Not recorded</span>}
        </div>
      </section>}
      <div className={styles.filters} role="group" aria-label="Filter timeline">
        {filters.map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}
      </div>
      {status === 'loading' && <p role="status" className={styles.empty}>Loading your timeline…</p>}
      {status === 'error' && <div className={styles.empty} role="alert">
        <p>We couldn’t load your timeline. Please try again.</p>
        <button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1) }}>Try again</button>
      </div>}
      {status === 'ready' && <>
        <p className={styles.count} role="status">{visible.length} {visible.length === 1 ? 'event' : 'events'}</p>
        {visible.length === 0 ? <div className={styles.empty}>
          <h2>{filter === 'Labs' ? 'Labs are coming soon' : 'No events yet'}</h2>
          <p>{filter === 'Labs' ? 'Lab results aren’t stored yet. They’ll appear here when lab tracking is available.' : 'Your recorded history will appear here. Log a check-in or manage your protocols from the Dashboard.'}</p>
          {filter !== 'Labs' && <Link href="/protocol">Go to Dashboard</Link>}
        </div> : <div className={styles.history}>
          {groupTimeline(visible).map(month => <section key={month.key} aria-labelledby={`month-${month.key}`}>
            <h2 className={styles.month} id={`month-${month.key}`}>{month.label}</h2>
            {month.days.map(day => <section className={styles.day} key={day.date} aria-label={formatTimelineDate(day.date)}>
              <h3 className={styles.date}><time dateTime={day.date}>{formatTimelineDate(day.date)}</time></h3>
              <ol className={styles.list}>
                {day.events.map(event => {
                  const chips = protocolMetadataChips(event)
                  return <li key={event.id}><article className={styles.card}>
                    <span className={styles.category}>{event.category}</span>
                    <h4>{event.title}</h4>
                    {event.description && <p className={styles.description}>{event.description}</p>}
                    {chips.length > 0 && <div className={styles.plan}>
                      <span>Saved plan</span>
                      <ul className={styles.chips} aria-label="Saved plan details">{chips.map(chip => <li key={chip}>{chip}</li>)}</ul>
                    </div>}
                  </article></li>
                })}
              </ol>
            </section>)}
          </section>)}
        </div>}
      </>}
    </main>
  )
}
