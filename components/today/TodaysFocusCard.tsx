'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import AppIcon from '../app/AppIcon'
import { untakenTodayDoses, type TodayDue } from '../../lib/health/today'

type Props = { activeCount: number; due: TodayDue[]; logs: Record<string, { taken: boolean }>; saving: boolean; onTaken: (id: string) => void; error: string | null; children?: ReactNode }
export default function TodaysFocusCard({ activeCount, due, logs, saving, onTaken, error, children }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const pending = untakenTodayDoses(due, logs)
  const selectedIndex = pending.findIndex(item => item.id === selectedId)
  // Clear stale identity on completion/removal, so it cannot resurface later.
  if (selectedId !== null && selectedIndex < 0) setSelectedId(null)
  const index = selectedIndex < 0 ? 0 : selectedIndex
  const next = pending[index] ?? null
  const completed = due.filter(item => logs[item.id]?.taken).length
  return <section className="today-card today-focus" aria-labelledby="focus-title">
    <div className="today-section-heading"><h2 id="focus-title"><AppIcon name="today" />Today’s focus</h2><span>{activeCount} active {activeCount === 1 ? 'protocol' : 'protocols'}</span></div>
    {next ? <div className="today-next-dose">
      <span className="today-dose-icon"><AppIcon name="protocols" size={28} /></span>
      <div className="today-dose-copy" aria-live="polite" aria-atomic="true"><p className="today-eyebrow">{index === 0 ? 'Next scheduled dose today' : 'Scheduled dose today'}</p><h3>{next.name}</h3><p>{next.dose} {next.dose_unit}</p><span className="today-secondary">{next.time_of_day?.trim() ? `Today · ${next.time_of_day.trim()}` : 'Time not set'}</span></div>
      <button type="button" className="today-taken-button" disabled={saving} onClick={() => onTaken(next.id)}>{saving ? 'Saving…' : 'Mark taken'}</button>
    </div> : <div className="today-focus-empty"><span className="today-dose-icon"><AppIcon name={due.length ? 'check' : 'today'} size={28} /></span><div><h3>{due.length ? 'Today’s doses are logged' : 'No doses scheduled today'}</h3><p>{due.length ? 'You can review or change a log in your dashboard tools below.' : 'Your saved protocol schedule will appear here.'}</p>{!activeCount && <Link className="today-text-link" href="/protocol/manage">Create your first protocol</Link>}</div></div>}
    {pending.length > 1 && <nav className="today-dose-navigation" aria-label="Browse today's untaken doses">
      <button type="button" aria-label="View previous dose today" disabled={index === 0 || saving} onClick={() => setSelectedId(pending[index - 1].id)}>Previous</button>
      <span role="status">{index + 1} of {pending.length} remaining doses today</span>
      <button type="button" aria-label="View next dose today" disabled={index === pending.length - 1 || saving} onClick={() => setSelectedId(pending[index + 1].id)}>Next</button>
    </nav>}
    {due.length > 0 && <div className="today-focus-progress"><p className="today-focus-footer" aria-live="polite">{completed} of {due.length} scheduled doses logged today</p><progress value={completed} max={due.length} aria-label="Today’s scheduled doses logged" /></div>}
    {error && <p className="today-error" role="alert">{error}</p>}
    {children && <div className="today-focus-checkin">{children}</div>}
  </section>
}
