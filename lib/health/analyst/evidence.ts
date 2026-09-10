import { compareLatest, statusIsFlagged } from '../biomarkerIntelligence'
import { biomarkerHistories, labValue, type LabPanel } from '../labs'
import { contextAtDate, type OverlayProtocolEvent } from '../protocolOverlay'
import type { LibraryProtocol } from '../protocolPresentation'
import type { JournalEntryRow } from '../timeline'
import type { AnalystEvidence, AnalystIntent, ContextFact, HealthAnalystContext } from './types'

export type AnalystSourceData = {
  panels: LabPanel[]
  protocols: LibraryProtocol[]
  protocolEvents: OverlayProtocolEvent[]
  journal: JournalEntryRow[]
}

export function classifyAnalystIntent(question: string): AnalystIntent {
  const value = question.toLowerCase()
  if (/since (my )?last lab|last labs|newly measured|missing biomarker/.test(value)) return 'since_last_labs'
  if (/current|health picture|snapshot|right now|today/.test(value)) return 'current_snapshot'
  if (/protocol|dose|phase|medication|around.*(change|update)/.test(value)) return 'protocol_context'
  if (/changed the most|largest (recorded )?change|moving the most|biggest change/.test(value)) return 'largest_changes'
  if (/missing|uncertain|confidence|need more|not enough/.test(value)) return 'missing_data'
  return 'general'
}

const dayDistance = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000)
const fact = (text: string, ...evidenceIds: string[]): ContextFact => ({ text, evidenceIds })
const evidenceId = (type: string, id: string) => `${type}:${id}`

function labEvidence(panel: LabPanel, result: LabPanel['results'][number]): AnalystEvidence {
  const range = result.reference_low != null || result.reference_high != null || result.reference_text
    ? ` Supplied reference: ${result.reference_low ?? ''}${result.reference_low != null && result.reference_high != null ? ' to ' : ''}${result.reference_high ?? ''}${result.reference_text ? ` ${result.reference_text}` : ''}.`
    : ' No reference range was supplied.'
  return { id: evidenceId('lab', result.id), type: 'lab_result', date: panel.test_date, title: result.biomarker_name,
    detail: `${labValue(result)}. Stored status: ${result.status}.${range}`, confidence: 'high', sourceLabel: panel.panel_name || panel.provider || 'Lab panel' }
}

function comparableEvidence(panels: LabPanel[]) {
  const evidence: AnalystEvidence[] = [], facts: ContextFact[] = []
  for (const history of biomarkerHistories(panels)) for (const group of history.units) {
    const comparison = compareLatest(group.observations)
    if (!comparison) continue
    const id = evidenceId('comparison', `${comparison.previous.result.id}:${comparison.latest.result.id}`)
    const days = dayDistance(comparison.previous.date, comparison.latest.date)
    const percent = comparison.percent == null ? '' : `, ${comparison.percent > 0 ? '+' : ''}${comparison.percent.toFixed(1)}%`
    const detail = `${comparison.previous.result.value} ${group.unit} on ${comparison.previous.date} to ${comparison.latest.result.value} ${group.unit} on ${comparison.latest.date}: ${comparison.delta > 0 ? '+' : ''}${Number(comparison.delta.toPrecision(6))} ${group.unit}${percent}, ${days} days apart.`
    evidence.push({ id, type: 'lab_comparison', date: comparison.latest.date, title: `${history.name}: ${comparison.direction}`,
      detail, confidence: 'high', sourceLabel: 'Comparable lab results' })
    facts.push(fact(`${history.name} ${comparison.direction}: ${detail}`, id, evidenceId('lab', comparison.previous.result.id), evidenceId('lab', comparison.latest.result.id)))
  }
  return { evidence, facts }
}

function eventEvidence(events: OverlayProtocolEvent[], anchorDate: string | null, fromDate: string | null) {
  const evidence: AnalystEvidence[] = [], facts: ContextFact[] = []
  for (const event of events) {
    const date = event.date.slice(0, 10)
    if (anchorDate && date > anchorDate) continue
    if (fromDate && date < fromDate) continue
    const structured = event.metadata?.version === 1
    const id = evidenceId('protocol-event', event.id)
    const metadata = event.metadata ?? {}
    const dose = typeof metadata.newDose === 'number' && typeof metadata.newUnit === 'string' ? ` New recorded dose: ${metadata.newDose} ${metadata.newUnit}.` : ''
    const timing = anchorDate ? dayDistance(date, anchorDate) : null
    const timingText = timing == null ? '' : timing === 0 ? ' On the lab date.' : ` ${timing} days before the lab date.`
    const detail = `${(event.event_type ?? 'protocol update').replaceAll('_', ' ')}.${dose}${timingText}${event.description ? ` ${event.description}` : ''}`.trim()
    evidence.push({ id, type: 'protocol_event', date, title: (event.event_type ?? 'Protocol update').replaceAll('_', ' '), detail,
      confidence: structured ? 'high' : 'low', sourceLabel: structured ? 'Structured protocol history' : 'Legacy protocol history' })
    facts.push(fact(`${structured ? 'Structured history confirms' : 'Legacy history records'} a protocol event on ${date}.${timingText}`, id))
  }
  return { evidence, facts }
}

function protocolStateEvidence(protocols: LibraryProtocol[], events: OverlayProtocolEvent[], date: string) {
  const evidence: AnalystEvidence[] = [], facts: ContextFact[] = []
  for (const protocol of protocols) for (const state of contextAtDate(protocol, date, events)) {
    const id = evidenceId('protocol-state', `${protocol.id}:${state.compoundId}:${date}`)
    const detail = `${state.dose}${state.frequency ? `, ${state.frequency}` : ''}${state.route ? `, ${state.route}` : ''}${state.week ? `, week ${state.week}` : ''}.${state.issue ? ` ${state.issue}.` : ''}`
    evidence.push({ id, type: 'protocol_state', date, title: state.compoundName, detail,
      confidence: state.confirmed ? 'high' : 'low', sourceLabel: state.confirmed ? 'Confirmed protocol state' : 'Incomplete protocol history' })
    facts.push(fact(`${state.compoundName} at ${date}: ${detail}`, id))
  }
  return { evidence, facts }
}

function weightEvidence(entries: JournalEntryRow[]) {
  const rows = entries.filter(row => row.weight != null && Number.isFinite(row.weight)).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id)).slice(0, 2)
  if (!rows.length) return { evidence: [] as AnalystEvidence[], facts: [] as ContextFact[] }
  const latest = rows[0], id = evidenceId('weight', latest.id)
  const delta = rows[1] ? latest.weight! - rows[1].weight! : null
  const detail = `${latest.weight} lb on ${latest.date}${delta == null ? '' : `; ${delta > 0 ? '+' : ''}${Number(delta.toPrecision(5))} lb since ${rows[1].date}`}.`
  return { evidence: [{ id, type: 'weight' as const, date: latest.date, title: 'Latest recorded weight', detail, confidence: rows[1] ? 'high' as const : 'medium' as const, sourceLabel: 'Journal weight' }], facts: [fact(detail, id)] }
}

function journalEvidence(entries: JournalEntryRow[]) {
  const evidence: AnalystEvidence[] = [], facts: ContextFact[] = []
  for (const row of [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7)) {
    const metrics = [row.energy != null ? `energy ${row.energy}/5` : '', row.mood != null ? `mood ${row.mood}/5` : '', row.sleep != null ? `sleep ${row.sleep}h` : '', row.hunger != null ? `hunger ${row.hunger}/5` : ''].filter(Boolean)
    if (!metrics.length) continue
    const id = evidenceId('journal', row.id), detail = `${metrics.join(', ')} on ${row.date}.`
    evidence.push({ id, type: 'journal_signal', date: row.date, title: 'Recorded check-in', detail, confidence: 'medium', sourceLabel: 'Journal check-in' })
    facts.push(fact(detail, id))
  }
  return { evidence, facts }
}

function unique<T extends { id: string }>(items: T[]) { return [...new Map(items.map(item => [item.id, item])).values()] }

export function buildAnalystContext(data: AnalystSourceData, question: string, today: string): HealthAnalystContext {
  const intent = classifyAnalystIntent(question)
  const panels = [...data.panels].sort((a, b) => b.test_date.localeCompare(a.test_date) || a.id.localeCompare(b.id))
  const latest = panels[0] ?? null, previous = panels[1] ?? null
  const labRows = (intent === 'current_snapshot' ? latest ? [latest] : [] : panels.slice(0, 2)).flatMap(panel => panel.results.map(result => labEvidence(panel, result)))
  const comparisons = comparableEvidence(panels)
  const eventAnchor = ['since_last_labs', 'protocol_context', 'largest_changes'].includes(intent) ? latest?.test_date ?? null : null
  const events = eventEvidence(data.protocolEvents, eventAnchor,
    intent === 'since_last_labs' && previous ? previous.test_date : intent === 'largest_changes' ? panels.at(-1)?.test_date ?? null : null)
  const states = protocolStateEvidence(data.protocols, data.protocolEvents, intent === 'since_last_labs' && latest ? latest.test_date : today)
  const weights = weightEvidence(data.journal), journals = journalEvidence(data.journal)
  const gaps: ContextFact[] = []
  if (!latest) gaps.push(fact('No lab panels are recorded yet.'))
  else if (!previous) gaps.push(fact('Only one lab panel is recorded, so a panel-to-panel comparison is not available.'))
  const histories = biomarkerHistories(panels)
  const mixed = histories.filter(history => history.units.length > 1)
  if (mixed.length) gaps.push(fact(`${mixed.length} biomarker histories contain different units and are kept as separate series.`))
  const noRange = latest?.results.filter(result => result.reference_low == null && result.reference_high == null && !result.reference_text).length ?? 0
  if (noRange) gaps.push(fact(`${noRange} latest-panel results have no supplied reference range; no range was invented.`))
  const legacy = data.protocolEvents.filter(event => event.metadata?.version !== 1).length
  if (legacy) gaps.push(fact(`${legacy} loaded protocol events are legacy or unstructured, so exact historical dosing cannot always be verified.`))
  if (!weights.evidence.length) gaps.push(fact('No recorded weight is available for this analysis.'))
  if (!journals.evidence.length) gaps.push(fact('Recent structured journal signals are sparse or unavailable.'))

  const latestIds = new Set(latest?.results.map(result => evidenceId('lab', result.id)) ?? [])
  const previousIds = new Set(previous?.results.map(result => evidenceId('lab', result.id)) ?? [])
  const flagged = labRows.filter(item => item.type === 'lab_result' && /Stored status: (high|low|abnormal)/.test(item.detail))
  const rankedComparisons = [...comparisons.evidence].sort((a, b) => {
    const number = (value: AnalystEvidence) => Math.abs(Number(value.detail.match(/([-+]?\d+(?:\.\d+)?)%/)?.[1] ?? 0))
    return number(b) - number(a) || (b.date ?? '').localeCompare(a.date ?? '')
  })
  let selected: AnalystEvidence[]
  if (intent === 'since_last_labs') selected = [...flagged, ...rankedComparisons, ...labRows.filter(row => latestIds.has(row.id) || previousIds.has(row.id)), ...events.evidence, ...weights.evidence]
  else if (intent === 'largest_changes') selected = [...rankedComparisons, ...flagged, ...events.evidence]
  else if (intent === 'protocol_context') selected = [...events.evidence, ...states.evidence, ...rankedComparisons.slice(0, 8), ...flagged]
  else if (intent === 'missing_data') selected = [...labRows.slice(0, 12), ...states.evidence, ...events.evidence.slice(0, 12)]
  else selected = [...flagged, ...rankedComparisons, ...labRows, ...states.evidence, ...events.evidence, ...weights.evidence, ...journals.evidence]
  selected = unique(selected).slice(0, 40)
  const selectedIds = new Set(selected.map(item => item.id))
  const facts = [...comparisons.facts, ...events.facts, ...states.facts, ...weights.facts, ...journals.facts]
    .map(item => ({ ...item, evidenceIds: item.evidenceIds.filter(id => selectedIds.has(id)) })).filter(item => item.evidenceIds.length).slice(0, 30)
  if (latest && previous) {
    const latestHistory = biomarkerHistories([latest]), priorHistory = biomarkerHistories([previous])
    const latestKeys = new Set(latestHistory.map(item => item.key)), priorKeys = new Set(priorHistory.map(item => item.key))
    const newly = latestHistory.filter(item => !priorKeys.has(item.key)), missing = priorHistory.filter(item => !latestKeys.has(item.key))
    const selectedPanelIds = selected.filter(item => latestIds.has(item.id) || previousIds.has(item.id)).map(item => item.id)
    facts.unshift(fact(`Latest panel ${latest.test_date} versus prior panel ${previous.test_date}: ${newly.length} newly measured biomarker groups${newly.length ? ` (${newly.slice(0, 8).map(item => item.name).join(', ')})` : ''} and ${missing.length} previously measured groups absent from the latest panel${missing.length ? ` (${missing.slice(0, 8).map(item => item.name).join(', ')})` : ''}.`, ...selectedPanelIds))
    for (const history of histories) for (const group of history.units) {
      const observations = [...group.observations].sort((a, b) => b.date.localeCompare(a.date))
      const current = observations.find(item => item.date === latest.test_date), prior = observations.find(item => item.date === previous.test_date)
      if (!current || !prior) continue
      if (statusIsFlagged(current.result.status) && !statusIsFlagged(prior.result.status)) facts.unshift(fact(`${history.name} is newly outside its supplied range or stored lab flag on the latest panel.`, evidenceId('lab', current.result.id), evidenceId('lab', prior.result.id)))
      if (current.result.status === 'normal' && statusIsFlagged(prior.result.status)) facts.unshift(fact(`${history.name} returned to the supplied in-range status on the latest panel.`, evidenceId('lab', current.result.id), evidenceId('lab', prior.result.id)))
    }
  }
  // The model needs stable citation handles, not database identifiers. Keep the
  // evidence payload inspectable while replacing source IDs with request-local IDs.
  const idMap = new Map(selected.map((item, index) => [item.id, `E${index + 1}`]))
  const mappedEvidence = selected.map(item => ({ ...item, id: idMap.get(item.id)! }))
  const mapFacts = (items: ContextFact[]) => items.map(item => ({ ...item,
    evidenceIds: item.evidenceIds.map(id => idMap.get(id)).filter((id): id is string => Boolean(id)),
  }))
  return { intent, question, asOfDate: today,
    scope: `${selected.length} selected evidence items from ${panels.length} lab panels, ${data.protocols.length} protocols, structured/legacy protocol history, and recent numeric journal signals.`,
    facts: mapFacts(facts.slice(0, 30)), evidence: mappedEvidence, gaps: mapFacts(gaps.slice(0, 10)) }
}
