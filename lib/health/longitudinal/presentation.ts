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
