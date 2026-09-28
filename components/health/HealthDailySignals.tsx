'use client'

import { useLayoutEffect, useRef } from 'react'
import { healthNumber, type CommandCenterModel } from '../../lib/health/commandCenter'
import { formatTimelineDate } from '../../lib/health/timeline'
import HealthTrendChart, { HealthValueInspector } from './HealthTrendChart'
import styles from './command-center.module.css'

export default function HealthDailySignals({ model, animate, previousTrends }: {
  model: CommandCenterModel; animate: boolean; previousTrends: string[]
}) {
  const panel = useRef<HTMLElement>(null)
  const previous = useRef<{ height: number; states: string } | null>(null)
  const states = model.signals.map(signal => signal.state).join(',')
  useLayoutEffect(() => {
    const element = panel.current
    if (!element) return
    const height = element.offsetHeight
    const from = previous.current
    previous.current = { height, states }
    // Animate only a change of presentation. Never synthesize health points.
    if (!animate || !from || from.states === states || typeof element.animate !== 'function') return
    const transition = element.animate([
      { height: `${from.height}px`, overflow: 'clip' },
      { height: `${height}px`, overflow: 'clip' },
    ], { duration: 320, easing: 'ease-out' })
    return () => transition.cancel()
  }, [states, model.range, animate])

  return <section ref={panel} className={`${styles.card} ${styles.signalsPanel}`} aria-labelledby="health-signals-heading">
    <span className={styles.overline}>Daily signals</span>
    <h2 id="health-signals-heading">{model.signalsHaveTrend ? 'Mood, energy and sleep' : model.range === 'All' ? 'Not enough consistent weekly data for trends' : 'Not enough consistent data for trends'}</h2>
    <p className={styles.secondary}>{model.days ? `${model.checkInDays} of ${model.days} days include recorded check-ins.` : `${model.checkInDays} recorded days include check-ins.`}</p>
    <p className={styles.secondary}>Averages of recorded observations, not all calendar days.</p>
    {model.signals.map(signal => <div key={signal.name} className={styles.signal} data-signal={signal.name} data-state={signal.state}>
      <div className={styles.signalHeading}>
        <h3>{signal.name} <small>{signal.weekly && signal.state === 'trend' ? `weekly average · ${signal.unit === '/5' ? '1–5' : 'hours'}` : signal.unit === '/5' ? '1–5' : 'hours'}</small></h3>
        <strong>{signal.state === 'none' ? 'No recorded data' : <>{healthNumber(signal.average!)}<small>{signal.unit === '/5' ? ' /5' : ' h'}</small></>}</strong>
      </div>
      {signal.state !== 'none' && <p className={styles.secondary}>{signal.count} {signal.count === 1 ? 'entry' : 'entries'}
        {signal.state === 'single' && signal.firstObservation && <> · <time dateTime={signal.firstObservation.date}>{formatTimelineDate(signal.firstObservation.date)}</time></>}
      </p>}
      <p className={styles.secondary}>{model.days ? `${signal.recordedDays} of ${model.days} days` : signal.weekly ? `${signal.weekly.qualifyingWeeks} of ${signal.weekly.totalWeeks} weeks qualify` : `${signal.recordedDays} recorded days across ${signal.weeks} weeks`}</p>
      {signal.state !== 'trend' && <>
        <p className={styles.secondary}>{model.range === 'All' ? 'More consistent weekly check-ins are needed for a trend.' : 'More consistent check-ins are needed for a trend.'}</p>
        {signal.count > 0 && <HealthValueInspector trend={signal} />}
      </>}
      {signal.state === 'trend' && <HealthTrendChart trend={signal} xDomain={model.xDomain} animate={animate && previousTrends.includes(signal.name)} />}
    </div>)}
  </section>
}
