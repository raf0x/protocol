import Link from 'next/link'
import AppIcon from '../app/AppIcon'
import { journalSnapshot } from '../../lib/health/today'
import type { JournalEntryRow } from '../../lib/health/timeline'
import { convertWeight, formatWeight, type WeightUnit } from '../../lib/weightUtils'

export default function HealthTrendsCard({ entries, unit, onToggleUnit }: { entries: JournalEntryRow[]; unit: WeightUnit; onToggleUnit: () => void }) {
  const data = journalSnapshot(entries)
  const shortDate = (date: string) => new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const weight = (value: number) => formatWeight(convertWeight(value, 'lbs', unit), unit)
  return <section className="today-card" aria-labelledby="health-title"><div className="today-section-heading"><h2 id="health-title"><AppIcon name="health" />Health trends</h2><Link href="/journal" className="app-icon-button" aria-label="Open health journal"><AppIcon name="chevron" size={16} /></Link></div>
    {data.latest ? <div className="today-weight"><div><span className="today-secondary">Latest weight · {shortDate(data.latest.date)}</span><p><strong>{weight(data.latest.weight!)}</strong> <button type="button" className="today-unit" onClick={onToggleUnit} aria-label={`Weight in ${unit}. Switch to ${unit === 'lbs' ? 'kg' : 'lbs'}`}>{unit}</button></p>
      {data.change !== null && data.first && <span className="today-secondary">{data.change > 0 ? '+' : data.change < 0 ? '−' : ''}{weight(Math.abs(data.change))} {unit} since {shortDate(data.first.date)}</span>}</div><AppIcon name="health" size={40} /></div> : <p className="today-empty">Add a weight entry to start seeing your progress over time.</p>}
    <div className="today-health-metrics">{(['energy', 'sleep', 'mood'] as const).map(key => <div key={key}><span>{key}</span><strong>{data[key] ? `${data[key]![key]} ${key === 'sleep' ? 'h' : '/5'}` : '—'}</strong><small>{data[key] ? shortDate(data[key]!.date) : 'Not logged'}</small></div>)}</div>
    <Link className="today-text-link today-journal-link" href="/journal">Open your health journal <AppIcon name="chevron" size={14} /></Link>
  </section>
}
