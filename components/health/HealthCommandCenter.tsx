'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { commandCenterModel, healthRanges, healthNumber, type CommandCenterModel, type CommandCenterSource, type HealthRange } from '../../lib/health/commandCenter'
import { loadCommandCenter } from '../../lib/health/loadCommandCenter'
import { TimelineAuthError } from '../../lib/health/loadTimeline'
import { useLocalCalendarDate } from '../../lib/health/useLocalCalendarDate'
import HealthTrendChart from './HealthTrendChart'
import HealthDailySignals from './HealthDailySignals'
import styles from './command-center.module.css'

function HealthMetricGrid({ model }: { model: CommandCenterModel }) {
  return <section className={styles.metrics} aria-label="Key health metrics">{model.metrics.map(metric => <article className={styles.metric} key={metric.name}>
    <h3>{metric.name}</h3><p className={styles.value} data-empty={metric.value === 'No data' || metric.value === 'Not enough data'}>{metric.value}{metric.unit && <small> {metric.unit}</small>}</p><p className={styles.secondary}>{metric.detail}</p>
  </article>)}</section>
}

function CommandBriefing({ model }: { model: CommandCenterModel }) {
  return <section className={styles.card} aria-labelledby="health-command-briefing">
    <span className={styles.overline}>Command briefing</span><h2 id="health-command-briefing">What matters in this range</h2>
    {model.briefing.length ? <ul className={styles.briefing}>{model.briefing.map(item => <li key={item.id} data-kind={item.kind}>
      <p>{item.text}</p>{item.href && <Link href={item.href}>Review protocol changes</Link>}
    </li>)}</ul> : <p className={styles.empty}>No recorded insights for this range yet.</p>}
  </section>
}

export default function HealthCommandCenter({ range, onRangeChange }: { range: HealthRange; onRangeChange: (range: HealthRange) => void }) {
  const router = useRouter()
  const today = useLocalCalendarDate()
  const [source, setSource] = useState<CommandCenterSource | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [attempt, setAttempt] = useState(0)
  const [changedRange, setChangedRange] = useState(false)
  const [previousTrends, setPreviousTrends] = useState<string[]>([])
  const [reducedMotion, setReducedMotion] = useState(true)
  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () => setReducedMotion(preference.matches)
    update(); preference.addEventListener('change', update)
    return () => preference.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    let live = true
    loadCommandCenter().then(data => { if (live) { setSource(data); setStatus('ready') } }).catch(error => {
      if (!live) return
      if (error instanceof TimelineAuthError) { router.replace('/auth/login?next=/health'); return }
      setStatus('error')
    })
    return () => { live = false }
  }, [router, attempt])
  const model = useMemo(() => source ? commandCenterModel(source, range, today) : null, [source, range, today])
  const animate = changedRange && !reducedMotion
  return <div className={styles.center}>
    <div className={styles.ranges} role="group" aria-label="Health date range">{healthRanges.map(value => <button key={value} type="button" aria-pressed={value === range} onClick={() => {
      if (range !== value) {
        setPreviousTrends(model?.signals.filter(signal => signal.state === 'trend').map(signal => signal.name) ?? [])
        setChangedRange(status === 'ready'); onRangeChange(value)
      }
    }}>{value}</button>)}</div>
    {status === 'loading' && <div className={styles.loading} role="status"><p>Loading your health overview…</p><div className={styles.loadingSummary} /><div className={styles.loadingMetrics}>{[0, 1, 2, 3].map(index => <span key={index} />)}</div></div>}
    {status === 'error' && <div className={styles.card} role="alert"><h2>Health overview is temporarily unavailable</h2><p className={styles.secondary}>Please try again. Your saved data has not changed.</p><button type="button" onClick={() => { setStatus('loading'); setAttempt(value => value + 1) }}>Try again</button></div>}
    {status === 'ready' && model && <>
      <section className={styles.summary} aria-labelledby="health-glance" data-animate={animate} key={range}>
        <div className={styles.summaryTop}><span className={styles.overline}>At a glance</span><span>{model.period}</span></div>
        <h2 id="health-glance">{model.headline}</h2><p>{model.summary}</p>
      </section>
      <p className={styles.srOnly} role="status">Showing {model.period.toLowerCase()}.</p>
      <HealthMetricGrid model={model} />
      <section className={styles.card} aria-labelledby="health-weight-heading">
        <span className={styles.overline}>Weight trend</span><h2 id="health-weight-heading">{model.weight.latest === null ? 'Your recorded weight' : <>{healthNumber(model.weight.latest)} <small>{model.weight.unit}</small></>}</h2>
        {model.weight.latest !== null && <p className={styles.secondary}>Latest in this period</p>}
        <HealthTrendChart trend={model.weight} xDomain={model.weight.xDomain!} animate={animate} weight />
        {model.weight.ambiguousWeights && <p className={styles.secondary}>Conflicting same-day weights are omitted from this trend.</p>}
      </section>
      <HealthDailySignals model={model} animate={animate} previousTrends={previousTrends} />
      <CommandBriefing model={model} />
    </>}
  </div>
}
