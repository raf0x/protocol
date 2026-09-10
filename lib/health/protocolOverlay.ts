import { currentPhase } from './dosing'
import { dosingDisplay } from './dosingEntry'
import { scheduleLabel, type LibraryCompound, type LibraryProtocol } from './protocolPresentation'
import type { BiomarkerHistory, LabObservation } from './labs'
import type { PhaseRow } from './timeline'

export type OverlayProtocolEvent = {
  id: string; date: string; event_type: string | null; description: string | null
  protocol_id: string | null; compound_id: string | null
}

export type ProtocolOverlayData = { protocols: LibraryProtocol[]; events: OverlayProtocolEvent[] }
export type OverlayMarker = {
  id: string; date: string; protocolId: string; compoundId: string | null
  title: string; description: string | null; type: 'started' | 'completed' | 'change' | 'phase' | 'status'
}
export type HistoricalProtocolContext = {
  protocolId: string; protocolName: string; compoundId: string; compoundName: string
  phaseId: string | null; week: number | null; dose: string; frequency: string | null; route: string | null
  confirmed: boolean; issue: string | null
}
export type OverlayWindow = '3m' | '6m' | '12m' | 'all'

const day = (value: string | null | undefined) => value?.slice(0, 10) ?? ''
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T12:00:00Z`))
const phaseDate = (start: string, week: number) => {
  const date = new Date(`${day(start)}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + (week - 1) * 7)
  return date.toISOString().slice(0, 10)
}
const protocolEnd = (protocol: LibraryProtocol) => day(protocol.completed_date)

/** Historical lifecycle is reconstructed only from explicit dates and status events. */
export function protocolActiveOnDate(protocol: LibraryProtocol, date: string, events: OverlayProtocolEvent[] = []) {
  const start = day(protocol.start_date), end = protocolEnd(protocol)
  if (!validDay(date) || !validDay(start) || date < start || (end && date > end)) return false
  let active = true
  const states = events.filter(event => event.protocol_id === protocol.id && event.date <= date)
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  for (const event of states) {
    if (['paused', 'stopped'].includes(event.event_type ?? '') || (event.event_type === 'completed' && event.date < date)) active = false
    if (['started', 'resumed', 'continued'].includes(event.event_type ?? '')) active = true
  }
  return active
}

function protocolWeek(start: string, date: string) {
  const elapsed = (Date.parse(`${date}T12:00:00Z`) - Date.parse(`${day(start)}T12:00:00Z`)) / 86400000
  return Number.isFinite(elapsed) && elapsed >= 0 ? Math.floor(elapsed / 7) + 1 : null
}

function confirmedDose(phase: PhaseRow) {
  const display = dosingDisplay(phase)
  if (phase.dosing_entry) {
    return { label: display.primary, confirmed: phase.dosing_entry.review_status === 'confirmed' && Boolean(display.medication) }
  }
  return { label: display.primary, confirmed: phase.dose_semantics_version === 1 && Boolean(display.medication) }
}

export function contextAtDate(protocol: LibraryProtocol, date: string, events: OverlayProtocolEvent[] = []): HistoricalProtocolContext[] {
  if (!protocolActiveOnDate(protocol, date, events)) return []
  const week = protocol.start_date ? protocolWeek(protocol.start_date, date) : null
  return (protocol.compounds ?? []).map(compound => {
    const phase = protocol.start_date ? currentPhase(compound.phases ?? [], protocol.start_date, date) : null
    if (!phase) return { protocolId: protocol.id, protocolName: protocol.name || 'Protocol', compoundId: compound.id,
      compoundName: compound.name || 'Compound', phaseId: null, week, dose: 'Dose not confirmed for this date', frequency: null,
      route: null, confirmed: false, issue: 'Protocol history incomplete' }
    const dose = confirmedDose(phase)
    return { protocolId: protocol.id, protocolName: protocol.name || 'Protocol', compoundId: compound.id,
      compoundName: compound.name || 'Compound', phaseId: phase.id, week, dose: dose.confirmed ? dose.label : 'Dose not confirmed for this date',
      frequency: phase.frequency ? scheduleLabel(phase) : null, route: phase.route ?? compound.route ?? null,
      confirmed: dose.confirmed, issue: dose.confirmed ? null : 'Historical dose semantics are unverified' }
  })
}

function phaseMarkers(protocol: LibraryProtocol, compound: LibraryCompound): OverlayMarker[] {
  if (!protocol.start_date) return []
  const phases = [...(compound.phases ?? [])].filter(phase => phase.start_week != null && phase.start_week > 1)
    .sort((a, b) => a.start_week! - b.start_week! || a.id.localeCompare(b.id))
  const all = [...(compound.phases ?? [])].filter(phase => phase.start_week != null)
    .sort((a, b) => a.start_week! - b.start_week! || a.id.localeCompare(b.id))
  return phases.map(phase => {
    const index = all.findIndex(item => item.id === phase.id), previous = index > 0 ? all[index - 1] : null
    const nextDose = confirmedDose(phase), previousDose = previous ? confirmedDose(previous) : null
    const changed = Boolean(previousDose?.confirmed && nextDose.confirmed && previousDose.label !== nextDose.label)
    return { id: `phase:${phase.id}`, date: phaseDate(protocol.start_date!, phase.start_week!), protocolId: protocol.id,
      compoundId: compound.id, title: changed ? `${compound.name || 'Compound'} dose changed` : `${compound.name || 'Compound'} phase started`,
      description: changed ? `${previousDose!.label} → ${nextDose.label}` : nextDose.confirmed ? nextDose.label : 'Dose not confirmed for this phase',
      type: changed ? 'change' : 'phase' }
  })
}

export function overlayMarkers(protocols: LibraryProtocol[], events: OverlayProtocolEvent[]) {
  const markers: OverlayMarker[] = []
  const rawKeys = new Set(events.map(event => `${event.protocol_id}:${event.event_type}:${event.date}`))
  for (const protocol of protocols) {
    const start = day(protocol.start_date), completed = protocolEnd(protocol)
    if (start && !rawKeys.has(`${protocol.id}:started:${start}`)) markers.push({ id: `start:${protocol.id}`, date: start, protocolId: protocol.id,
      compoundId: null, title: `${protocol.name || 'Protocol'} started`, description: null, type: 'started' })
    if (completed && !rawKeys.has(`${protocol.id}:completed:${completed}`)) markers.push({ id: `completed:${protocol.id}`, date: completed,
      protocolId: protocol.id, compoundId: null, title: `${protocol.name || 'Protocol'} completed`, description: null, type: 'completed' })
    for (const compound of protocol.compounds ?? []) markers.push(...phaseMarkers(protocol, compound))
  }
  for (const event of events) {
    if (!event.protocol_id || !validDay(day(event.date))) continue
    const protocol = protocols.find(item => item.id === event.protocol_id)
    const compound = protocol?.compounds?.find(item => item.id === event.compound_id)
    const action = (event.event_type ?? 'update').replaceAll('_', ' ')
    markers.push({ id: `event:${event.id}`, date: day(event.date), protocolId: event.protocol_id, compoundId: event.compound_id,
      title: `${compound?.name || protocol?.name || 'Protocol'} ${action}`, description: event.description?.trim() || null,
      type: event.event_type === 'started' ? 'started' : event.event_type === 'completed' ? 'completed' : event.event_type === 'dose_change' ? 'change' : 'status' })
  }
  const seen = new Set<string>()
  return markers.filter(marker => {
    const key = `${marker.protocolId}:${marker.compoundId}:${marker.type}:${marker.date}:${marker.title}:${marker.description}`
    if (seen.has(key)) return false; seen.add(key); return true
  }).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

export function filterByWindow<T extends { date: string }>(items: T[], latestDate: string, window: OverlayWindow) {
  if (window === 'all' || !validDay(latestDate)) return [...items]
  const months = window === '3m' ? 3 : window === '6m' ? 6 : 12
  const cutoff = new Date(`${latestDate}T12:00:00Z`)
  cutoff.setUTCMonth(cutoff.getUTCMonth() - months)
  const key = cutoff.toISOString().slice(0, 10)
  return items.filter(item => item.date >= key && item.date <= latestDate)
}

export function overlappingProtocolIds(protocols: LibraryProtocol[], observations: LabObservation[]) {
  if (!observations.length) return []
  const dates = observations.map(item => item.date).sort(), earliest = dates[0], latest = dates.at(-1)!
  return protocols.filter(protocol => {
    const start = day(protocol.start_date), end = protocolEnd(protocol)
    return start && start <= latest && (!end || end >= earliest)
  }).map(protocol => protocol.id)
}

export function changesBetween(markers: OverlayMarker[], olderDate: string, newerDate: string) {
  return markers.filter(marker => marker.date > olderDate && marker.date < newerDate && ['change', 'phase', 'started', 'completed', 'status'].includes(marker.type))
}

export function unitSeries(history: BiomarkerHistory, unit: string) {
  return history.units.find(group => group.unit === unit) ?? null
}

export function overlayChart(observations: LabObservation[], markers: OverlayMarker[]) {
  const numeric = observations.length > 1 && observations.every(item => item.result.value != null && Number.isFinite(item.result.value))
    && new Set(observations.map(item => item.date)).size === observations.length
  const dates = [...observations.map(item => item.date), ...markers.map(item => item.date)].filter(validDay).sort()
  if (!dates.length) return { points: [], markers: [], range: null }
  const first = dates[0], last = dates.at(-1)!, start = Date.parse(`${first}T12:00:00Z`), span = Date.parse(`${last}T12:00:00Z`) - start
  const x = (date: string) => span ? 16 + (Date.parse(`${date}T12:00:00Z`) - start) / span * 268 : 150
  if (!numeric) return { points: [], markers: markers.map(marker => ({ ...marker, x: x(marker.date) })), range: null }
  const ordered = [...observations].sort((a, b) => a.date.localeCompare(b.date))
  const sameRange = ordered.every(item => item.result.reference_low != null && item.result.reference_high != null
    && item.result.reference_low === ordered[0].result.reference_low && item.result.reference_high === ordered[0].result.reference_high)
  const low = sameRange ? ordered[0].result.reference_low! : null, high = sameRange ? ordered[0].result.reference_high! : null
  const values = ordered.map(item => item.result.value!), scale = low == null || high == null ? values : [...values, low, high]
  const min = Math.min(...scale), max = Math.max(...scale), y = (value: number) => max === min ? 70 : 112 - (value - min) / (max - min) * 88
  return { points: ordered.map(item => ({ x: x(item.date), y: y(item.result.value!), observation: item })),
    markers: markers.map(marker => ({ ...marker, x: x(marker.date) })), range: low == null || high == null ? null : { top: y(high), bottom: y(low) } }
}
