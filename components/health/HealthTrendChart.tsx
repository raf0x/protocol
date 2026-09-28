'use client'

import { useId, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { healthNumber, type HealthTrend, type TrendObservation, type TrendPoint } from '../../lib/health/commandCenter'
import { formatTimelineDate } from '../../lib/health/timeline'
import styles from './command-center.module.css'

export function HealthValueInspector({ trend }: { trend: HealthTrend }) {
  const id = useId().replace(/:/g, '')
  const [selectedDate, setSelectedDate] = useState('')
  const recorded: TrendObservation[] = trend.observations ?? trend.points.flatMap(point => point.value === null ? [] : [{ id: point.date, date: point.date, value: point.value }])
  const selected = recorded.find(point => point.id === selectedDate) ?? recorded.at(-1)
  const isWeeklyTrend = Boolean(trend.weekly && trend.chartPoints?.some(point => point.value !== null))
  const valueLabel = (value: number) => healthNumber(value) + (trend.unit === '/5' ? '/5' : ' ' + trend.unit)
  const dateLabel = (point: typeof recorded[number]) => point.endDate
    ? `${formatTimelineDate(point.date)}\u2013${formatTimelineDate(point.endDate)}` : formatTimelineDate(point.date)
  const countLabel = (point: typeof recorded[number]) => point.count ? ` · ${point.count} ${point.count === 1 ? 'observation' : 'observations'}` : ''
  return <details className={styles.inspector}>
    <summary>Inspect {trend.name.toLowerCase()} {isWeeklyTrend ? 'weekly averages' : 'values'}</summary>
    <label htmlFor={id}>{isWeeklyTrend ? 'Recorded week' : 'Recorded date'}</label>
    <select id={id} aria-label={trend.name + (isWeeklyTrend ? ' recorded week average and observation count' : ' recorded date and value')} value={selected?.id ?? ''} onChange={event => setSelectedDate(event.target.value)}>
      {recorded.map(point => <option key={point.id} value={point.id}>{dateLabel(point)}: {valueLabel(point.value)}{countLabel(point)}</option>)}
    </select>
    <output aria-live="polite">{selected && dateLabel(selected) + ': ' + trend.name + ' ' + valueLabel(selected.value) + countLabel(selected)}</output>
  </details>
}

type Props = { trend: HealthTrend; xDomain: [number, number]; animate: boolean; weight?: boolean }

export default function HealthTrendChart({ trend, xDomain, animate, weight = false }: Props) {
  const id = useId().replace(/:/g, '')
  const chartData = trend.chartPoints ?? trend.points
  const recorded = chartData.filter((point): point is TrendPoint & { value: number } => point.value !== null)
  const color = trend.name === 'Sleep' ? 'var(--health-sleep)' : 'var(--app-accent)'
  const valueLabel = (value: number) => `${healthNumber(value)}${trend.unit === '/5' ? '/5' : ` ${trend.unit}`}`
  const label = trend.weekly
    ? `${trend.name} weekly trend from recorded check-ins. ${trend.weekly.qualifyingWeeks} of ${trend.weekly.totalWeeks} weeks qualify. Use left and right arrow keys to inspect weekly averages, or open recorded values below.`
    : `${trend.name} chart. ${recorded.length} recorded ${recorded.length === 1 ? 'date' : 'dates'}. Use left and right arrow keys to inspect values, or open recorded values below.`
  if (!recorded.length) return <p className={styles.empty}>{weight ? 'Record a weight entry to see it here. Two entries are needed for a trend.' : `No ${trend.name.toLowerCase()} observations in this period.`}</p>
  const plottedDomain = trend.weekly && chartData.length
    ? [chartData[0].time, chartData.at(-1)!.time] as [number, number] : xDomain
  const ticks = recorded.length === 1 ? [recorded[0].time] : recorded.length === 2
    ? [recorded[0].time, recorded[1].time] : [plottedDomain[0], (plottedDomain[0] + plottedDomain[1]) / 2, plottedDomain[1]]
  const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const weightContext = weight ? `${recorded.length} ${recorded.length === 1 ? 'weigh-in' : 'weigh-ins'} · ${shortDate(recorded[0].date)}${recorded.length > 1 ? `\u2013${shortDate(recorded.at(-1)!.date)}` : ''}` : ''
  return <figure className={`${styles.figure} ${weight ? styles.weightFigure : styles.signalFigure}`} aria-label={`${trend.name} recorded values`}>
    <div className={styles.plot} data-animate={animate} data-chart-frame>
      <ResponsiveContainer width="100%" height={weight ? 208 : 90} minWidth={0}>
        <LineChart data={chartData} margin={{ top: 16, right: 12, bottom: 0, left: 0 }} accessibilityLayer aria-label={label} aria-describedby={`chart-description-${id}`}>
          <XAxis dataKey="time" type="number" domain={plottedDomain} scale="time" hide={!weight} tickLine={false} axisLine={false}
            ticks={ticks} minTickGap={24}
            tick={{ fill: 'var(--app-secondary)', fontSize: 11 }} tickFormatter={value => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
          <YAxis domain={trend.domain} ticks={weight ? [trend.domain[0], trend.domain[1]] : trend.domain} width={weight ? 44 : 26} tickLine={false} axisLine={false}
            tick={{ fill: 'var(--app-secondary)', fontSize: 11 }} tickFormatter={value => weight ? healthNumber(value) : String(value)} />
          <Tooltip isAnimationActive={false} position={{ x: weight ? 44 : 26, y: 0 }} wrapperStyle={{ maxWidth: 'calc(100% - 44px)', pointerEvents: 'none' }}
            content={({ active, payload }) => {
              const point = payload?.[0]?.payload as TrendPoint | undefined
              const date = point?.endDate ? `${formatTimelineDate(point.date)}\u2013${formatTimelineDate(point.endDate)}` : point ? formatTimelineDate(point.date) : ''
              const count = point?.observationCount ? ` · ${point.observationCount} ${point.observationCount === 1 ? 'observation' : 'observations'}` : ''
              return active && point?.value != null ? <div className={styles.tooltip} role="status">{date} · {trend.name} {valueLabel(point.value)}{count}</div> : null
            }} />
          <Line dataKey="value" name={trend.name} type="linear" connectNulls={false} stroke={color} strokeWidth={2}
            dot={weight && recorded.length <= 16 ? { r: recorded.length === 1 ? 4 : 3, fill: color, strokeWidth: 0 } : false}
            activeDot={{ r: 5, stroke: 'var(--app-surface)', strokeWidth: 2 }} isAnimationActive={animate} animationBegin={0} animationDuration={320} animationEasing="ease-out" />
        </LineChart>
      </ResponsiveContainer>
    </div>
    <figcaption id={`chart-description-${id}`} className={styles.chartCaption}>{recorded.length === 1 ? <>{weightContext}. One recorded value: {valueLabel(recorded[0].value)}. More observations are needed for a trend.</>
      : weight ? <>{weightContext}. Lines connect recorded weights; unrecorded days have no values.</>
        : trend.weekly ? <>Weekly averages from recorded check-ins · {trend.weekly.qualifyingWeeks} of {trend.weekly.totalWeeks} weeks. Missing and non-qualifying weeks remain gaps.</>
          : 'Only consecutive runs are drawn. All recorded values remain available below.'}</figcaption>
    <HealthValueInspector trend={trend} />
  </figure>
}
