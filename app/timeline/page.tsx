'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { loadTimeline, TimelineAuthError } from '../../lib/health/loadTimeline'
import { groupTimeline, type CurrentBaseline, type TimelineEvent } from '../../lib/health/timeline'
import { parseTreatmentIdentityKey } from '../../lib/health/protocolIdentity'
import { timelineFilterFromParam, timelineFilterUrl, timelineTreatmentOptions, timelineTreatmentPredicate, weightComparisons } from '../../lib/health/timelinePresentation'
import TimelineBaseline from '../../components/timeline/TimelineBaseline'
import TimelineFilters from '../../components/timeline/TimelineFilters'
import TimelineHistory from '../../components/timeline/TimelineHistory'
import TimelineEmpty from '../../components/timeline/TimelineEmpty'
import AppIcon from '../../components/app/AppIcon'
import styles from './timeline.module.css'

function TimelineContent() {
  const router = useRouter()
  const query = useSearchParams()
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [baseline, setBaseline] = useState<CurrentBaseline | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [labsError, setLabsError] = useState<string | null>(null)
  const filter = timelineFilterFromParam(query.get('category'))
  const hasTreatmentQuery = query.has('treatment')
  const treatmentKey = query.get('treatment') ?? ''
  useEffect(() => {
    let cancelled = false
    loadTimeline().then(data => {
      if (!cancelled) { setEvents(data.events); setBaseline(data.baseline); setLabsError(data.labsError); setStatus('ready') }
    }).catch(error => {
      if (cancelled) return
      if (error instanceof TimelineAuthError) { router.replace('/auth/login'); return }
      setStatus('error')
    })
    return () => { cancelled = true }
  }, [router, attempt])

  const treatmentOptions = useMemo(() => timelineTreatmentOptions(events), [events])
  const selectedTreatment = useMemo(() => hasTreatmentQuery ? parseTreatmentIdentityKey(treatmentKey) : null, [hasTreatmentQuery, treatmentKey])
  const selectedTreatmentOption = treatmentOptions.find(option => option.key === treatmentKey)
  const treatmentUnavailable = hasTreatmentQuery && (!selectedTreatment || !selectedTreatmentOption)
  const visible = useMemo(() => {
    const categoryEvents = events.filter(event => filter === 'All' || event.category === (filter === 'Protocols' ? 'Protocol' : filter))
    if (!hasTreatmentQuery) return categoryEvents
    if (!selectedTreatment || treatmentUnavailable) return []
    return categoryEvents.filter(timelineTreatmentPredicate(events, selectedTreatment))
  }, [events, filter, hasTreatmentQuery, selectedTreatment, treatmentUnavailable])
  const months = useMemo(() => groupTimeline(visible), [visible])
  const comparisons = useMemo(() => weightComparisons(events), [events])

  return <main className={styles.page}>
    <header className={styles.header}><span className={styles.eyebrow}><AppIcon name="timeline" size={18} />Your health history</span><h1>Timeline</h1><p>Your changes, check-ins, and progress over time.</p></header>
    {status === 'ready' && baseline && <TimelineBaseline baseline={baseline} />}
    <div className={styles.historyHeading}><h2>How you got here</h2><span>Newest first</span></div>
    <TimelineFilters value={filter} treatments={treatmentOptions} treatmentKey={treatmentKey} treatmentUnavailable={treatmentUnavailable}
      onChange={value => window.history.pushState(null, '', timelineFilterUrl(window.location.search, value, value === 'Protocols' && !treatmentUnavailable ? treatmentKey : ''))}
      onTreatmentChange={value => window.history.pushState(null, '', timelineFilterUrl(window.location.search, 'Protocols', value))} />
    {status === 'ready' && labsError && (filter === 'All' || filter === 'Labs') && <div className={styles.empty} role="status"><p>{labsError}</p><button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1) }}>Retry lab history</button></div>}
    {status === 'loading' && <p role="status" className={styles.empty}>Loading your history…</p>}
    {status === 'error' && <div className={styles.empty} role="alert"><h2>Your history is temporarily unavailable</h2><p>Please try loading it again.</p><button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1) }}>Try again</button></div>}
    {status === 'ready' && <><p className={styles.count} role="status">{visible.length} {visible.length === 1 ? 'event' : 'events'}{selectedTreatmentOption ? ` · ${selectedTreatmentOption.label}` : filter !== 'All' ? ` · ${filter}` : ''}</p>{visible.length ? <TimelineHistory months={months} comparisons={comparisons} /> : treatmentUnavailable ? <div className={styles.empty} role="status"><h2>This treatment is not available</h2><p>The linked treatment is not present in the loaded timeline.</p></div> : !(labsError && filter === 'Labs') && <TimelineEmpty filter={filter} />}</>}
  </main>
}

export default function TimelinePage() {
  return <Suspense fallback={<main className={styles.page}><p role="status" className={styles.empty}>Loading your history…</p></main>}><TimelineContent /></Suspense>
}
