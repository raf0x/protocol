'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import AppIcon from '../app/AppIcon'
import { untakenTodayDoses, type TodayDue } from '../../lib/health/today'
import type { ProtocolRow } from '../../lib/health/timeline'
import { currentPhase } from '../../lib/health/dosing'
import { dosingDisplay, formatProtocolAmount } from '../../lib/health/dosingEntry'
import { dosingIssue } from '../protocols/DoseSummary'
import { PrimaryAction, SecondaryAction, SectionCard } from '../app/DesignSystem'
import styles from '../../app/protocol/today-v2.module.css'

type Props = { activeCount: number; due: TodayDue[]; logs: Record<string, { taken: boolean }>; saving: boolean; onTaken: (id: string) => void; error: string | null; protocols?: ProtocolRow[]; date?: string }
export default function TodaysFocusCard({ activeCount, due, logs, saving, onTaken, error, protocols, date }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const swipe = useRef<{ pointerId: number; x: number; y: number; doseId: string } | null>(null)
  const pending = untakenTodayDoses(due, logs)
  const selectedIndex = pending.findIndex(item => item.id === selectedId)
  // Clear stale identity on completion/removal, so it cannot resurface later.
  if (selectedId !== null && selectedIndex < 0) setSelectedId(null)
  const index = selectedIndex < 0 ? 0 : selectedIndex
  const next = pending[index] ?? null
  const completed = due.filter(item => logs[item.id]?.taken).length
  // Present existing interpreted medication separately from review guidance; never parse a dose string.
  const protocol = protocols?.find(item => item.compounds?.some(compound => compound.id === next?.id))
  const compound = protocol?.compounds?.find(item => item.id === next?.id)
  const phase = protocol?.start_date && date ? currentPhase(compound?.phases ?? [], protocol.start_date, date) : null
  const display = dosingDisplay(phase)
  const medication = display.medication ? formatProtocolAmount(display.medication.value, display.medication.unit) : null
  const doseText = protocols ? medication ?? 'Medication amount unknown' : next ? `${next.dose} ${next.dose_unit}`.trim() : ''
  let review: string | null = null
  if (protocols && next) {
    try { review = phase?.dosing_entry ? dosingIssue(phase.dosing_entry)?.title ?? null : null }
    catch { review = 'Dose details need review' }
    if (!review && (display.secondary || !display.medication || phase?.dosing_entry?.review_status === 'unverified')) review = 'Dose details need review'
  }
  return <SectionCard className={styles.focus} aria-labelledby="focus-title">
    <div className={styles.focusHeader}>
      <h2 id="focus-title" className={styles.focusTitle}><svg className={styles.focusTitleIcon} width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" /><circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="2" /></svg>Today’s Focus</h2>
      <Link className={styles.focusCount} href="/protocol/manage" aria-label={`Manage ${activeCount} active ${activeCount === 1 ? 'protocol' : 'protocols'}`}>{activeCount} active {activeCount === 1 ? 'protocol' : 'protocols'}<AppIcon name="chevron" size={12} /></Link>
    </div>
    {next ? <div className={styles.nextDose}
      onPointerDown={event => {
        swipe.current = null
        if (event.pointerType !== 'touch' || event.isPrimary === false || saving || pending.length < 2 || (event.target as HTMLElement).closest?.('button, a, input, textarea, select')) return
        swipe.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, doseId: next.id }
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerCancel={() => { swipe.current = null }}
      onPointerUp={event => {
        const start = swipe.current
        swipe.current = null
        if (!start || start.pointerId !== event.pointerId || saving || start.doseId !== next.id) return
        const dx = event.clientX - start.x, dy = event.clientY - start.y
        if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy) * 1.5) return
        const target = pending[index + (dx < 0 ? 1 : -1)]
        if (target) setSelectedId(target.id)
      }}>
      <span className={styles.doseIcon}><AppIcon name="protocols" size={18} /></span>
      <div className={styles.doseCopy} aria-live="polite" aria-atomic="true">
        <span className={styles.visuallyHidden}>{index === 0 ? 'Next scheduled dose today' : 'Scheduled dose today'}</span>
        <span className={styles.doseEyebrow}>{index === 0 ? 'Next dose' : 'Scheduled dose'}</span>
        <div className={styles.doseContext}><h3>{next.name}</h3><p className={styles.doseAmount}>{doseText}</p></div>
        <span className={styles.dueTime}>{next.time_of_day?.trim() ? `Today · ${next.time_of_day.trim()}` : 'Time not set'}</span>
        {review && <p className={styles.focusReview}>{review}</p>}
      </div>
      <PrimaryAction className={styles.markTaken} disabled={saving} onClick={() => onTaken(next.id)}>{saving ? 'Saving…' : 'Mark taken'}</PrimaryAction>
    </div> : <div className={styles.focusEmpty}><AppIcon name={due.length ? 'check' : 'today'} size={24} /><div><h3>{due.length ? 'Today’s doses are logged' : 'No doses scheduled today'}</h3><p>{due.length ? 'Review or correct a dose in Schedule / logs.' : 'Your saved protocol schedule will appear here.'}</p>{!activeCount && <Link className="today-text-link" href="/protocol/manage">Create your first protocol</Link>}</div></div>}
    <div className={styles.focusSupport}>
    {pending.length > 1 && <nav className={styles.doseNavigation} aria-label="Browse today's untaken doses">
      <SecondaryAction aria-label="View previous dose today" disabled={index === 0 || saving} onClick={() => setSelectedId(pending[index - 1].id)}><span aria-hidden="true">←</span></SecondaryAction>
      <span role="status" aria-label={`${index + 1} of ${pending.length} remaining doses today`}>{index + 1} of {pending.length}</span>
      <SecondaryAction aria-label="View next dose today" disabled={index === pending.length - 1 || saving} onClick={() => setSelectedId(pending[index + 1].id)}><span aria-hidden="true">→</span></SecondaryAction>
    </nav>}
    {due.length > 0 && <div className={styles.focusProgress}><p className={styles.visuallyHidden} aria-live="polite">{completed} of {due.length} scheduled doses logged today</p><progress value={completed} max={due.length} aria-label="Today’s scheduled doses logged" /></div>}
    </div>
    {error && <p className="today-error" role="alert">{error}</p>}
  </SectionCard>
}
