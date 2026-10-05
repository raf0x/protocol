import type { JournalEntryRow } from '../../lib/health/timeline'
import { convertWeight, formatWeight, type WeightUnit } from '../../lib/weightUtils'
import styles from '../../app/protocol/today-v2.module.css'

/** Recorded observations only; elapsed dates and weights determine the coordinates. */
export default function WeightTrendChart({ entries, unit }: { entries: JournalEntryRow[]; unit: WeightUnit }) {
  const observations = entries.flatMap(entry => {
    const day = Date.parse(`${entry.date}T00:00:00Z`)
    if (
      entry.weight === null || !Number.isFinite(entry.weight) || entry.weight <= 0 ||
      !Number.isFinite(day) || new Date(day).toISOString().slice(0, 10) !== entry.date
    ) return []
    return [{ date: entry.date, day, weight: convertWeight(entry.weight, 'lbs', unit), id: entry.id }]
  }).sort((a, b) => a.day - b.day || a.id.localeCompare(b.id))
  const first = observations[0], last = observations.at(-1)
  if (!first || !last || first.day === last.day) return <span className={styles.visuallyHidden}>Add another weight entry for a trend.</span>

  const minimum = Math.min(...observations.map(item => item.weight))
  const maximum = Math.max(...observations.map(item => item.weight))
  const label = (value: number) => formatWeight(value, unit)
  const range = `${label(minimum)}${minimum === maximum ? '' : `–${label(maximum)}`} ${unit}`
  const points = observations.map(item => ({ ...item,
    x: 4 + (item.day - first.day) / (last.day - first.day) * 92,
    y: maximum === minimum ? 24 : 44 - (item.weight - minimum) / (maximum - minimum) * 40,
  }))
  const description = `${points.length} recorded weights from ${first.date} to ${last.date}: ${label(first.weight)} to ${label(last.weight)} ${unit}. Recorded range ${range}.`
  return <figure className={styles.weightTrend}>
    <svg viewBox="0 0 100 48" role="img" aria-label={description}>
      <title>{description}</title>
      <polyline points={points.map(item => `${item.x},${item.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {points.map(item => <circle key={item.id} cx={item.x} cy={item.y} r="1.5" fill="currentColor"><title>{item.date}: {label(item.weight)} {unit}</title></circle>)}
    </svg>
  </figure>
}
