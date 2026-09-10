import { compareLatest, statusIsFlagged } from '../biomarkerIntelligence'
import { biomarkerHistories, labReference, labValue } from '../labs'
import { contextAtDate, overlayMarkers } from '../protocolOverlay'
import type { AnalystSourceData } from '../analyst/evidence'
import type { DoctorReport, ReportRange } from './types'

const dayDistance = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000)
export function reportStartDate(range: ReportRange, today: string) {
  if (range === 'all') return null
  const source = new Date(`${today}T12:00:00Z`), months = Number.parseInt(range)
  const targetMonth = source.getUTCMonth() - months, year = source.getUTCFullYear() + Math.floor(targetMonth / 12), month = ((targetMonth % 12) + 12) % 12
  const lastDay = new Date(Date.UTC(year, month + 1, 0, 12)).getUTCDate()
  const date = new Date(Date.UTC(year, month, Math.min(source.getUTCDate(), lastDay), 12))
  return date.toISOString().slice(0, 10)
}
export function filterReportSource(data: AnalystSourceData, range: ReportRange, today: string): AnalystSourceData {
  const start = reportStartDate(range, today), inRange = (date: string) => (!start || date.slice(0, 10) >= start) && date.slice(0, 10) <= today
  return { protocols: data.protocols, panels: data.panels.filter(panel => inRange(panel.test_date)),
    protocolEvents: data.protocolEvents.filter(event => inRange(event.date)), journal: data.journal.filter(entry => inRange(entry.date)) }
}
const periodLabel = (range: ReportRange, start: string | null, today: string) => range === 'all' ? `All recorded history through ${today}` : `${start} through ${today}`

export function buildDoctorReport(input: AnalystSourceData, range: ReportRange, today: string): DoctorReport {
  const data = filterReportSource(input, range, today), start = reportStartDate(range, today)
  const currentProtocols = data.protocols.filter(protocol => protocol.status === 'active').flatMap(protocol => contextAtDate(protocol, today, input.protocolEvents).map(state => ({
    name: state.compoundName, dose: state.confirmed ? state.dose : 'Dose not confirmed', frequency: state.frequency, route: state.route,
    startDate: protocol.start_date?.slice(0, 10) ?? null, status: 'Active', verified: state.confirmed,
  }))).sort((a, b) => a.name.localeCompare(b.name))

  const rawEvents = new Map(input.protocolEvents.map(event => [`event:${event.id}`, event]))
  const protocolHistory = overlayMarkers(data.protocols, data.protocolEvents).filter(marker => (!start || marker.date >= start) && marker.date <= today).map(marker => {
    const source = rawEvents.get(marker.id), structured = source?.metadata?.version === 1
    return { date: marker.date, title: marker.title, detail: marker.description, confidence: structured ? 'high' as const : source ? 'low' as const : 'medium' as const,
      source: structured ? 'Structured protocol event' : source ? 'Legacy protocol event' : 'Saved protocol or phase date' }
  }).sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title)).slice(0, 40)

  const panels = [...data.panels].sort((a, b) => b.test_date.localeCompare(a.test_date) || a.id.localeCompare(b.id))
  const labPanels = panels.map(panel => ({ date: panel.test_date, name: panel.panel_name || 'Lab panel', provider: panel.provider, resultCount: panel.results.length }))
  const highlightedResults = panels.flatMap(panel => panel.results.filter(result => statusIsFlagged(result.status)).map(result => ({
    date: panel.test_date, name: result.biomarker_name, value: labValue(result), reference: labReference(result), status: result.status,
  }))).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name)).slice(0, 24)
  const histories = biomarkerHistories(panels)
  const trends = histories.flatMap(history => history.units.map(group => {
    const comparison = compareLatest(group.observations)
    return comparison ? { name: history.name, unit: group.unit, latestDate: comparison.latest.date, previousDate: comparison.previous.date,
      latest: comparison.latest.result.value!, previous: comparison.previous.result.value!, delta: comparison.delta, percent: comparison.percent,
      direction: comparison.direction, flagged: statusIsFlagged(comparison.latest.result.status) } : null
  }).filter((item): item is NonNullable<typeof item> => Boolean(item))).sort((a, b) => Number(b.flagged) - Number(a.flagged)
    || Math.abs(b.percent ?? 0) - Math.abs(a.percent ?? 0) || b.latestDate.localeCompare(a.latestDate) || a.name.localeCompare(b.name)).slice(0, 12)

  const weights = data.journal.filter(entry => entry.weight != null && Number.isFinite(entry.weight)).sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  const weight = weights.length ? { earliestDate: weights[0].date, earliest: weights[0].weight!, latestDate: weights.at(-1)!.date,
    latest: weights.at(-1)!.weight!, delta: weights.at(-1)!.weight! - weights[0].weight!, points: weights.map(entry => ({ date: entry.date, value: entry.weight! })) } : null
  const journalRows = data.journal.filter(entry => [entry.mood, entry.energy, entry.sleep, entry.hunger].some(value => value != null && Number.isFinite(value)))
  const metric = (key: 'mood' | 'energy' | 'sleep' | 'hunger', label: string, unit: string) => {
    const values = journalRows.map(row => row[key]).filter((value): value is number => value != null && Number.isFinite(value))
    return values.length ? { label, value: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)), unit } : null
  }
  const journal = journalRows.length ? { entryCount: journalRows.length, firstDate: journalRows.map(row => row.date).sort()[0], lastDate: journalRows.map(row => row.date).sort().at(-1)!,
    averages: [metric('mood', 'Mood', '/5'), metric('energy', 'Energy', '/5'), metric('sleep', 'Sleep', ' hours'), metric('hunger', 'Hunger', '/5')].filter((item): item is NonNullable<typeof item> => Boolean(item)) } : null

  const markers = overlayMarkers(data.protocols, data.protocolEvents)
  const protocolLabContext = panels.flatMap(panel => markers.filter(marker => Math.abs(dayDistance(marker.date, panel.test_date)) <= 30).map(marker => {
    const days = dayDistance(marker.date, panel.test_date)
    return { labDate: panel.test_date, panel: panel.panel_name || 'Lab panel', eventDate: marker.date, event: marker.title,
      timing: days === 0 ? 'Recorded on the lab date' : days > 0 ? `Recorded ${days} days before the lab` : `Recorded ${Math.abs(days)} days after the lab` }
  })).sort((a, b) => b.labDate.localeCompare(a.labDate) || Math.abs(dayDistance(a.eventDate, a.labDate)) - Math.abs(dayDistance(b.eventDate, b.labDate))).slice(0, 16)

  const limitations: string[] = []
  const legacy = data.protocolEvents.filter(event => event.metadata?.version !== 1).length
  if (legacy) limitations.push(`${legacy} protocol ${legacy === 1 ? 'event is' : 'events are'} legacy or unstructured; exact historical dosing may not be verifiable.`)
  const missingRanges = panels.flatMap(panel => panel.results).filter(result => result.reference_low == null && result.reference_high == null && !result.reference_text).length
  if (missingRanges) limitations.push(`${missingRanges} lab ${missingRanges === 1 ? 'result has' : 'results have'} no supplied reference range. No external range was added.`)
  const mixedUnits = histories.filter(history => history.units.length > 1).length
  if (mixedUnits) limitations.push(`${mixedUnits} biomarker ${mixedUnits === 1 ? 'history contains' : 'histories contain'} different units and was not automatically compared.`)
  const singleReadings = histories.filter(history => history.units.every(group => group.observations.length < 2)).length
  if (singleReadings) limitations.push(`${singleReadings} biomarker ${singleReadings === 1 ? 'has' : 'groups have'} only one recorded reading in this period.`)
  const unverified = currentProtocols.filter(protocol => !protocol.verified).length
  if (unverified) limitations.push(`${unverified} active protocol ${unverified === 1 ? 'dose is' : 'doses are'} not confirmed in structured dosing data.`)
  if (!panels.length) limitations.push('No lab panels are recorded in the selected period.')
  if (!journal) limitations.push('Structured journal signals are sparse or unavailable in the selected period.')
  if (range === 'all' && (input.protocolEvents.length >= 1000 || input.journal.length >= 1000 || input.protocols.length >= 250)) limitations.push('The account reached a report loading limit. The oldest protocol or journal history may not be included.')

  return { generatedAt: new Date().toISOString(), asOfDate: today, range, periodLabel: periodLabel(range, start, today), currentProtocols,
    protocolHistory, labPanels, highlightedResults, trends, weight, journal, protocolLabContext, limitations }
}
