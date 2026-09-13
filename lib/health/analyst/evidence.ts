import { guidedAnalystInstruction, guidedAnalystLimits, type GuidedAnalystAction } from './actions'
import { compareLatest, statusIsFlagged } from '../biomarkerIntelligence'
import { biomarkerHistories, labValue, type LabPanel } from '../labs'
import { contextAtDate, type OverlayProtocolEvent } from '../protocolOverlay'
import type { LibraryProtocol } from '../protocolPresentation'
import type { JournalEntryRow } from '../timeline'
import type { AnalystEvidence, AnalystIntent, ContextFact, HealthAnalystContext } from './types'
import { longitudinalAnalystEvidence, longitudinalRegimenEvidence } from '../longitudinal/analyst'
import { labComparisonSummary, labLimitations } from '../labEvidence'
import { deriveCurrentLabFindingSet } from '../labFindingsSummary'
import { findingCandidates, findingSourceIds, projectAnalystFinding, type FindingCandidate } from './findings'

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
    detail: `${labValue(result)}. Stored status: ${result.status}.${range}`, confidence: result.import_confidence ?? 'high', sourceLabel: panel.panel_name || panel.provider || 'Lab panel' }
}

function comparableEvidence(panels: LabPanel[]) {
  const evidence: AnalystEvidence[] = [], facts: ContextFact[] = []
  for (const history of biomarkerHistories(panels)) for (const group of history.units) {
    const comparison = compareLatest(group.observations)
    if (!comparison) continue
    const id = evidenceId('comparison', `${comparison.previous.result.id}:${comparison.latest.result.id}`)
    const days = comparison.evidence.elapsedDays
    const percent = comparison.percent == null ? '' : `, ${comparison.percent > 0 ? '+' : ''}${comparison.percent.toFixed(1)}%`
    const detail = `${comparison.previous.result.value} ${group.unit} on ${comparison.previous.date} to ${comparison.latest.result.value} ${group.unit} on ${comparison.latest.date}: ${comparison.delta > 0 ? '+' : ''}${Number(comparison.delta.toPrecision(6))} ${group.unit}${percent}, ${days} days apart.`
    evidence.push({ id, type: 'lab_comparison', date: comparison.latest.date, title: `${history.name}: ${comparison.direction}`,
      detail, comparison: labComparisonSummary(comparison.evidence),
      confidence: [comparison.evidence.previous, comparison.evidence.current].some(row => row.provenance.confidence === 'low') ? 'low' : 'medium', sourceLabel: 'Same-unit lab arithmetic; assay compatibility unverified' })
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

export function buildAnalystContext(data: AnalystSourceData, question: string, today: string, options: { minimumDate?: string | null; includeDeterministicFindings?: boolean; action?: GuidedAnalystAction } = {}): HealthAnalystContext {
  const guided = options.action
  const intent = guided ?? classifyAnalystIntent(question)
  if (guided) question = guidedAnalystInstruction(guided)
  const limits = guided ? guidedAnalystLimits[guided] : { evidence: 40, findings: 10 }
  const panels = [...data.panels].sort((a, b) => b.test_date.localeCompare(a.test_date) || a.id.localeCompare(b.id))
  const latest = panels[0] ?? null, previous = panels[1] ?? null
  const histories = biomarkerHistories(panels)
  const currentFindings = deriveCurrentLabFindingSet(panels, histories)
  const integrated = options.includeDeterministicFindings === true
  const labRows = (intent === 'current_snapshot' ? latest ? [latest] : [] : panels.slice(0, 2)).flatMap(panel => panel.results.map(result => labEvidence(panel, result)))
  const comparisons = comparableEvidence(panels)
  if (guided) comparisons.evidence = comparisons.evidence.filter(row =>
    currentFindings.state !== 'ambiguous_latest' && row.date === currentFindings.latestDate)
  const eventAnchor = ['since_last_labs', 'protocol_context', 'largest_changes'].includes(intent) ? latest?.test_date ?? null : null
  const intentStart = intent === 'since_last_labs' && previous ? previous.test_date : intent === 'largest_changes' ? panels.at(-1)?.test_date ?? null : null
  const eventStart = [intentStart, options.minimumDate].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null
  const events = eventEvidence(data.protocolEvents, eventAnchor, eventStart)
  const states = intent === 'protocol_context' ? longitudinalRegimenEvidence(data, today)
    : protocolStateEvidence(data.protocols, data.protocolEvents, intent === 'since_last_labs' && latest ? latest.test_date : today)
  const weights = weightEvidence(data.journal), journals = journalEvidence(data.journal)
  const gaps: ContextFact[] = []
  const longitudinal = intent === 'protocol_context' ? longitudinalAnalystEvidence(data, today) : { evidence: [], facts: [], gaps: [] }
  gaps.push(...longitudinal.gaps)
  if (!latest) gaps.push(fact('No lab panels are recorded yet.'))
  else if (!previous) gaps.push(fact('Only one lab panel is recorded, so a panel-to-panel comparison is not available.'))
  else if (latest.test_date === previous.test_date) gaps.push(fact('Multiple panels share the latest test date. Their within-day order is unknown; no chronological panel-to-panel change was inferred.'))
  if (currentFindings.previousPanelAmbiguous) gaps.push(fact('Multiple panels share the previous test date; new/missing panel membership is unknown.'))
  const mixed = histories.filter(history => history.units.length > 1)
  if (mixed.length) gaps.push(fact(`${mixed.length} biomarker histories contain different units and are kept as separate series.`))
  const noRange = latest?.results.filter(result => result.reference_low == null && result.reference_high == null && !result.reference_text).length ?? 0
  if (noRange) gaps.push(fact(`${noRange} latest-panel results have no supplied reference range; no range was invented.`))
  const legacy = data.protocolEvents.filter(event => event.metadata?.version !== 1).length
  if (legacy) gaps.push(fact(`${legacy} loaded protocol events are legacy or unstructured, so exact historical dosing cannot always be verified.`))
  if (!guided && !weights.evidence.length) gaps.push(fact('No recorded weight is available for this analysis.'))
  if (!guided && !journals.evidence.length) gaps.push(fact('Recent structured journal signals are sparse or unavailable.'))

  const latestIds = new Set(latest?.results.map(result => evidenceId('lab', result.id)) ?? [])
  const previousIds = new Set(previous?.results.map(result => evidenceId('lab', result.id)) ?? [])
  const flaggedIds = new Set(panels.flatMap(panel => panel.results.filter(result => statusIsFlagged(result.status)).map(result => evidenceId('lab', result.id))))
  const flagged = labRows.filter(item => flaggedIds.has(item.id))
  const rankedComparisons = [...comparisons.evidence].sort((a, b) => {
    const number = (value: AnalystEvidence) => Math.abs(value.comparison?.percent ?? 0)
    return number(b) - number(a) || (b.date ?? '').localeCompare(a.date ?? '')
  })
  let selected: AnalystEvidence[]
  if (intent === 'since_last_labs') selected = [...flagged, ...rankedComparisons, ...labRows.filter(row => latestIds.has(row.id) || previousIds.has(row.id)), ...events.evidence, ...weights.evidence]
  else if (intent === 'largest_changes') selected = [...rankedComparisons, ...flagged, ...events.evidence]
  else if (intent === 'protocol_context') selected = [...longitudinal.evidence, ...events.evidence, ...states.evidence, ...rankedComparisons.slice(0, 8), ...flagged]
  else if (intent === 'missing_data') selected = [...labRows.slice(0, 12), ...states.evidence, ...events.evidence.slice(0, 12)]
  else selected = [...flagged, ...rankedComparisons, ...labRows, ...states.evidence, ...events.evidence, ...weights.evidence, ...journals.evidence]
  if (guided) {
    if (intent === 'protocol_context') selected = [...longitudinal.evidence.slice(0, 14), ...states.evidence.slice(0, 6)]
    else if (intent === 'largest_changes') selected = rankedComparisons
    else if (intent === 'missing_data') selected = []
    else if (intent === 'current_snapshot') selected = [...states.evidence.slice(0, 6), ...labRows.filter(row => row.date === currentFindings.latestDate)]
    else selected = [...rankedComparisons, ...labRows.filter(row => row.date === currentFindings.latestDate)]
  }
  const supportedFindings: FindingCandidate[] = []
  if (integrated) {
    const allLabRows = panels.flatMap(panel => panel.results.map(result => labEvidence(panel, result)))
    const panelRows: AnalystEvidence[] = panels.map(panel => ({
      id: evidenceId('panel', panel.id), type: 'lab_panel', date: panel.test_date,
      title: 'Recorded lab panel', detail: `Panel on ${panel.test_date}: ${panel.results.length} recorded results. Panel membership describes recorded presence or absence, not a value or testing recommendation.`,
      confidence: 'high', sourceLabel: panel.panel_name || panel.provider || 'Lab panel',
    }))
    const bank = new Map([...allLabRows, ...panelRows, ...comparisons.evidence].map(row => [row.id, row]))
    let candidates = findingCandidates(currentFindings, histories, bank)
    if (guided === 'protocol_context') candidates = []
    if (guided === 'missing_data') candidates = candidates.filter(row => row.finding.evidence.membership || row.finding.type === 'insufficient_history'
      || row.finding.limitations.some(gap => gap !== 'assay_method_unknown' && gap !== 'excluded_history'))
    if (guided === 'missing_data') selected = panelRows.filter(row => row.date === currentFindings.latestDate).slice(0, 2)
    if (intent === 'missing_data') candidates = [...candidates.filter(row => row.finding.evidence.membership || row.finding.type === 'insufficient_history'),
      ...candidates.filter(row => !row.finding.evidence.membership && row.finding.type !== 'insufficient_history')]
    if (intent === 'largest_changes') {
      const order = new Map(rankedComparisons.map((row, i) => [row.id, i]))
      candidates = [...candidates].sort((a, b) => (order.get(a.evidence[0].id) ?? Infinity) - (order.get(b.evidence[0].id) ?? Infinity))
    }
    // Preserve intent-specific evidence before using the remaining budget for
    // complete finding bundles. General/current context reserves non-lab records.
    const reserved = guided ? (intent === 'largest_changes' ? rankedComparisons.slice(0, 8)
      : intent === 'protocol_context' ? selected : intent === 'current_snapshot' ? states.evidence.slice(0, 6) : [])
      : intent === 'largest_changes' ? rankedComparisons.slice(0, 24)
      : intent === 'protocol_context' ? [...longitudinal.evidence.slice(0, 24), ...states.evidence.slice(0, 4)]
      : intent === 'general' || intent === 'current_snapshot' ? [...states.evidence.slice(0, 6), ...weights.evidence, ...journals.evidence.slice(0, 1)] : []
    const chosen = new Map(reserved.map(row => [row.id, row]))
    for (const candidate of candidates) {
      const additions = candidate.evidence.filter(row => !chosen.has(row.id))
      if (supportedFindings.length >= limits.findings || chosen.size + additions.length > limits.evidence - (guided ? 2 : 8)) continue
      for (const row of additions) chosen.set(row.id, row)
      supportedFindings.push(candidate)
    }
    // Unknown latest-panel ordering must not be silently resolved by selecting
    // only panels[0]. Source records remain usable, without a current finding.
    const fallback = guided === 'missing_data' || guided === 'protocol_context' ? [] : currentFindings.state === 'ambiguous_latest'
      ? allLabRows.filter(row => row.date === currentFindings.latestDate) : []
    selected = unique([...chosen.values(), ...fallback, ...selected]).slice(0, limits.evidence)
  } else selected = unique(selected).slice(0, 40)
  const selectedIds = new Set(selected.map(item => item.id))
  // A selected source row alone must not pull an unselected older comparison
  // into a guided answer. Its actual comparison evidence must be selected too.
  const comparisonFacts = guided ? comparisons.facts.filter(item => selectedIds.has(item.evidenceIds[0])) : comparisons.facts
  const facts = [...longitudinal.facts, ...comparisonFacts, ...events.facts, ...states.facts, ...weights.facts, ...journals.facts]
    .map(item => ({ ...item, evidenceIds: item.evidenceIds.filter(id => selectedIds.has(id)) })).filter(item => item.evidenceIds.length).slice(0, 30)
  // Compatibility prose for existing consumers (including optional Report AI)
  // delegates to canonical findings instead of rebuilding membership/transitions.
  // The Analyst gets the typed projection below, so it needs no duplicate prose.
  if (!integrated) for (const finding of currentFindings.findings) {
    const ids = findingSourceIds(finding).filter(id => selectedIds.has(id))
    if (ids.length) facts.unshift(fact(`${finding.biomarkerName}: ${finding.reason} ${labLimitations(finding.limitations).join(' ')}`, ...ids))
  }
  // The model needs stable citation handles, not database identifiers. Keep the
  // evidence payload inspectable while replacing source IDs with request-local IDs.
  const idMap = new Map(selected.map((item, index) => [item.id, `E${index + 1}`]))
  const mappedEvidence = selected.map(item => ({ ...item, id: idMap.get(item.id)! }))
  const mapFacts = (items: ContextFact[]) => items.map(item => ({ ...item,
    evidenceIds: item.evidenceIds.map(id => idMap.get(id)).filter((id): id is string => Boolean(id)),
  }))
  if (guided && guided !== 'protocol_context') {
    const relevant = currentFindings.findings.flatMap(finding => labLimitations(finding.limitations))
    for (const text of [...new Set(relevant)]) if (!gaps.some(gap => gap.text === text)) gaps.push(fact(text))
  }
  return { intent, question, asOfDate: today,
    ...(guided ? { action: guided } : {}),
    scope: guided ? `${selected.length} selected evidence items for ${guided}. Only the selected action is in scope.` : `${selected.length} selected evidence items from ${panels.length} lab panels, ${data.protocols.length} protocols, structured/legacy protocol history, and recent numeric journal signals.`,
    facts: mapFacts((guided === 'missing_data' ? [] : facts).slice(0, guided ? 12 : 30)), evidence: mappedEvidence, gaps: mapFacts(gaps.slice(0, guided === 'current_snapshot' ? 1 : guided ? 5 : 10)),
    ...(integrated ? {
      deterministicFindings: supportedFindings.flatMap(candidate => {
        const projected = projectAnalystFinding(candidate, currentFindings, idMap)
        return projected ? [projected] : []
      }),
      currentFindingScope: { state: currentFindings.state, latestDate: currentFindings.latestDate,
        previousDate: currentFindings.previousDate, previousPanelAmbiguous: currentFindings.previousPanelAmbiguous,
        omittedFindingCount: currentFindings.findings.length - supportedFindings.length },
    } : {}),
  }
}

/** Public actions bypass text classification; other internal consumers keep their contract. */
export function buildGuidedAnalystContext(data: AnalystSourceData, action: GuidedAnalystAction, today: string): HealthAnalystContext {
  const needsProtocols = action === 'current_snapshot' || action === 'protocol_context'
  return buildAnalystContext({ ...data, journal: [],
    protocols: needsProtocols ? data.protocols : [], protocolEvents: needsProtocols ? data.protocolEvents : [],
  }, guidedAnalystInstruction(action), today, { action, includeDeterministicFindings: true })
}
