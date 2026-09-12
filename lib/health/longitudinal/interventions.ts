import { addDays, day, numberLabel, weekDate } from './dates'
import { currentPhase } from '../dosing'
import { compareMedication, healthStateAtDate, medicationForPhase, object, snapshotPhase } from './history'
import type { Intervention, InterventionKind, LongitudinalSource } from './types'

const actions: Record<string, InterventionKind> = {
  started: 'started', stopped: 'stopped', completed: 'stopped', paused: 'paused', resumed: 'resumed', continued: 'resumed',
  compound_added: 'compound_added', compound_removed: 'compound_removed', dose_change: 'dose_changed',
  frequency_change: 'frequency_changed', route_change: 'route_changed', phase_started: 'phase_started', phase_continued: 'phase_continued', phase_ended: 'phase_ended',
}
const labels: Record<InterventionKind, string> = { started: 'started', stopped: 'ended', paused: 'paused', resumed: 'resumed',
  compound_added: 'added', compound_removed: 'removed', dose_increased: 'dose increased', dose_decreased: 'dose decreased', dose_changed: 'dosing entry changed',
  frequency_changed: 'frequency changed', route_changed: 'route changed', phase_started: 'phase started', phase_ended: 'phase ended', phase_continued: 'phase continued' }

export function detectInterventions(source: LongitudinalSource, asOf: string): Intervention[] {
  const items: Intervention[] = []
  for (const event of source.protocolEvents) {
    const metadata = event.metadata?.version === 1 ? event.metadata : null
    const protocolId = event.protocol_id || (typeof metadata?.protocolId === 'string' ? metadata.protocolId : null)
    const kind = actions[event.event_type ?? ''], protocol = source.protocols.find(item => item.id === protocolId)
    const compoundId = event.compound_id || (typeof metadata?.compoundId === 'string' ? metadata.compoundId : null)
    let date = day(event.date)
    if (!protocolId || !kind || !date || (day(protocol?.start_date) && day(protocol?.start_date)! > asOf)) continue
    const next = snapshotPhase(metadata?.newState), previous = snapshotPhase(metadata?.previousState)
    if (kind === 'phase_started' && protocol && next) {
      const planned = weekDate(protocol.start_date, next.start_week)
      if (planned && planned > date) date = planned
    }
    if (date > asOf) continue
    // Editing a non-covering historical/future phase is a plan edit, not an
    // intervention on the edit date. Do not invent an exposure transition.
    if (protocol && next && ['dose_changed', 'frequency_changed', 'route_changed'].includes(kind)
      && !currentPhase([next], protocol.start_date!, date)) continue
    const name = protocol?.compounds?.find(item => item.id === compoundId)?.name || protocol?.name || 'Recorded protocol'
    const before = medicationForPhase(previous), after = medicationForPhase(next)
    const difference = compareMedication(before, after)
    const action = kind === 'dose_changed' && difference != null && difference !== 0 ? difference > 0 ? 'dose_increased' : 'dose_decreased' : kind
    const limitations: string[] = []
    if (!metadata) limitations.push('Legacy event: exact historical dose and schedule are not verified.')
    if (!protocol) limitations.push('Protocol record is absent; this event does not establish the complete former regimen.')
    if (kind === 'dose_changed' && difference == null) limitations.push('No comparable confirmed medication doses; no medication-unit conversion was inferred.')
    items.push({ id: `event:${event.id}`, protocolId, compoundId, phaseId: typeof metadata?.phaseId === 'string' ? metadata.phaseId : next?.id ?? null,
      kind: action, date, title: `${name} ${labels[action]}`, before, after, provenance: 'event', limitations,
      sources: [{ table: 'protocol_events', id: event.id, label: metadata ? 'Structured protocol event' : 'Legacy protocol event' }] })
  }

  for (const protocol of source.protocols) {
    const start = day(protocol.start_date)
    if (!start || start > asOf) continue
    for (const [kind, date] of [['started', start], ['stopped', day(protocol.completed_date)]] as const) {
      if (!date || date > asOf || items.some(item => item.protocolId === protocol.id && item.kind === kind && item.date === date)) continue
      items.push({ id: `protocol:${protocol.id}:${kind}:${date}`, date, protocolId: protocol.id, compoundId: null, phaseId: null, kind,
        title: `${protocol.name || 'Protocol'} ${labels[kind]}`, before: null, after: null, provenance: 'saved_plan',
        sources: [{ table: 'protocols', id: protocol.id, label: 'Saved lifecycle date' }], limitations: ['Saved lifecycle date; not a confirmed administration log.'] })
    }
    for (const compound of protocol.compounds ?? []) {
      const boundaries = new Set<string>()
      for (const phase of compound.phases ?? []) {
        for (const date of [weekDate(start, phase.start_week), phase.end_week == null ? null : weekDate(start, phase.end_week + 1)]) if (date) boundaries.add(date)
      }
      // Preserve a historical expiration even after the phase has been continued.
      for (const event of source.protocolEvents.filter(item => item.protocol_id === protocol.id && item.compound_id === compound.id && item.metadata?.version === 1)) {
        for (const snapshot of [object(event.metadata?.previousState), object(event.metadata?.newState)]) {
          const end = typeof snapshot?.endWeek === 'number' ? weekDate(start, snapshot.endWeek + 1) : null
          if (end) boundaries.add(end)
        }
        const oldEnd = typeof event.metadata?.previousEndWeek === 'number' ? weekDate(start, event.metadata.previousEndWeek + 1) : null
        if (oldEnd) boundaries.add(oldEnd)
      }
      for (const date of [...boundaries].sort()) {
        if (date <= start || date > asOf) continue
        const scoped = { protocols: [protocol], protocolEvents: source.protocolEvents }
        const before = healthStateAtDate(scoped, addDays(date, -1)).find(item => item.compoundId === compound.id)
        const after = healthStateAtDate(scoped, date).find(item => item.compoundId === compound.id)
        if (before?.phaseId === after?.phaseId || (!before?.phaseId && !after?.phaseId)) continue
        if (!after && !before) continue
        // Exact effective-date events already own this transition. Do not add a
        // second "change" from a rounded week boundary or the same phase/action.
        if (items.some(item => item.protocolId === protocol.id && item.date === date &&
          ((item.compoundId === compound.id && ['phase_started', 'dose_changed', 'dose_increased', 'dose_decreased'].includes(item.kind)) || item.kind === 'stopped'))) continue
        const change = compareMedication(before?.medication ?? null, after?.medication ?? null)
        const kinds: InterventionKind[] = after?.phaseId ? ['phase_started'] : ['phase_ended']
        if (before?.phaseId && after?.phaseId) {
          if (change != null && change !== 0) kinds.splice(0, 1, change > 0 ? 'dose_increased' : 'dose_decreased')
          if (before.frequency !== after.frequency) kinds.push('frequency_changed')
          if (before.route !== after.route) kinds.push('route_changed')
        }
        for (const kind of kinds) items.push({ id: `phase:${compound.id}:${date}:${kind}`, protocolId: protocol.id, compoundId: compound.id,
          phaseId: after?.phaseId ?? before?.phaseId ?? null, date, kind, title: `${compound.name || protocol.name || 'Compound'} ${labels[kind]}`,
          before: before?.medication ?? null, after: after?.medication ?? null, provenance: 'saved_plan',
          sources: [...(before?.sources ?? []), ...(after?.sources ?? [])], limitations: ['Derived from dated phase boundaries; unrecorded plan edits and actual administration are not verified.'] })
      }
    }
  }
  // Initial phases and protocol start are one underlying change, not confounders
  // of each other. Distinct protocol IDs are never merged by name.
  const filtered = items.filter(item => !(item.kind === 'phase_started' && items.some(start => start.protocolId === item.protocolId && start.kind === 'started' && start.date === item.date)))
  const unique = new Map<string, Intervention>()
  for (const item of filtered) {
    const key = JSON.stringify([item.protocolId, item.compoundId, item.phaseId, item.date, item.kind, item.before, item.after, item.provenance,
      // Different source events may carry different schedules or raw entries.
      item.provenance === 'event' ? source.protocolEvents.find(event => `event:${event.id}` === item.id)?.metadata ?? item.id : null])
    const prior = unique.get(key)
    if (prior) prior.sources.push(...item.sources)
    else unique.set(key, { ...item, sources: [...item.sources] })
  }
  return [...unique.values()].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}

export function interventionDoseLabel(item: Intervention): string | null {
  const format = (dose: NonNullable<Intervention['after']>) => `${numberLabel(dose.value)} ${dose.unit}`
  return item.before && item.after ? `${format(item.before)} → ${format(item.after)}` : item.after ? format(item.after) : null
}
