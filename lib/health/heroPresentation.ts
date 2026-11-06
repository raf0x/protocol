import { recordedDose, type RecordedPhase } from './recordedDose'
import { formatProtocolNumber } from './dosingEntry'
import { currentPhase } from './dosing'
import { isCalendarDate } from './protocolDates'
import { isDueToday } from '../utils'
import type { PhaseRow } from './timeline'

type TakenLog = { compound_id: string; taken: boolean; date: string }
const present = (v: unknown) => v !== null && v !== undefined && v !== ''
const nonnegative = (v: unknown): number | null => (typeof v === 'number' || typeof v === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(v.trim())) && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-12, Math.max(a, b) * 1e-9)

/** Hero only. Never derive medication or feed these equivalents into a save. */
export function heroAdministration(phase?: RecordedPhase | null) {
  const facts = recordedDose(phase), entry = phase?.dosing_entry
  const markings = nonnegative(facts.markings?.value), scale = facts.scale?.value
  const supportedScale = scale === '100' || scale === '40'
  const syringe = facts.markings ? markings !== null && supportedScale ? String(markings) + ' units \u00b7 U-' + scale : 'Review syringe details' : null
  const notes: string[] = []
  if (facts.markings) notes.push('Syringe units describe scale markings, not medication IU.')
  const confirmed = entry?.version === 2 && entry.review_status === 'confirmed' && ['syringe', 'volume', 'medication'].includes(entry.mode)
  const calculated = confirmed && markings !== null && supportedScale ? markings / Number(scale) : null
  const recorded = nonnegative(facts.volume?.value)
  const volumeConflict = calculated !== null && facts.volume !== null && (recorded === null || !close(calculated, recorded))
  let volume: { label: string; value: string } | null = null
  let issue: string | null = null
  if (volumeConflict) {
    issue = 'Review volume: saved volume and syringe markings disagree.'
    notes.push('Saved volume: ' + facts.volume!.value + ' mL. Syringe: ' + syringe + '. Both facts are preserved; review them in Manage protocol.')
  } else if (calculated !== null && Number.isFinite(calculated) && (calculated > 0 || markings === 0)) {
    volume = { label: 'Calculated volume', value: Number(calculated.toPrecision(12)).toString() + ' mL' }
    notes.push('Calculated volume = confirmed syringe markings divided by calibration. It is not a recorded volume or a medication recommendation.')
  } else if (facts.volume && recorded !== null) {
    volume = { label: facts.volume.origin === 'explicit_field' ? 'Recorded volume' : 'Saved volume', value: facts.volume.value + ' mL' }
    if (facts.volume.origin !== 'explicit_field') notes.push('The saved volume has unverified entry origin.')
  } else if (facts.volume) issue = 'Review the saved volume.'
  if (facts.markings && calculated === null) notes.push('Saved markings: ' + facts.markings.value + '; calibration: ' + (scale || 'not recorded') + '. Volume cannot be calculated without valid saved markings and confirmed U-100 or U-40 calibration.')
  return { syringe, volume, issue, notes }
}

/** The existing caller loads taken logs before rendering Hero. A log count is
 * labeled as logged history, not claimed to be a complete lifetime total. */
export function heroDoseCount(compoundId: string, override: unknown, logs: readonly TakenLog[], today: string) {
  const days = new Set(logs.filter(l => l.compound_id === compoundId && l.taken === true && typeof l.date === 'string' && isCalendarDate(l.date) && l.date <= today).map(l => l.date))
  const counter = nonnegative(override), validCounter = counter !== null && Number.isSafeInteger(counter)
  if (days.size) return { value: days.size + ' logged', note: validCounter && counter !== days.size ? 'Saved compound counter: ' + counter + '. The displayed count uses available taken-log dates; the counter is not added to those logs.' : 'Count of distinct taken dates in available compound history; not an individual-vial balance.' }
  if (validCounter) return { value: formatProtocolNumber(counter, 'count')! + ' recorded', note: 'From the saved compound dose counter; not an individual-vial balance.' }
  return { value: 'Not established', note: present(override) ? 'The saved dose counter is invalid; no count is inferred.' : 'No supported taken-log count or recorded counter is available.' }
}

function completeSchedule(phase: PhaseRow) {
  const frequency = phase.frequency
  if (frequency && /^(daily|eod|every[3-7]days)$/.test(frequency)) return true
  const n = frequency?.match(/^([1-7])x\/week$/)?.[1]
  if (!n) return false
  const days = phase.days_of_week
  if (days !== null && days !== undefined && !Array.isArray(days)) return false
  if (days?.length) return days.every(d => Number.isInteger(d) && d >= 0 && d <= 6) && new Set(days).size === Number(n)
  return n === '1' && Number.isInteger(phase.day_of_week) && phase.day_of_week! >= 0 && phase.day_of_week! <= 6
}

/** Ask the established calendar scheduler only after ruling out missing weekly
 * timing. Do not reproduce its legacy frequency-only fallback as a known date. */
export function heroNextDose(protocol: { start_date: string; status?: string | null }, compound: { id: string; phases?: PhaseRow[] }, logs: readonly TakenLog[], today: string): string | null {
  if (protocol.status !== 'active' || !isCalendarDate(protocol.start_date) || !isCalendarDate(today)) return null
  const first = protocol.start_date > today ? protocol.start_date : today
  for (let offset = 0; offset <= 7; offset++) {
    const day = new Date(first + 'T12:00:00Z'); day.setUTCDate(day.getUTCDate() + offset)
    const date = day.toISOString().slice(0, 10), phase = currentPhase(compound.phases || [], protocol.start_date, date)
    if (!phase || !completeSchedule(phase)) return null
    if (isDueToday(phase.frequency!, protocol.start_date, phase.day_of_week ?? null, date, phase.days_of_week ?? undefined) && !logs.some(l => l.compound_id === compound.id && l.taken === true && l.date === date)) return date
  }
  return null
}
