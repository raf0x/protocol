import { currentPhase, isMedicationUnit } from '../dosing'
import { dosingDisplay, type DosingEntry } from '../dosingEntry'
import { scheduleLabel, type LibraryProtocol } from '../protocolPresentation'
import type { OverlayProtocolEvent } from '../protocolOverlay'
import type { PhaseRow } from '../timeline'
import { day, weekDate } from './dates'
import type { LongitudinalSource, MedicationDose, ProtocolState } from './types'

export const object = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
const text = (value: unknown) => typeof value === 'string' ? value : null
const numeric = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null

export function snapshotPhase(value: unknown): PhaseRow | null {
  const state = object(value)
  if (!state || typeof state.phaseId !== 'string') return null
  return { id: state.phaseId, start_week: numeric(state.startWeek), end_week: numeric(state.endWeek),
    dose: state.doseConfirmed === true ? numeric(state.medicationDose) : null,
    dose_unit: state.doseConfirmed === true ? text(state.medicationUnit) : null,
    dose_semantics_version: state.doseConfirmed === true ? 1 : null,
    dosing_entry: object(state.dosingEntry) as DosingEntry | null,
    frequency: text(state.frequency), route: text(state.route) }
}

export function medicationForPhase(phase: PhaseRow | null): MedicationDose | null {
  if (!phase || (phase.dosing_entry ? phase.dosing_entry.review_status !== 'confirmed' : phase.dose_semantics_version !== 1)) return null
  const dose = dosingDisplay(phase).medication
  return validMedication(dose)
}
function validMedication(dose: { value: number; unit: string } | null): MedicationDose | null {
  return dose && Number.isFinite(dose.value) && dose.value > 0 && isMedicationUnit(dose.unit) ? { value: dose.value, unit: dose.unit } : null
}
export function compareMedication(before: MedicationDose | null, after: MedicationDose | null): number | null {
  if (!before || !after || (before.unit === 'IU') !== (after.unit === 'IU')) return null
  const value = (dose: MedicationDose) => dose.value * (dose.unit === 'mg' ? 1000 : 1)
  const difference = value(after) - value(before)
  if (!Number.isFinite(difference) || !Number.isFinite(value(before)) || !Number.isFinite(value(after))) return null
  return Math.abs(difference) <= Math.max(value(before), value(after)) * 1e-10 ? 0 : difference
}

export function eventCompoundId(event: OverlayProtocolEvent): string | null {
  return event.compound_id || (typeof event.metadata?.compoundId === 'string' ? event.metadata.compoundId : null)
}

function snapshotList(event: OverlayProtocolEvent, side: 'previous' | 'new'): PhaseRow[] {
  const direct = snapshotPhase(event.metadata?.[`${side}State`])
  const raw = event.metadata?.[`${side}States`]
  const many = Array.isArray(raw) ? raw.map(snapshotPhase).filter((phase): phase is PhaseRow => Boolean(phase)) : []
  const result = direct ? [direct, ...many] : many
  return [...new Map(result.map(phase => [phase.id, phase])).values()]
}

export type ProtocolActivity = 'active' | 'inactive' | 'ambiguous'
const activeLifecycle = new Set(['started', 'resumed', 'continued', 'reactivated'])
const inactiveLifecycle = new Set(['stopped', 'completed', 'paused'])

/** Canonical date-only lifecycle policy. Calendar-day records do not provide an
 * intraday ordering, so conflicting same-day states remain unresolved. A saved
 * completion date is an exclusive boundary unless a later explicit event records
 * another active interval. */
export function protocolActivityAtDate(protocol: LibraryProtocol, date: string, events: OverlayProtocolEvent[] = []): ProtocolActivity {
  const target = day(date), start = day(protocol.start_date), end = day(protocol.completed_date)
  if (!target || !start || target < start) return 'inactive'
  const allLifecycle = events.filter(event => event.protocol_id === protocol.id && day(event.date)
    && (activeLifecycle.has(event.event_type ?? '') || inactiveLifecycle.has(event.event_type ?? '')))
  const lifecycle = allLifecycle.filter(event => day(event.date)! <= target)
  const states: { date: string; active: boolean; source: 'saved' | 'event' }[] = [{ date: start, active: true, source: 'saved' }]
  if (end && end <= target) states.push({ date: end, active: false, source: 'saved' })
  // A prospective reactivation records the prior completed_date before clearing it
  // from the current protocol row. Treat that metadata as an explicit inactive
  // boundary so a legacy completion is not erased merely because it lacked an old
  // protocol_events row. Missing metadata remains missing evidence.
  for (const event of allLifecycle.filter(event => event.event_type === 'reactivated')) {
    const priorCompleted = day(typeof event.metadata?.previousCompletedDate === 'string' ? event.metadata.previousCompletedDate : null)
    if (priorCompleted && priorCompleted <= target) states.push({ date: priorCompleted, active: false, source: 'event' })
  }
  for (const event of lifecycle) states.push({ date: day(event.date)!, active: activeLifecycle.has(event.event_type ?? ''), source: 'event' })
  const latestDate = states.map(item => item.date).sort().at(-1)!
  const latest = states.filter(item => item.date === latestDate)
  const resolved = new Set(latest.map(item => item.active))
  if (resolved.size !== 1) return 'ambiguous'
  const activity: ProtocolActivity = resolved.has(true) ? 'active' : 'inactive'
  // An undated legacy non-active status cannot be placed on the calendar. Do not
  // let a start record manufacture activity after an unknown pause/stop/completion.
  const onlyStartBoundary = latestDate === start && !end && lifecycle.every(event => event.event_type === 'started')
  if (activity === 'active' && onlyStartBoundary && protocol.status && protocol.status !== 'active') return 'ambiguous'
  const futureReactivation = allLifecycle.filter(event => event.event_type === 'reactivated' && day(event.date)! > target)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
  if (activity === 'active' && !end && futureReactivation) {
    const boundary = day(futureReactivation.date)!
    const metadataCompletion = day(typeof futureReactivation.metadata?.previousCompletedDate === 'string' ? futureReactivation.metadata.previousCompletedDate : null)
    const knownInactiveBeforeReactivation = allLifecycle.some(event => inactiveLifecycle.has(event.event_type ?? '') && day(event.date)! < boundary)
      || Boolean(metadataCompletion && metadataCompletion < boundary)
    if (!knownInactiveBeforeReactivation) return 'ambiguous'
  }
  return activity
}

type RestoredPhase = { phase: PhaseRow; provenance: ProtocolState['provenance']; eventIds: string[]; ambiguous: boolean }
/** Replay snapshots by effective calendar day, not UUID order. Conflicting same-day
 * snapshots cannot establish an intraday order and are deliberately unresolved.
 * A saved plan is never presented as an immutable administration log. */
export function phasesAtDate(protocol: LibraryProtocol, compoundId: string, date: string, events: OverlayProtocolEvent[]): RestoredPhase[] {
  const compound = protocol.compounds?.find(item => item.id === compoundId)
  const relevant = events.filter(event => event.protocol_id === protocol.id && eventCompoundId(event) === compoundId && event.metadata?.version === 1 && day(event.date))
  const phases = new Map((compound?.phases ?? []).map(phase => [phase.id, phase]))
  for (const event of relevant) for (const side of ['previous', 'new'] as const) {
    for (const phase of snapshotList(event, side)) if (!phases.has(phase.id)) phases.set(phase.id, phase)
  }
  const restored: RestoredPhase[] = []
  for (const saved of phases.values()) {
    const creations = relevant.filter(event => {
      const next = snapshotList(event, 'new').find(phase => phase.id === saved.id)
      const prior = snapshotList(event, 'previous')[0] ?? null
      return Boolean(next) && (event.event_type === 'phase_started' || (event.metadata?.source === 'quick_dose_change' && prior && prior.id !== next!.id))
    }).map(event => day(event.date)!).sort()
    if (creations[0] && creations[0] > date) continue
    // A quick change records the exact date, while start_week is rounded. The old
    // phase remains in force until that effective date, not the week's first day.
    const closed = relevant.some(event => day(event.date)! <= date && event.metadata?.source === 'quick_dose_change'
      && snapshotList(event, 'previous').some(phase => phase.id === saved.id)
      && !snapshotList(event, 'new').some(phase => phase.id === saved.id))
    if (closed) continue
    const future = relevant.flatMap(event => snapshotList(event, 'previous')
      .filter(phase => day(event.date)! > date && phase.id === saved.id).map(phase => ({ event, phase })))
      .sort((a, b) => a.event.date.localeCompare(b.event.date))
    const past = relevant.flatMap(event => snapshotList(event, 'new')
      .filter(phase => day(event.date)! <= date && phase.id === saved.id).map(phase => ({ event, phase })))
      .sort((a, b) => b.event.date.localeCompare(a.event.date))
    const candidates = future.length ? future : past
    const selected = candidates.filter(item => day(item.event.date) === day(candidates[0]?.event.date))
    let phase = selected[0]?.phase ?? { ...saved }
    const ambiguous = new Set(selected.map(item => JSON.stringify(item.phase))).size > 1
    // Continuing an expired phase must not fill the gap before the continuation.
    const continuation = relevant.filter(event => event.event_type === 'phase_continued' && event.metadata?.phaseId === saved.id && day(event.date)! > date)
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    if (continuation && numeric(continuation.metadata?.previousEndWeek) != null) phase = { ...phase, end_week: numeric(continuation.metadata?.previousEndWeek) }
    restored.push({ phase, provenance: ambiguous ? 'unknown' : selected.length ? 'snapshot' : 'saved_plan',
      eventIds: [...new Set([...selected.map(item => item.event.id), ...(continuation ? [continuation.id] : [])])], ambiguous })
  }
  return restored
}

export function healthStateAtDate(source: Pick<LongitudinalSource, 'protocols' | 'protocolEvents'>, date: string): ProtocolState[] {
  if (!day(date)) return []
  const result: ProtocolState[] = []
  for (const protocol of source.protocols) {
    if (protocolActivityAtDate(protocol, date, source.protocolEvents) !== 'active') continue
    const events = source.protocolEvents.filter(event => event.protocol_id === protocol.id)
    const compoundIds = new Set([...(protocol.compounds ?? []).map(compound => compound.id), ...events.map(eventCompoundId).filter((id): id is string => Boolean(id))])
    for (const compoundId of compoundIds) {
      const compound = protocol.compounds?.find(item => item.id === compoundId)
      const compoundEvents = events.filter(event => eventCompoundId(event) === compoundId)
      const actions = compoundEvents.filter(event => day(event.date) && ['compound_added', 'compound_removed'].includes(event.event_type ?? ''))
      const added = actions.filter(event => event.event_type === 'compound_added').map(event => day(event.date)!).sort()[0]
      if (added && date < added) continue
      const pastActions = actions.filter(event => day(event.date)! <= date)
      const latestActionDate = pastActions.map(event => day(event.date)!).sort().at(-1) ?? null
      const latestActions = latestActionDate ? pastActions.filter(event => day(event.date) === latestActionDate) : []
      const presence = new Set(latestActions.map(event => event.event_type))
      // Calendar-day compound add/remove records do not establish intraday order.
      // When they conflict, omit the compound rather than letting row/UUID order
      // manufacture a historical presence state.
      if (presence.has('compound_added') && presence.has('compound_removed')) continue
      if (presence.has('compound_removed')) continue
      const restored = phasesAtDate(protocol, compoundId, date, events)
      if (!restored.length && compound?.phases?.length) continue // not yet created
      const selected = currentPhase(restored.map(item => item.phase), protocol.start_date!, date)
      const match = restored.find(item => item.phase === selected)
      const limitations: string[] = []
      if (!selected || match?.ambiguous) limitations.push('No unambiguous phase covers this date.')
      if (match?.provenance !== 'snapshot') limitations.push('Reconstructed from the current saved plan; unrecorded historical edits cannot be recovered.')
      else limitations.push('Snapshot schedule days/times were not retained; only recorded frequency and route are available.')
      if (!compound) limitations.push('Compound record is absent; retained event snapshots are the only available history.')
      const medication = match?.ambiguous ? null : medicationForPhase(selected)
      if (!medication) limitations.push('Medication dose is not confirmed; syringe markings and volume are not medication IU.')
      const display = selected ? dosingDisplay(selected) : null
      const frequency = selected && !match?.ambiguous ? scheduleLabel(selected) : null
      const eventName = compoundEvents.map(event => typeof event.metadata?.compoundName === 'string' ? event.metadata.compoundName : null).find(Boolean)
      result.push({ protocolId: protocol.id, compoundId, name: compound?.name || eventName || protocol.name || 'Recorded compound',
        phaseId: selected?.id ?? null, medication, administration: !medication && selected?.dosing_entry ? display?.primary ?? null : null,
        frequency: frequency === 'Schedule not set' ? null : frequency, route: match?.ambiguous ? null : selected?.route ?? null,
        provenance: match?.provenance ?? 'unknown', limitations,
        sources: match?.eventIds.length ? match.eventIds.map(id => ({ table: 'protocol_events' as const, id, label: 'Structured phase snapshot' }))
          : selected ? [{ table: 'phases', id: selected.id, label: 'Saved phase plan' }] : [{ table: 'protocols', id: protocol.id, label: 'Protocol record' }] })
    }
  }
  return result.sort((a, b) => a.protocolId.localeCompare(b.protocolId) || a.compoundId.localeCompare(b.compoundId))
}

export function plannedPhaseStart(protocol: LibraryProtocol, phase: PhaseRow): string | null {
  return weekDate(protocol.start_date, phase.start_week)
}
