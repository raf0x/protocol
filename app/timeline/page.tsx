'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadTimeline, TimelineAuthError } from '../../lib/health/loadTimeline'
import { groupTimeline, type CurrentBaseline, type TimelineEvent } from '../../lib/health/timeline'
import { weightComparisons, type TimelineFilter } from '../../lib/health/timelinePresentation'
import TimelineBaseline from '../../components/timeline/TimelineBaseline'
import TimelineFilters from '../../components/timeline/TimelineFilters'
import TimelineHistory from '../../components/timeline/TimelineHistory'
import TimelineEmpty from '../../components/timeline/TimelineEmpty'
import AppIcon from '../../components/app/AppIcon'
import styles from './timeline.module.css'

export default function TimelinePage() {
  const router = useRouter()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [baseline, setBaseline] = useState<CurrentBaseline | null>(null)
  const [filter, setFilter] = useState<TimelineFilter>('All')
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

  const visible = useMemo(() => events.filter(event => filter === 'All' || event.category === (filter === 'Protocols' ? 'Protocol' : filter)), [events, filter])
  const months = useMemo(() => groupTimeline(visible), [visible])
  const comparisons = useMemo(() => weightComparisons(events), [events])

  return <main className={styles.page}>
    <header className={styles.header}><span className={styles.eyebrow}><AppIcon name="timeline" size={18} />Your health history</span><h1>Timeline</h1><p>Your changes, check-ins, and progress over time.</p></header>
    {status === 'ready' && baseline && <TimelineBaseline baseline={baseline} />}
    <div className={styles.historyHeading}><h2>How you got here</h2><span>Newest first</span></div>
    <TimelineFilters value={filter} onChange={setFilter} />
    {status === 'loading' && <p role="status" className={styles.empty}>Loading your history…</p>}
    {status === 'error' && <div className={styles.empty} role="alert"><h2>Your history is temporarily unavailable</h2><p>Please try loading it again.</p><button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1) }}>Try again</button></div>}
    {status === 'ready' && <><p className={styles.count} role="status">{visible.length} {visible.length === 1 ? 'event' : 'events'}{filter !== 'All' && ` · ${filter}`}</p>{visible.length ? <TimelineHistory months={months} comparisons={comparisons} /> : <TimelineEmpty filter={filter} />}</>}
  </main>
}

