import { protocolLifecycle } from '../health/protocolDates'
import { todayProtocols } from '../health/today'
import type { ProtocolRow } from '../health/timeline'

export const ringColors = ['#39ff14', '#6c63ff', '#f59e0b', '#06b6d4', '#f43f5e', '#a3e635']
export const ringPositions = [[0, 0], [2, 0], [4, 0], [1, 1], [3, 1]] as const
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0
/** Stable chronological assignment, including stable ties, independent of query order. */
export function orderRingProtocols<T extends { id: string; created_at?: string; compounds?: { id: string }[] | null }>(protocols: T[]): T[] {
  return [...protocols].sort((a, b) => compare(a.created_at || '', b.created_at || '') || compare(a.id, b.id))
    .map(p => ({ ...p, compounds: p.compounds ? [...p.compounds].sort((a, b) => compare(a.id, b.id)) : p.compounds }))
}
export function activeRingItems(protocols: ProtocolRow[], today: string) {
  return todayProtocols(orderRingProtocols(protocols).filter(p => protocolLifecycle(p, today) === 'active'), today)
}
