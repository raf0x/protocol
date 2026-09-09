import { currentPhase } from './dosing'
import { dosingDisplay } from './dosingEntry'
import { resolveBaselineDetails, normalizeTimeline, type ProtocolRow, type ProtocolEventRow, type JournalEntryRow } from './timeline'

/** Presentation only. Scheduling, dose interpretation and writes remain in their existing owners. */
export function todayProtocols(protocols: ProtocolRow[], date: string) {
  return protocols.flatMap(protocol => (protocol.compounds ?? []).map(compound => {
    const phase = protocol.start_date ? currentPhase(compound.phases ?? [], protocol.start_date, date) : null
    const display = dosingDisplay(phase)
    const details = resolveBaselineDetails(compound, protocol, date)
    const days = protocol.start_date ? (Date.parse(date) - Date.parse(protocol.start_date.slice(0, 10))) / 86400000 : NaN
    return {
      id: compound.id, name: compound.name || protocol.name || 'Unnamed compound',
      details: details.length ? details.join(' · ') : display.medication ? display.primary : 'Dose not fully calculated',
      week: Number.isFinite(days) && days >= 0 ? Math.floor(days / 7) + 1 : null,
      hasPhase: Boolean(phase),
    }
  }))
}

export type TodayDue = { id: string; name: string; dose: string; dose_unit: string; time_of_day: string }
export function nextTodayDose(due: TodayDue[], logs: Record<string, { taken: boolean }>) {
  const order: Record<string, number> = { morning: 0, afternoon: 1, evening: 2, night: 3 }
  return [...due].filter(item => !logs[item.id]?.taken).sort((a, b) =>
    (order[a.time_of_day] ?? 4) - (order[b.time_of_day] ?? 4) || a.id.localeCompare(b.id))[0] ?? null
}

export function recentChanges(events: ProtocolEventRow[], protocols: ProtocolRow[]) {
  return normalizeTimeline(events.map(event => {
    const protocol = event.protocols ?? protocols.find(p => p.id === event.protocol_id) ?? null
    return { ...event, protocols: protocol, compounds: event.compounds ?? protocol?.compounds?.find(c => c.id === event.compound_id) ?? null }
  }), []).slice(0, 3)
}

export function journalSnapshot(entries: JournalEntryRow[]) {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date))
  const weights = sorted.filter(entry => entry.weight !== null && Number.isFinite(entry.weight) && entry.weight! > 0)
  const latest = weights[0] ?? null
  const first = weights.length > 1 ? weights[weights.length - 1] : null
  return {
    latest, first, change: latest && first ? latest.weight! - first.weight! : null,
    energy: sorted.find(entry => entry.energy !== null && Number.isFinite(entry.energy)) ?? null,
    sleep: sorted.find(entry => entry.sleep !== null && Number.isFinite(entry.sleep)) ?? null,
    mood: sorted.find(entry => entry.mood !== null && Number.isFinite(entry.mood)) ?? null,
  }
}
