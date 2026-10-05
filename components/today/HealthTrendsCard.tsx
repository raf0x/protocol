import Link from 'next/link'
import AppIcon from '../app/AppIcon'
import { journalSnapshot } from '../../lib/health/today'
import type { JournalEntryRow } from '../../lib/health/timeline'
import { convertWeight, formatWeight, type WeightUnit } from '../../lib/weightUtils'
import styles from '../../app/protocol/today-v2.module.css'

export default function HealthTrendsCard({
  entries,
  unit,
  onToggleUnit,
}: {
  entries: JournalEntryRow[]
  unit: WeightUnit
  onToggleUnit: () => void
}) {
  const data = journalSnapshot(entries)
  const shortDate = (date: string) =>
    new Date(date + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  const weight = (value: number) =>
    formatWeight(convertWeight(value, 'lbs', unit), unit)

  return (
    <section className={`today-card ${styles.healthTrends}`} aria-labelledby="health-title">
      <div className="today-section-heading">
        <h2 id="health-title"><AppIcon name="health" />Health trends</h2>
      </div>

      {data.latest ? (
        <div className={`today-weight ${styles.healthWeightRow}`}>
          <p className={styles.healthWeight}>
            <strong>{weight(data.latest.weight!)}</strong>{' '}
            <button
              type="button"
              className="today-unit"
              onClick={onToggleUnit}
              aria-label={`Weight in ${unit}. Switch to ${unit === 'lbs' ? 'kg' : 'lbs'}`}
            >
              {unit}
            </button>
          </p>
          {data.change !== null && data.first && (
            <span className={`today-secondary ${styles.healthChange}`}>
              {data.change > 0 ? '+' : data.change < 0 ? '-' : ''}
              {weight(Math.abs(data.change))} {unit} since{' '}
              <time dateTime={data.first.date}>{shortDate(data.first.date)}</time>
            </span>
          )}
          <span className={`today-secondary ${styles.healthLatest}`}>
            Latest weight | <time dateTime={data.latest.date}>{shortDate(data.latest.date)}</time>
          </span>
          <span className={styles.healthBars}><AppIcon name="health" size={32} /></span>
        </div>
      ) : (
        <p className="today-empty">
          Add a weight entry to start seeing your progress over time.
        </p>
      )}

      <div className="today-health-metrics">
        {(['energy', 'sleep', 'mood'] as const).map(key => (
          <div key={key}>
            <span>{key === 'energy' ? 'Energy' : key === 'sleep' ? 'Sleep' : 'Mood'}</span>
            <strong>
              {data[key]
                ? `${data[key]![key]} ${key === 'sleep' ? 'h' : '/5'}`
                : 'Not logged'}
            </strong>
            <small>{data[key] ? <time dateTime={data[key]!.date}>{shortDate(data[key]!.date)}</time> : 'Not logged'}</small>
          </div>
        ))}
      </div>

      <Link
        className="today-text-link today-journal-link"
        href="/journal"
      >
        Manage health entries
        <AppIcon name="chevron" size={14} />
      </Link>
    </section>
  )
}
