import { convertWeight, type WeightUnit } from '../weightUtils'
import { isCalendarDate, localCalendarDate } from './protocolDates'
import { formatTimelineDate, type JournalEntryRow, type TimelineEvent } from './timeline'
import { timelineFilterUrl, timelineTreatmentIdentity } from './timelinePresentation'
import { treatmentIdentityKey } from './protocolIdentity'

export const healthRanges = ['7D', '30D', '90D', 'All'] as const
export type HealthRange = typeof healthRanges[number]
export type CommandCenterSource = { journal: JournalEntryRow[]; events: TimelineEvent[]; weightUnit: WeightUnit }
export type TrendPoint = { date: string; time: number; value: number | null; endDate?: string; observationCount?: number }
export type TrendObservation = { id: string; date: string; value: number; endDate?: string; count?: number }
export type HealthTrend = {
  name: string; unit: string; points: TrendPoint[]; average: number | null
  domain: [number, number]; count: number; chartPoints?: TrendPoint[]
  observations?: TrendObservation[]; xDomain?: [number, number]
  weekly?: { qualifyingWeeks: number; totalWeeks: number }
}
export type HealthMetric = { name: string; value: string; unit: string; detail: string }
export type SignalState = 'none' | 'single' | 'sparse' | 'trend'
export type HealthSignal = HealthTrend & {
  state: SignalState; recordedDays: number; coverage: number; weeks: number; longestRun: number
  chartPoints: TrendPoint[]; nextThreshold: string; firstObservation: { date: string; value: number } | null
}
export type BriefingItem = { id: string; kind: 'measured' | 'confidence' | 'activity'; text: string; href?: string }
export type CommandCenterModel = ReturnType<typeof commandCenterModel>

/** Display qualification only, never a medical inference. All counts use distinct
 * local dates. Short daily runs remain inspectable but are not chart geometry.
 * All uses recorded-observation averages in local Monday-based weeks instead.
 */
export const signalPolicy = {
  '7D': { days: 5, run: 3, weeks: 0 },
  '30D': { days: 12, run: 4, weeks: 0 },
  '90D': { days: 30, run: 3, weeks: 6 },
  All: { days: 0, run: 0, weeks: 4 },
} as const
function signalCoverage(points: TrendPoint[], count: number, range: HealthRange, today: string, weekly?: { points: TrendPoint[]; qualifyingWeeks: number; totalWeeks: number }) {
  const dates = points.filter(point => point.value !== null).map(point => point.date)
  const policy = signalPolicy[range]
  const span = range === 'All' && dates.length ? Math.round((calendarTime(today) - calendarTime(dates[0])) / 86400000) + 1 : range === 'All' ? 1 : Number(range.slice(0, -1))
  if (range === 'All' && weekly) {
    let run = 0, longestWeeklyRun = 0
    for (const point of weekly.points) {
      run = point.value === null ? 0 : run + 1
      longestWeeklyRun = Math.max(longestWeeklyRun, run)
    }
    const weeklyCoverage = weekly.totalWeeks ? weekly.qualifyingWeeks / weekly.totalWeeks : 0
    const qualifies = weekly.qualifyingWeeks >= policy.weeks && weeklyCoverage >= 0.5 && longestWeeklyRun >= 4
    const state: SignalState = count === 0 ? 'none' : count === 1 ? 'single' : qualifies ? 'trend' : 'sparse'
    const additional = Math.max(0, policy.weeks - weekly.qualifyingWeeks)
    const needed: string[] = []
    if (additional) needed.push(additional + ' additional qualifying ' + (additional === 1 ? 'week' : 'weeks'))
    if (weeklyCoverage < 0.5) needed.push('at least 50% qualifying-week coverage')
    if (longestWeeklyRun < 4) needed.push('a run of 4 consecutive qualifying weeks')
    return { state, recordedDays: dates.length, coverage: dates.length / span,
      weeks: new Set(dates.map(mondayForHealthDate)).size, longestRun: longestWeeklyRun,
      chartPoints: state === 'trend' ? weekly.points : weekly.points.map(point => ({ ...point, value: null })),
      nextThreshold: needed.join(' and ') }
  }
  const runs: string[][] = []
  for (const date of dates) {
    const last = runs.at(-1)
    if (last && shiftHealthDate(last.at(-1)!, 1) === date) last.push(date)
    else runs.push([date])
  }
  const longestRun = Math.max(0, ...runs.map(run => run.length))
  const drawable = new Set(runs.filter(run => run.length >= policy.run).flat())
  const weeks = new Set(dates.map(mondayForHealthDate)).size
  const qualified = dates.length >= policy.days && weeks >= policy.weeks && longestRun >= policy.run
  const state: SignalState = count === 0 ? 'none' : count === 1 ? 'single' : qualified ? 'trend' : 'sparse'
  const needed: string[] = []
  const additional = Math.max(0, policy.days - dates.length)
  if (additional) needed.push(additional + ' additional recorded ' + (additional === 1 ? 'day' : 'days'))
  if (longestRun < policy.run) needed.push('a sequence of ' + policy.run + ' consecutive days')
  if (weeks < policy.weeks) needed.push('observations in ' + (policy.weeks - weeks) + ' additional local ' + (policy.weeks - weeks === 1 ? 'week' : 'weeks'))
  return { state, recordedDays: dates.length, coverage: dates.length / span, weeks, longestRun,
    chartPoints: points.map(point => ({ ...point, value: qualified && drawable.has(point.date) ? point.value : null })),
    nextThreshold: needed.length ? needed.join(' and ') : '' }
}

export function healthDate(value: string): string | null {
  if (isCalendarDate(value)) return value
  // Only actual timestamps use Date parsing. Date-only values remain local dates.
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !isCalendarDate(value.slice(0, 10))) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? localCalendarDate(parsed) : null
}
export function calendarTime(date: string) { return new Date(`${date}T12:00:00`).getTime() }
export function shiftHealthDate(date: string, days: number) {
  const value = new Date(`${date}T12:00:00`)
  value.setDate(value.getDate() + days)
  return localCalendarDate(value)
}
export function mondayForHealthDate(date: string) {
  return shiftHealthDate(date, -((new Date(date + 'T12:00:00').getDay() + 6) % 7))
}
export function healthNumber(value: number) { return value.toFixed(1) }
export function signedHealthNumber(value: number) {
  const rounded = Number(value.toFixed(1))
  return `${rounded > 0 ? '+' : ''}${healthNumber(rounded)}`
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const score = (value: unknown): value is number => finite(value) && Number.isInteger(value) && value >= 1 && value <= 5
const sleepValue = (value: unknown): value is number => finite(value) && value >= 0 && value <= 24
const weightValue = (value: unknown): value is number => finite(value) && value > 0 && value < 1e9
const average = (values: number[]) => values.length ? values.reduce((total, value) => total + value / values.length, 0) : null

/** One shared calendar window and typed view model; no health inference or causal analysis. */
export function commandCenterModel(source: CommandCenterSource, range: HealthRange, today: string) {
  if (!isCalendarDate(today)) throw new Error('A local calendar date is required')
  const days = range === 'All' ? null : Number(range.slice(0, -1))
  const boundary = days === null ? null : shiftHealthDate(today, 1 - days)
  const inRange = (date: string) => date <= today && (!boundary || date >= boundary)
  const allEntries = [...new Map(source.journal.map(row => [row.id, row])).values()].flatMap(row => {
    const date = healthDate(row.date)
    return date && date <= today ? [{ ...row, date }] : []
  }).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const entries = allEntries.filter(row => inRange(row.date))
  const events = source.events.flatMap(event => {
    const date = healthDate(event.date)
    if (event.category !== 'Protocol' || !date || !inRange(date)) return []
    const identity = timelineTreatmentIdentity(event)
    return [{ ...event, date, dateLabel: formatTimelineDate(date),
      scope: identity?.compoundId ? 'Compound change' : 'Protocol change',
      href: identity ? timelineFilterUrl('', 'Protocols', treatmentIdentityKey(identity)) : null }]
  }).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
  const recordedDays = new Set(entries.filter(row => weightValue(row.weight) || score(row.mood) || score(row.energy)
    || score(row.hunger) || sleepValue(row.sleep) || Boolean(row.notes?.trim())).map(row => row.date)).size
  const byDay = new Map<string, typeof entries>()
  for (const row of entries) { const bucket = byDay.get(row.date) ?? []; bucket.push(row); byDay.set(row.date, bucket) }
  let ambiguousWeights = false
  const weights: TrendPoint[] = []
  for (const [date, rows] of byDay) {
    const values = [...new Set(rows.map(row => row.weight).filter(weightValue))]
    // No invented ordering for conflicting same-day weights.
    if (values.length > 1) ambiguousWeights = true
    if (values.length === 1) weights.push({ date, time: calendarTime(date), value: convertWeight(values[0], 'lbs', source.weightUnit) })
  }
  const weightValues = weights.map(point => point.value!)
  const first = weightValues[0], latest = weightValues.at(-1) ?? null
  const delta = weightValues.length >= 2 ? latest! - first : null
  const low = weightValues.length ? Math.min(...weightValues) : 0
  const high = weightValues.length ? Math.max(...weightValues) : 1
  const padding = Math.max((high - low) * 0.15, source.weightUnit === 'kg' ? 0.5 : 1)
  function signal(key: 'mood' | 'energy' | 'sleep', name: string, signalEntries = entries, signalDays = byDay, end = today): HealthSignal {
    const valid = key === 'sleep' ? sleepValue : score
    const values = signalEntries.map(row => row[key]).filter(valid)
    const points: TrendPoint[] = []
    for (const [date, rows] of signalDays) {
      const dayValues = rows.map(row => row[key]).filter(valid)
      if (!dayValues.length) continue
      const previous = points.at(-1)
      if (previous && shiftHealthDate(previous.date, 1) < date) {
        const gap = shiftHealthDate(previous.date, 1)
        points.push({ date: gap, time: calendarTime(gap), value: null })
      }
      points.push({ date, time: calendarTime(date), value: average(dayValues) })
    }
    const weeklyBuckets = new Map<string, { dates: Set<string>; values: number[] }>()
    for (const row of signalEntries) {
      if (!valid(row[key])) continue
      const week = mondayForHealthDate(row.date)
      const bucket = weeklyBuckets.get(week) ?? { dates: new Set<string>(), values: [] }
      bucket.dates.add(row.date); bucket.values.push(row[key]!); weeklyBuckets.set(week, bucket)
    }
    const weeklyPoints: TrendPoint[] = []
    const weeklyStarts = [...weeklyBuckets.keys()].sort()
    if (weeklyStarts.length) {
      const finalWeek = range === 'All' ? mondayForHealthDate(end) : weeklyStarts.at(-1)!
      for (let week = weeklyStarts[0]; week <= finalWeek; week = shiftHealthDate(week, 7)) {
        const bucket = weeklyBuckets.get(week)
        const qualifies = Boolean(bucket && bucket.dates.size >= 2)
        weeklyPoints.push({ date: week, endDate: shiftHealthDate(week, 6), time: calendarTime(week),
          value: qualifies ? average(bucket!.values) : null, observationCount: qualifies ? bucket!.values.length : undefined })
      }
    }
    const weekly = { points: weeklyPoints, qualifyingWeeks: weeklyPoints.filter(point => point.value !== null).length, totalWeeks: weeklyPoints.length }
    const coverage = signalCoverage(points, values.length, range, end, weekly)
    const first = signalEntries.find(row => valid(row[key]))
    const rawObservations: TrendObservation[] = signalEntries.flatMap(row => valid(row[key]) ? [{ id: row.id, date: row.date, value: row[key]! }] : [])
    const observations = range === 'All' && coverage.state === 'trend'
      ? weeklyPoints.flatMap(point => point.value === null ? [] : [{ id: `week-${point.date}`, date: point.date, endDate: point.endDate, value: point.value, count: point.observationCount }])
      : rawObservations
    return { name, unit: key === 'sleep' ? 'hours' : '/5', points, average: average(values), count: values.length,
      observations, ...coverage, weekly: range === 'All' ? { qualifyingWeeks: weekly.qualifyingWeeks, totalWeeks: weekly.totalWeeks } : undefined,
      firstObservation: first ? { date: first.date, value: first[key]! } : null,
      domain: key === 'sleep' ? [0, Math.max(8, Math.ceil(Math.max(0, ...values)) + 1)] : [1, 5] }
  }
  const signals = [signal('mood', 'Mood'), signal('energy', 'Energy'), signal('sleep', 'Sleep')]
  const [mood, , sleep] = signals
  const checkInDays = new Set(entries.filter(row => score(row.mood) || score(row.energy) || sleepValue(row.sleep)).map(row => row.date)).size
  const signalsHaveTrend = signals.some(signal => signal.state === 'trend')
  const entryScope = (count: number) => count ? `Average across ${count} ${count === 1 ? 'entry' : 'entries'}` : 'No recorded data'
  const metrics: HealthMetric[] = [
    { name: 'Logging', value: days ? `${recordedDays}/${days}` : String(recordedDays), unit: '', detail: days ? 'Days recorded' : 'Recorded days · all time' },
    { name: 'Weight', value: delta === null ? 'Not enough data' : signedHealthNumber(delta), unit: delta === null ? '' : source.weightUnit, detail: 'Change in this period' },
    { name: 'Sleep', value: sleep.average === null ? 'No data' : healthNumber(sleep.average), unit: sleep.average === null ? '' : 'hours', detail: entryScope(sleep.count) },
    { name: 'Mood', value: mood.average === null ? 'No data' : healthNumber(mood.average), unit: mood.average === null ? '' : '/5', detail: entryScope(mood.count) },
  ]
  const period = days ? `Last ${days} days` : 'All recorded data'
  const headline = recordedDays === 0 ? 'Your overview starts here' : range === 'All' ? 'Your long-term view'
    : recordedDays === days ? (range === '7D' ? 'A consistent week' : 'Consistently recorded') : 'Your recorded picture'
  const summary = recordedDays === 0 ? 'Record a check-in or weight to see your overview.' : [
    days ? `You recorded ${recordedDays} of ${days} days.` : `You recorded ${recordedDays} distinct ${recordedDays === 1 ? 'day' : 'days'}.`,
    sleep.average === null ? '' : `Sleep averaged ${healthNumber(sleep.average)} hours across ${sleep.count} recorded ${sleep.count === 1 ? 'entry' : 'entries'}.`,
    delta === null ? 'Not enough weight data to describe a change.' : `Weight changed ${signedHealthNumber(delta)} ${source.weightUnit}.`,
  ].filter(Boolean).join(' ')
  // One candidate per measured outcome; one confidence item and one aggregate activity item.
  // All has no equivalent preceding unbounded period, so it never makes comparisons.
  const measured: BriefingItem[] = []
  const weightItem: BriefingItem | null = delta === null ? null : {
    id: 'weight', kind: 'measured', text: Number(delta.toFixed(1)) === 0
      ? 'Weight had no net change across this range (' + weights.length + ' recorded days).'
      : 'Weight changed ' + signedHealthNumber(delta) + ' ' + source.weightUnit + ' across ' + weights.length + ' recorded days.',
  }
  if (weightItem && Number(delta!.toFixed(1)) !== 0) measured.push(weightItem)
  if (days && boundary) {
    const previousEnd = shiftHealthDate(boundary, -1), previousStart = shiftHealthDate(boundary, -days)
    const priorEntries = allEntries.filter(row => row.date >= previousStart && row.date <= previousEnd)
    const priorDays = new Map<string, typeof entries>()
    for (const row of priorEntries) { const bucket = priorDays.get(row.date) ?? []; bucket.push(row); priorDays.set(row.date, bucket) }
    for (const [index, key] of (['mood', 'energy', 'sleep'] as const).entries()) {
      const current = signals[index], prior = signal(key, current.name, priorEntries, priorDays, previousEnd)
      if (current.state !== 'trend' || prior.state !== 'trend') continue
      const change = current.average! - prior.average!
      if (Number(change.toFixed(1)) === 0) continue
      measured.push({ id: 'signal-' + key, kind: 'measured', text: current.name + ' averaged ' + healthNumber(current.average!) + (key === 'sleep' ? ' h' : '/5') + ', ' + signedHealthNumber(change) + (key === 'sleep' ? ' h' : ' points') + ' versus the preceding ' + days + ' days (' + current.count + ' vs ' + prior.count + ' recorded entries).' })
    }
  }
  if (!measured.length && weightItem) measured.push(weightItem)
  const briefing: BriefingItem[] = measured.slice(0, 1)
  const limited = signals.filter(item => item.state !== 'trend')
  if (limited.length && recordedDays > 0) {
    const scope = days ? checkInDays + ' of ' + days + ' days' : checkInDays + ' distinct days'
    const limiting = limited[0]
    briefing.push({ id: 'signal-confidence', kind: 'confidence', text: 'Daily signals were recorded on ' + scope + '. ' + (limited.length === 3 ? 'None meets the trend threshold. ' : limited.map(item => item.name).join(', ') + ' lack enough consistent observations for a trend. ') + limiting.name + ' needs ' + limiting.nextThreshold + ' to qualify.' })
  }
  if (events.length) {
    const activity = new Map<string, number>()
    for (const event of events) activity.set(event.date, (activity.get(event.date) ?? 0) + 1)
    const [date, count] = [...activity].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0]
    briefing.push({ id: 'protocol-activity', kind: 'activity', text: events.length + ' protocol ' + (events.length === 1 ? 'change was' : 'changes were') + ' recorded ' + (activity.size === 1 ? 'on ' + formatTimelineDate(date) : 'across ' + activity.size + ' days; ' + count + ' on ' + formatTimelineDate(date)) + '.', href: timelineFilterUrl('', 'Protocols') })
  }
  const recordedDates = [...entries.map(row => row.date), ...events.map(event => event.date)].sort()
  const start = boundary ?? recordedDates[0] ?? today
  return { range, period, days, start, end: today, recordedDays, headline, summary, metrics, signals, events, checkInDays, signalsHaveTrend, briefing,
    weight: { name: 'Weight', unit: source.weightUnit, points: weights, count: weights.length, average: null,
      domain: [weightValues.length ? Math.max(low * 0.5, low - padding) : 0, high + padding] as [number, number], latest, delta, ambiguousWeights,
      xDomain: (weights.length === 1 ? [weights[0].time - 1, weights[0].time + 1]
        : weights.length > 1 ? [weights[0].time, weights.at(-1)!.time]
          : [calendarTime(today) - 1, calendarTime(today) + 1]) as [number, number] },
    xDomain: (start === today ? [calendarTime(today) - 1, calendarTime(today) + 1]
      : [calendarTime(start), calendarTime(today)]) as [number, number] }
}
