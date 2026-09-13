import { groupTreatments, matchesTreatmentIdentity, treatmentCompoundIndex, treatmentIdentity, treatmentScope, type TreatmentIdentity } from '../protocolIdentity'
import type { Intervention, LongitudinalObservation } from './types'

/** Shared by the main list and Analyst. Insufficient-data observations can stay
 * in the engine for diagnostics without becoming repeated empty cards. */
export function comparableLabObservations(observations: LongitudinalObservation[], changeId = '') {
  return observations.filter(item => item.changes.length > 0 && item.baseline?.type === 'lab'
    && item.followups.every(row => row.type === 'lab') && (!changeId || item.intervention.id === changeId))
}

export function protocolChangeOptions(interventions: Intervention[]) {
  return [...new Map(interventions.map(item => [item.id, item])).values()]
}

export function protocolChangeUrl(query: string, changeId: string) {
  const params = new URLSearchParams(query)
  params.set('view', 'changes')
  if (changeId) params.set('change', changeId)
  else params.delete('change')
  return `/health?${params.toString()}`
}

/** Primary treatment selection with optional event refinement. Changing the
 * treatment clears an incompatible event; unrelated query state is retained. */
export function protocolChangesUrl(query: string, treatmentKey: string, changeId = '') {
  const params = new URLSearchParams(query)
  params.set('view', 'changes')
  if (treatmentKey) params.set('treatment', treatmentKey)
  else params.delete('treatment')
  if (changeId) params.set('change', changeId)
  else params.delete('change')
  return `/health?${params.toString()}`
}

export function interventionTreatmentIdentity(item: Intervention): TreatmentIdentity | null {
  return treatmentIdentity(item.protocolId, item.compoundId)
}

export function longitudinalTreatmentOptions(interventions: readonly Intervention[]) {
  return groupTreatments(interventions, interventionTreatmentIdentity).map(group => {
    const labels = group.items.filter(item => item.compoundId === group.identity.compoundId)
      .flatMap(item => item.treatmentName?.trim() ? [item.treatmentName.trim()] : []).sort()
    const dates = group.items.map(item => item.date.slice(0, 10)).filter(Boolean).sort()
    return { key: group.key, identity: group.identity, scope: treatmentScope(group.identity),
      label: labels[0] ?? (group.identity.compoundId === null ? 'Recorded protocol' : 'Recorded compound'),
      startedAt: dates[0] ?? null,
      interventionIds: [...new Set(group.items.map(item => item.id))].sort() }
  }).sort((a, b) => a.label.localeCompare(b.label) || (a.startedAt ?? '').localeCompare(b.startedAt ?? '') || a.key.localeCompare(b.key))
}

/** Refine existing change options without changing their IDs, order, or URL
 * behavior. Always supply the full collection so association is not filter-dependent. */
export function treatmentProtocolChangeOptions(interventions: Intervention[], selected: TreatmentIdentity | null) {
  const options = protocolChangeOptions(interventions)
  if (selected === null) return options
  const index = treatmentCompoundIndex(interventions.flatMap(item => { const identity = interventionTreatmentIdentity(item); return identity ? [identity] : [] }))
  return options.filter(item => {
    const identity = interventionTreatmentIdentity(item)
    return identity !== null && matchesTreatmentIdentity(identity, selected, index)
  })
}
