import { currentPhase } from './dosing'
import { dosingDisplay } from './dosingEntry'
import { formatFrequency, type CompoundRow, type PhaseRow, type ProtocolRow } from './timeline'
import { isDueToday } from '../utils'

export type LibraryCompound = CompoundRow & {
  concentration_value?: number | null; concentration_unit?: string | null
  vials_in_stock?: number | null; notes?: string | null; reconstitution_date?: string | null
}
export type LibraryProtocol = Omit<ProtocolRow, 'compounds'> & {
  compounds?: LibraryCompound[] | null; completed_date?: string | null; notes?: string | null
}
export function dateLabel(value?: string | null) {
  if (!value) return ''
  const date = new Date(value.slice(0, 10) + 'T12:00:00')
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}
export function doseLabel(phase: PhaseRow | null) {
  const display = dosingDisplay(phase)
  if (display.primary === 'Unverified dosing entry') return 'Dose not fully calculated'
  return phase?.dosing_entry || display.medication ? display.primary : 'Dose not fully calculated'
}
export function phaseLabel(phase: PhaseRow) {
  return phase.end_week === null ? `Started Week ${phase.start_week ?? 'unknown'} · Ongoing` : `Weeks ${phase.start_week ?? '?'}–${phase.end_week}`
}
export function scheduleLabel(phase: PhaseRow | null) {
  if (!phase) return 'Schedule not set'
  const days = [...new Set(phase.days_of_week ?? [])].filter(day => day >= 0 && day < 7)
  const rolling = phase.frequency === 'eod' || /^every\d+days$/.test(phase.frequency ?? '')
  return rolling ? formatFrequency(phase.frequency!) : days.length ? (days.length === 7 ? 'daily' : days.length === 1 ? 'weekly' : `${days.length}x/week`) : phase.frequency ? formatFrequency(phase.frequency) : 'Schedule not set'
}
export function compoundOverview(protocol: LibraryProtocol, compound: LibraryCompound, today: string) {
  // Completion context is the phase that actually covers the saved completion date.
  // Never turn an expired phase into today's dose or guess a final dose.
  const completed = protocol.status === 'completed'
  const date = completed ? protocol.completed_date?.slice(0, 10) : today
  const phase = protocol.start_date && date ? currentPhase(compound.phases ?? [], protocol.start_date, date) : null
  const days = protocol.start_date ? (Date.parse(today) - Date.parse(protocol.start_date.slice(0, 10))) / 86400000 : NaN
  let next: { date: string; time: string | null } | null = null
  if (protocol.status === 'active' && protocol.start_date) {
    for (let offset = 0; offset < 8; offset++) {
      const day = new Date(today + 'T12:00:00Z')
      day.setUTCDate(day.getUTCDate() + offset)
      const key = day.toISOString().slice(0, 10)
      const candidate = currentPhase(compound.phases ?? [], protocol.start_date, key)
      if (candidate?.frequency && isDueToday(candidate.frequency, protocol.start_date, candidate.day_of_week ?? null, key, candidate.days_of_week ?? undefined)) {
        next = { date: key, time: candidate.time_of_day ?? null }; break
      }
    }
  }
  return { phase, dose: doseLabel(phase), frequency: scheduleLabel(phase),
    week: !completed && Number.isFinite(days) && days >= 0 ? Math.floor(days / 7) + 1 : null, next }
}
export function durationLabel(protocol: LibraryProtocol) {
  if (!protocol.start_date || !protocol.completed_date) return ''
  const days = Math.round((Date.parse(protocol.completed_date.slice(0, 10)) - Date.parse(protocol.start_date.slice(0, 10))) / 86400000)
  if (!Number.isFinite(days) || days < 0) return ''
  return `${days} ${days === 1 ? 'day' : 'days'}`
}
