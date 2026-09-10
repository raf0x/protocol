import { dosingDisplay, type DosingEntry } from './dosingEntry'
import { currentPhase, isMedicationUnit } from './dosing'
export type TimelineCategory = 'Protocol' | 'Weight' | 'Journal' | 'Labs'
export type TimelineEvent = {
  id: string
  date: string
  category: TimelineCategory
  title: string
  description?: string
  sourceType: 'protocol_events' | 'journal_entries' | 'lab_panels'
  sourceId: string
  metadata?: Record<string, string | number | null>
}

export type PhaseRow = {
  dosing_entry?: DosingEntry | null
  dose_semantics_version?: number | null
  injection_volume_ml?: number | null; syringe_units?: number | null; syringe_scale?: number | null
  id: string; dose: number | null; dose_unit: string | null; frequency: string | null
  start_week: number | null; end_week: number | null
  day_of_week?: number | null
  time_of_day?: string | null
  route?: string | null
  days_of_week?: number[] | null
}
export type CompoundRow = {
  id: string; name: string | null; phases?: PhaseRow[] | null; route?: string | null
  vial_strength?: number | null; vial_unit?: string | null; bac_water_ml?: number | null
  ml_per_dose?: number | null
}
export type ProtocolRow = {
  id: string; name: string | null; start_date: string | null; status: string | null
  compounds?: CompoundRow[] | null
  dose?: number | null; dose_unit?: string | null; frequency?: string | null
  days_of_week?: number[] | null; route?: string | null
}
export type ProtocolEventRow = {
  id: string
  date: string
  event_type: string | null
  description: string | null
  protocol_id: string | null
  compound_id: string | null
  protocols: ProtocolRow | null
  compounds: CompoundRow | null
}
export type JournalEntryRow = {
  id: string
  date: string
  notes: string | null
  weight: number | null
  mood: number | null
  energy: number | null
  sleep: number | null
  hunger: number | null
}

const protocolActions: Record<string, string> = {
  started: 'started', stopped: 'stopped', completed: 'completed', paused: 'paused',
  resumed: 'resumed', dose_change: 'dose changed', compound_added: 'added', compound_removed: 'removed',
}
const textKey = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase().replace(/[.!]+$/, '')

/** Match the event day to exactly one saved phase. Never select an arbitrary
 * phase when ranges overlap or the event falls outside the saved plan.
 * Phases are mutable in this app, so this is saved-plan context, not a dose log.
 */
function phaseForDate(compound: CompoundRow | null, start: string | null | undefined, date: string) {
  return start ? currentPhase(compound?.phases ?? [], start, date) : null
}

function protocolWeek(start: string | null, date: string): number | null {
  if (!start) return null
  const days = (Date.parse(date.slice(0, 10)) - Date.parse(start.slice(0, 10))) / 86400000
  return Number.isFinite(days) && days >= 0 ? Math.floor(days / 7) + 1 : null
}

function planMetadata(compound: CompoundRow | null, start: string | null, date: string) {
  const candidate = phaseForDate(compound, start, date)
  const phase = candidate?.dose_semantics_version === 1 && !candidate.dosing_entry ? candidate : null
  return {
    phaseId: phase?.id ?? null, dose: phase?.dose ?? null, doseUnit: phase?.dose_unit ?? null,
    frequency: phase?.frequency ?? null, route: phase?.route ?? compound?.route ?? null,
  }
}

function structuredFrequency(frequency?: string | null, days?: number[] | null): string | null {
  const value = frequency?.trim().toLowerCase()
  // Rolling intervals must not be replaced by a weekly day selection.
  if (value === 'eod' || /^every[1-9]\d*days$/.test(value ?? '')) return formatFrequency(value!)
  if (days?.length && days.every(day => Number.isInteger(day) && day >= 0 && day <= 6)) {
    const count = new Set(days).size
    return count === 7 ? 'daily' : count === 1 ? 'weekly' : `${count}x/week`
  }
  if (value === 'daily' || value === 'weekly' || /^[1-7]x\/week$/.test(value ?? '')) return value === '7x/week' ? 'daily' : formatFrequency(value!)
  return null
}

function structuredRoute(...values: (string | null | undefined)[]): string | null {
  for (const value of values) {
    const key = value?.trim().toLowerCase()
    if (key === 'im' || key === 'intramuscular') return 'IM'
    if (['subq', 'sq', 'sc', 'subcutaneous'].includes(key ?? '')) return 'SubQ'
  }
  return null
}

export function baselineDosingIssue(compound: CompoundRow | null, protocol: ProtocolRow, today: string): string | null {
  const phase = phaseForDate(compound, protocol.start_date, today)
  if (!phase) return 'No single phase covers today. Add or extend a phase.'
  if (phase.dosing_entry) return dosingDisplay(phase).secondary || null
  if (phase.dose_semantics_version !== 1 || !isMedicationUnit(phase.dose_unit)) return 'Legacy dose needs review. Confirm medication amount and unit.'
  return null
}

export function resolveBaselineDetails(compound: CompoundRow | null, protocol: ProtocolRow, today: string): string[] {
  const phase = phaseForDate(compound, protocol.start_date, today)
  if (phase?.dosing_entry) return [dosingDisplay(phase).primary, structuredFrequency(phase.frequency,phase.days_of_week),structuredRoute(phase.route)].filter((s):s is string=>Boolean(s))
  if (!phase || baselineDosingIssue(compound, protocol, today)) return []
  return formatPlanDetails({dose:phase.dose, doseUnit:phase.dose_unit,
    frequency:structuredFrequency(phase.frequency,phase.days_of_week), route:structuredRoute(phase.route)})
}

export function formatFrequency(frequency: string): string {
  if (frequency === '1x/week') return 'weekly'
  if (frequency === 'eod') return 'every other day'
  return frequency.replace(/^every(\d+)days$/, 'every $1 days')
}

function normalizeProtocol(row: ProtocolEventRow): TimelineEvent {
  // A protocol-only event may inherit compound context only for a single-compound protocol.
  const compound = row.compounds ?? (!row.compound_id && row.protocols?.compounds?.length === 1 ? row.protocols.compounds[0] : null)
  const name = compound?.name || row.protocols?.name
  const action = protocolActions[row.event_type ?? '']
  const title = action ? `${name || 'Protocol'} ${action}` : (row.event_type?.replaceAll('_', ' ') || 'Protocol update')
  const original = row.description?.trim() || ''
  let description = original
  if (name && action) {
    // Remove only an exact mechanical title or prefix; retain dose changes and free text.
    const verbs: Record<string, string> = { started: 'Started', stopped: 'Stopped', completed: 'Completed', paused: 'Paused', resumed: 'Resumed', compound_added: 'Added', compound_removed: 'Removed' }
    const prefix = verbs[row.event_type ?? ''] ? `${verbs[row.event_type!]} ${name}` : ''
    if (textKey(original) === textKey(title) || (prefix && textKey(original) === textKey(prefix))) description = ''
    else if (prefix && original.toLowerCase().startsWith(`${prefix.toLowerCase()} at `)) description = original.slice(prefix.length + 4)
  }
  return {
    id: `protocol_events:${row.id}`, date: row.date, category: 'Protocol', title,
    description: description || undefined, sourceType: 'protocol_events', sourceId: row.id,
    metadata: {
      eventType: row.event_type, protocolId: row.protocol_id, compoundId: row.compound_id,
      compoundName: compound?.name ?? null, protocolStartDate: row.protocols?.start_date ?? null,
      protocolStatus: row.protocols?.status ?? null,
      ...planMetadata(compound, row.protocols?.start_date ?? null, row.date),
      metadataSource: 'saved_plan',
    },
  }
}

/** Conservative suppression: repeated rows, or identical details for the same
 * non-null protocol AND compound identity/action/date. Names never identify events.
 */
export function normalizeTimeline(protocols: ProtocolEventRow[], journal: JournalEntryRow[]): TimelineEvent[] {
  const seen = new Set<string>()
  const events: TimelineEvent[] = []
  for (const row of [...protocols].sort((a, b) => a.id.localeCompare(b.id))) {
    const key = JSON.stringify([row.protocol_id ? ['protocol', row.protocol_id, row.compound_id] : ['source', row.id], row.event_type, row.date, textKey(row.description ?? ''), row.protocols, row.compounds])
    if (seen.has(key)) continue
    seen.add(key)
    events.push(normalizeProtocol(row))
  }
  const journalSeen = new Set<string>()
  for (const row of journal) {
    const key = JSON.stringify(row)
    if (journalSeen.has(key)) continue
    journalSeen.add(key)
    if (row.weight != null && Number.isFinite(row.weight)) {
      events.push({
        id: `journal_entries:${row.id}:weight`, date: row.date, category: 'Weight',
        title: `${row.weight} lbs`, sourceType: 'journal_entries', sourceId: row.id,
        metadata: { weight: row.weight, unit: 'lbs' },
      })
    }
    const metrics = [
      row.mood != null ? `Mood ${row.mood}/5` : null,
      row.energy != null ? `Energy ${row.energy}/5` : null,
      row.hunger != null ? `Hunger ${row.hunger}/5` : null,
      row.sleep != null ? `Sleep ${row.sleep}h` : null,
    ].filter(Boolean).join(' · ')
    if (row.notes?.trim() || metrics || row.weight == null) {
      events.push({
        id: `journal_entries:${row.id}:journal`, date: row.date, category: 'Journal',
        title: 'Daily check-in', description: [row.notes?.trim(), metrics].filter(Boolean).join('\n') || undefined,
        sourceType: 'journal_entries', sourceId: row.id,
        metadata: { mood: row.mood, energy: row.energy, hunger: row.hunger, sleep: row.sleep },
      })
    }
  }
  return events.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

/** Date-only database values are calendar days, not UTC instants. */
export function formatTimelineDate(date: string): string {
  const value = new Date(/^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T12:00:00` : date)
  return Number.isNaN(value.getTime()) ? date : value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}


export type BaselineProtocol = {
  id: string; name: string | null; startDate: string | null; week: number | null; status: string
  compounds: { id: string; name: string | null; details: string[]; issue: string | null }[]
}
export type CurrentBaseline = {
  weight: number | null; weightDate: string | null; activeProtocolCount: number
  activeProtocols: BaselineProtocol[]
  lastProtocolChangeDate: string | null; lastProtocolChangeTitle: string | null
}

export function deriveBaseline(protocols: ProtocolRow[], journal: JournalEntryRow[], events: TimelineEvent[], today: string): CurrentBaseline {
  const active = protocols.filter(protocol => protocol.status === 'active')
    .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? '') || a.id.localeCompare(b.id))
  const weight = [...journal].filter(row => row.date <= today && row.weight != null && Number.isFinite(row.weight))
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))[0]
  const lastChange = events.filter(event => event.category === 'Protocol' && event.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))[0]
  return {
    weight: weight?.weight ?? null, weightDate: weight?.date ?? null,
    activeProtocolCount: active.length,
    activeProtocols: active.map(protocol => ({
      id: protocol.id, name: protocol.name, startDate: protocol.start_date,
      status: protocol.status!, week: protocolWeek(protocol.start_date, today),
      compounds: protocol.compounds?.length ? [...protocol.compounds].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '') || a.id.localeCompare(b.id))
        .map(compound => ({ id: compound.id, name: compound.name,
          details: resolveBaselineDetails(compound, protocol, today), issue: baselineDosingIssue(compound,protocol,today),
        })) : [{ id: protocol.id, name: null, details: resolveBaselineDetails(null, protocol, today), issue: baselineDosingIssue(null,protocol,today) }],
    })),
    lastProtocolChangeDate: lastChange?.date ?? null, lastProtocolChangeTitle: lastChange?.title || null,
  }
}

export function protocolMetadataChips(event: TimelineEvent): string[] {
  if (event.category !== 'Protocol' || !event.metadata) return []
  return formatPlanDetails(event.metadata)
}

function formatPlanDetails(metadata: NonNullable<TimelineEvent['metadata']>): string[] {
  const { dose, doseUnit, frequency, route } = metadata
  return [
    typeof dose === 'number' && doseUnit ? `${dose} ${doseUnit}` : null,
    typeof frequency === 'string' && frequency ? formatFrequency(frequency) : null,
    typeof route === 'string' && route ? route : null,
  ].filter((value): value is string => Boolean(value))
}

export function groupTimeline(events: TimelineEvent[]) {
  const months: { key: string; label: string; days: { date: string; events: TimelineEvent[] }[] }[] = []
  for (const event of [...events].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))) {
    const date = event.date.slice(0, 10)
    const key = date.slice(0, 7)
    let month = months.at(-1)
    if (month?.key !== key) {
      const value = new Date(`${key}-01T12:00:00`)
      month = { key, label: Number.isNaN(value.getTime()) ? key : value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), days: [] }
      months.push(month)
    }
    let day = month.days.at(-1)
    if (day?.date !== date) { day = { date, events: [] }; month.days.push(day) }
    day.events.push(event)
  }
  return months
}
