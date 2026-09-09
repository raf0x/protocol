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
