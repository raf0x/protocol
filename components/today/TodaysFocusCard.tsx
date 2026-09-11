import Link from 'next/link'
import AppIcon from '../app/AppIcon'
import { nextTodayDose, type TodayDue } from '../../lib/health/today'

type Props = { activeCount: number; due: TodayDue[]; logs: Record<string, { taken: boolean }>; saving: boolean; onTaken: (id: string) => void; error: string | null }
export default function TodaysFocusCard({ activeCount, due, logs, saving, onTaken, error }: Props) {
  const next = nextTodayDose(due, logs)
  const completed = due.filter(item => logs[item.id]?.taken).length
  return <section className="today-card today-focus" aria-labelledby="focus-title">
    <div className="today-section-heading"><h2 id="focus-title"><AppIcon name="today" />Today’s focus</h2><span>{activeCount} active {activeCount === 1 ? 'protocol' : 'protocols'}</span></div>
    {next ? <div className="today-next-dose">
      <span className="today-dose-icon"><AppIcon name="protocols" size={28} /></span>
      <div className="today-dose-copy"><p className="today-eyebrow">Next scheduled dose today</p><h3>{next.name}</h3><p>{next.dose} {next.dose_unit}</p><span className="today-secondary">{next.time_of_day ? `Today · ${next.time_of_day}` : 'Time not set'}</span></div>
      <button type="button" className="today-taken-button" disabled={saving} onClick={() => onTaken(next.id)}>{saving ? 'Saving…' : 'Mark taken'}</button>
    </div> : <div className="today-focus-empty"><span className="today-dose-icon"><AppIcon name={due.length ? 'check' : 'today'} size={28} /></span><div><h3>{due.length ? 'Today’s doses are logged' : 'No doses scheduled today'}</h3><p>{due.length ? 'You can review or change a log in your dashboard tools below.' : 'Your saved protocol schedule will appear here.'}</p>{!activeCount && <Link className="today-text-link" href="/protocol/manage">Create your first protocol</Link>}</div></div>}
    {due.length > 0 && <div className="today-focus-progress"><p className="today-focus-footer" aria-live="polite">{completed} of {due.length} scheduled doses logged today</p><progress value={completed} max={due.length} aria-label="Today’s scheduled doses logged" /></div>}
    {error && <p className="today-error" role="alert">{error}</p>}
  </section>
}
