import { groupTreatments, matchesTreatmentIdentity, treatmentCompoundIndex, treatmentIdentity, treatmentScope, type TreatmentIdentity } from './protocolIdentity'
import type { TimelineEvent } from './timeline'

export const timelineFilters = ['All', 'Protocols', 'Weight', 'Journal', 'Labs'] as const
export type TimelineFilter = typeof timelineFilters[number]

/** Presentation only. Compare with a strictly earlier calendar day; ambiguous
 * multiple weights on that day are not given an invented ordering. */
export function weightComparisons(events: TimelineEvent[]) {
  const days = new Map<string, TimelineEvent[]>()
  for (const event of events) {
    if (event.category !== 'Weight' || typeof event.metadata?.weight !== 'number' || !Number.isFinite(event.metadata.weight)) continue
    const day = event.date.slice(0, 10)
    const bucket = days.get(day)
    if (bucket) bucket.push(event)
    else days.set(day, [event])
  }
  const result = new Map<string, { delta: number; date: string }>()
  let previous: TimelineEvent[] | undefined
  for (const [, current] of [...days].sort(([a], [b]) => a.localeCompare(b))) {
    if (previous?.length === 1) {
      for (const event of current) {
        if (event.metadata?.unit !== previous[0].metadata?.unit) continue
        result.set(event.id, { delta: Number(((event.metadata!.weight as number) - (previous[0].metadata!.weight as number)).toFixed(2)), date: previous[0].date })
      }
    }
    previous = current
  }
  return result
}

export function journalPresentation(event: TimelineEvent) {
  const metrics = (['mood', 'energy', 'hunger', 'sleep'] as const).flatMap(key => {
    const value = event.metadata?.[key]
    return typeof value === 'number' && Number.isFinite(value)
      ? [`${key[0].toUpperCase()}${key.slice(1)} ${value}${key === 'sleep' ? 'h' : '/5'}`] : []
  })
  // The normalizer appends this exact structured summary to notes. Remove only
  // that generated suffix, never parse or reinterpret user-authored notes.
  const suffix = metrics.join(' · ')
  const description = event.description ?? ''
  const notes = suffix && description === suffix ? '' : suffix && description.endsWith(`\n${suffix}`) ? description.slice(0, -(suffix.length + 1)) : description
  return { metrics, notes }
}

export function eventTime(date: string): string | null {
  if (!date.includes('T')) return null
  const value = new Date(date)
  return Number.isNaN(value.getTime()) ? null : value.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

/** No title parsing and no identity guessed from display names. */
export function timelineTreatmentIdentity(event: TimelineEvent): TreatmentIdentity | null {
  return event.category === 'Protocol'
    ? treatmentIdentity(event.metadata?.protocolId, event.metadata?.compoundId) : null
}

export function timelineTreatmentOptions(events: readonly TimelineEvent[]) {
  return groupTreatments(events, timelineTreatmentIdentity).map(group => {
    const labels = group.items.flatMap(event => {
      // A contextual protocol-level label must not displace the compound label.
      const compound = group.identity.compoundId !== null && event.metadata?.compoundId === group.identity.compoundId
      const value = compound ? event.metadata?.compoundName : group.identity.compoundId === null ? event.metadata?.protocolName : null
      return typeof value === 'string' && value.trim() ? [value.trim()] : []
    }).sort()
    return { key: group.key, identity: group.identity, scope: treatmentScope(group.identity),
      label: labels[0] ?? (group.identity.compoundId === null ? 'Recorded protocol' : 'Recorded compound'),
      eventIds: [...new Set(group.items.map(event => event.id))].sort() }
  })
}

/** Build once from the full collection, then use with Array.filter. Null means
 * All treatments; unknown identities match nothing, not an implicit All. */
export function timelineTreatmentPredicate(events: readonly TimelineEvent[], selected: TreatmentIdentity | null) {
  const index = treatmentCompoundIndex(events.flatMap(event => { const identity = timelineTreatmentIdentity(event); return identity ? [identity] : [] }))
  return (event: TimelineEvent): boolean => {
    if (selected === null) return true
    const identity = timelineTreatmentIdentity(event)
    return identity !== null && matchesTreatmentIdentity(identity, selected, index)
  }
}
