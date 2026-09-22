import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { testosteroneImportHistory } from './fixtures/lab-findings-ux.mjs'

const require = createRequire(import.meta.url), cache = new Map()
function load(path) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) }
    if (name === 'next/link') return { __esModule: true, default: props => ({ type: 'a', props }) }
    if (!name.startsWith('.')) return require(name)
    for (const ext of ['.ts', '.tsx']) {
      try { return load(new URL(name + ext, url)) } catch (error) { if (error.code !== 'ENOENT') throw error }
    }
    throw new Error(`Missing module ${name}`)
  }, out, out.exports)
  cache.set(url.href, out.exports)
  return out.exports
}
const evidence = load('../lib/health/labEvidence.ts')
const findings = load('../lib/health/labFindings.ts')
const { biomarkerHistories } = load('../lib/health/labs.ts')
const { buildLabFindingsSummaryModel, deriveCurrentLabFindingSet } = load('../lib/health/labFindingsSummary.ts')
const { buildAnalystContext } = load('../lib/health/analyst/evidence.ts')
const { buildReportIntelligence } = load('../lib/health/report/intelligence.ts')
const View = load('../components/health/LabFindingsSummary.tsx').default

function panels(values, extra = {}) {
  return values.map((value, i) => ({ id: `panel-${i}`, user_id: 'owner-secret', test_date: `2026-${String(i + 1).padStart(2, '0')}-01`,
    panel_name: 'Recorded panel', provider: null, notes: null, source_type: 'csv', source_filename: 'private-file.csv', source_metadata: { parser: 'fixture' }, results: [{
      id: `result-${i}`, lab_panel_id: `panel-${i}`, user_id: 'owner-secret', biomarker_name: 'Fictional marker', canonical_name: null,
      value, value_text: null, unit: 'mg/dL', reference_low: null, reference_high: null, reference_text: null,
      status: 'unknown', status_source: 'unknown', source_row_index: 7, source_raw: { private: 'raw-secret' }, import_confidence: 'high', ...extra,
    }] }))
}
const trajectory = p => {
  const h = biomarkerHistories(p)[0]
  return evidence.buildLabTrajectory(h.units.flatMap(g => g.observations).map(row => evidence.toLabEvidenceObservation(row, h.key)))
}
const personal = p => evidence.labPersonalHistory(trajectory(p))
const derived = p => findings.deriveLabFindings({ series: [{ biomarkerKey: 'fictional-marker', biomarkerName: 'Fictional marker', unit: 'mg/dL', trajectory: trajectory(p) }] })[0]

test('one date is insufficient; two support only direct comparison; three are recorded history, not a prior baseline', () => {
  assert.equal(personal(panels([10])).evidenceLevel, 'insufficient')
  assert.equal(personal(panels([10, 11])).evidenceLevel, 'direct_comparison')
  const three = personal(panels([10, 11, 12]))
  assert.equal(three.evidenceLevel, 'recorded_history')
  assert.equal(three.baseline, null)
})
test('three or more earlier dates establish a descriptive median and extent, excluding current', () => {
  const p = panels([10, 30, 20, 100]), before = JSON.stringify(p)
  assert.deepEqual(personal(p).baseline, { median: 20, min: 10, max: 30, count: 3, start: '2026-01-01', end: '2026-03-01' })
  assert.equal(personal(panels([10, 30, 20, 40, 999])).baseline.median, 25)
  assert.equal(JSON.stringify(p), before)
})
test('canonical range transitions take precedence over personal movement', () => {
  for (const [values, statuses, type] of [
    [[10, 30], ['normal', 'high'], 'newly_outside_range'],
    [[30, 10], ['high', 'normal'], 'returned_to_range'],
    [[30, 40], ['high', 'high'], 'persistently_outside_range'],
  ]) {
    const p = panels(values, { reference_low: 5, reference_high: 20, status_source: 'reported' })
    p.forEach((panel, i) => { panel.results[0].status = statuses[i] })
    assert.equal(derived(p).type, type)
  }
})
test('personal highs and lows require at least two prior eligible dates and preserve the exact latest value', () => {
  assert.equal(personal(panels([10, 20])).personalExtreme, null)
  for (const [values, side] of [[[10, 11, 12.123456789], 'high'], [[10, 11, 9], 'low']]) {
    const f = derived(panels(values))
    assert.equal(f.evidence.personalHistory.personalExtreme, side)
    assert.equal(f.evidence.current.value, values.at(-1))
    assert.match(findings.labFindingLabel(f), new RegExp(`personal ${side}$`))
  }
})
test('repeated direction, reversal, and stability use recorded steps without clinical thresholds', () => {
  assert.equal(derived(panels([50, 10, 20, 30])).type, 'repeated_direction')
  assert.equal(personal(panels([50, 30, 20, 10])).movement, 'repeated_decrease')
  assert.equal(derived(panels([10, 30, 20])).type, 'reversal')
  const stable = derived(panels([10, 12, 11, 11]))
  assert.equal(stable.type, 'stable_history')
  assert.equal(stable.evidence.personalHistory.version, 1)
  assert.equal(derived(panels([10, 10])).type, 'unchanged')
  assert.equal(findings.selectHeadlineFindings([derived(panels([10, 10]))]).length, 0)
})
test('missing or changed supplied ranges never invent a range transition', () => {
  assert.ok(derived(panels([10, 11, 12, 13])).limitations.includes('reference_range_unavailable'))
  const p = panels([10, 30], { reference_low: 5, reference_high: 20, status: 'normal', status_source: 'reported' })
  Object.assign(p[1].results[0], { reference_high: 25, status: 'high' })
  assert.notEqual(derived(p).type, 'newly_outside_range')
})
test('incompatible units and explicit assay, method, or specimen metadata block comparisons and baseline', () => {
  for (const field of ['unit', 'assay', 'method', 'specimen']) {
    const p = panels([10, 20, 30, 40])
    if (field === 'unit') p[3].results[0].unit = 'mmol/L'
    else p.forEach((panel, i) => { panel.results[0].source_raw[field] = i === 3 ? 'B' : 'A' })
    const t = trajectory(p)
    assert.equal(t.latestRecordedPair.comparison, null)
    assert.equal(evidence.labPersonalHistory(t).baseline, null)
    assert.equal(derived(p).type, 'incompatible_comparison')
    const current = deriveCurrentLabFindingSet(p, biomarkerHistories(p)).findings[0]
    assert.ok(current.limitations.includes(field === 'unit' ? 'incompatible_unit' : 'incompatible_assay'))
  }
  assert.ok(derived(panels([10, 11])).limitations.includes('assay_method_unknown'))
})
test('same-day equal and conflicting readings remain ambiguous, never deduplicated or averaged', () => {
  for (const value of [40, 41]) {
    const p = panels([10, 20, 30, 40])
    p[3].results.push({ ...p[3].results[0], id: 'duplicate-result', value })
    assert.equal(derived(p).evidence.personalHistory.baseline, null)
    assert.equal(derived(p).evidence.comparison, null)
    assert.ok(derived(p).limitations.includes(value === 40 ? 'same_day_records' : 'conflicting_same_day'))
  }
})
test('excluded dates cannot imply repeated movement across a gap; eligible baseline dates remain traceable', () => {
  const p = panels([10, 20, 30, 40, 50])
  p[2].results.push({ ...p[2].results[0], id: 'duplicate-result' })
  const f = derived(p)
  assert.equal(f.evidence.personalHistory.movement, null)
  assert.equal(f.evidence.personalHistory.baseline.count, 3)
  assert.ok(f.limitations.includes('excluded_history'))
  assert.deepEqual(f.evidence.history.map(row => row.resultId), ['result-0', 'result-1', 'result-3', 'result-4'])
})
test('ranking follows the inspectable category tuple, returned-range before persistent abnormality, with stable ties', () => {
  const base = derived(panels([10, 11]))
  const types = ['newly_outside_range', 'returned_to_range', 'persistently_outside_range', 'outside_previously_observed_values', 'repeated_direction', 'stable_history', 'increased', 'insufficient_history']
  const items = types.map((type, i) => ({ ...base, id: String(i), type, priority: i === 2 ? 'attention' : 'context' }))
  assert.deepEqual(findings.rankLabFindings([...items].reverse()).map(f => f.type), types)
  assert.deepEqual(findings.highestPriorityFindings(items.slice(1)).map(f => f.type), ['returned_to_range'])
  const ties = [{ ...base, id: 'z', biomarkerName: 'Beta' }, { ...base, id: 'a', biomarkerName: 'Alpha' }, { ...base, id: 'b', biomarkerName: 'Alpha' }]
  assert.deepEqual(findings.rankLabFindings(ties).map(f => f.id), ['a', 'b', 'z'])
  assert.deepEqual(findings.rankLabFindings(ties), findings.rankLabFindings([...ties].reverse()))
  assert.equal(findings.labFindingPriorityTuple(items[0])[0], 0)
})
function tree(node) {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) return node.map(tree)
  if (typeof node.type === 'function') return tree(node.type(node.props))
  return { ...node, props: { ...node.props, children: tree(node.props?.children) } }
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(n => nodes(n, predicate))
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]
}
function text(node, closed = false) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node !== 'object') return String(node)
  if (Array.isArray(node)) return node.map(n => text(n, closed)).join(' ')
  if (closed && node.type === 'details') return ''
  return text(node.props?.children, closed)
}
test('Briefing shows four findings, data before a single short label, with accessible closed details', () => {
  const p = panels([10, 12, 11, 11])
  for (const panel of p) panel.results = Array.from({ length: 7 }, (_, i) => ({ ...panel.results[0], id: `${panel.id}-${i}`, biomarker_name: `Marker ${i}` }))
  const model = buildLabFindingsSummaryModel(p, biomarkerHistories(p))
  assert.equal(model.headlines.length, 4)
  const rendered = tree(View({ model, embedded: true }))
  const cards = nodes(rendered, n => n.type === 'article')
  assert.equal(cards.length, 4)
  for (const card of cards) {
    assert.equal(nodes(card, n => n.type === 'p' && n.props.className === 'summary').length, 1)
    assert.equal(nodes(card, n => n.type === 'time').filter(n => n.props.dateTime).length > 0, true)
    const closed = text(card, true)
    assert.ok(closed.indexOf('11 mg/dL') < closed.indexOf('Unchanged since'))
    assert.doesNotMatch(closed, /median|Prior observed|Limitations|Priority tuple/)
    const detail = nodes(card, n => n.type === 'details')[0]
    assert.equal(detail.props.open, undefined)
    assert.match(text(nodes(detail, n => n.type === 'summary')[0]), /View details.*Hide details/)
    assert.match(text(detail), /11.*→.*11 mg\/dL/)
    assert.doesNotMatch(text(detail), /Median|source row|eligible|Category priority/)
    assert.doesNotMatch(text(card), /owner-secret|private-file|raw-secret|result-0/)
  }
  const css = readFileSync(new URL('../app/health/health.module.css', import.meta.url), 'utf8')
  assert.match(css, /personalHistoryTrack[^}]*flex-wrap: wrap/)
  assert.match(css, /formDetails summary[^}]*min-height: 44px/)
  assert.match(css, /summary:focus-visible/)
})
test('Analyst and Report reuse canonical baseline and ranking; AI receives supported facts without source identities', () => {
  const p = panels([10, 12, 11, 11.1]), source = { panels: p, protocols: [], protocolEvents: [], journal: [] }
  const model = buildLabFindingsSummaryModel(p, biomarkerHistories(p))
  const analyst = buildAnalystContext(source, 'What is my current health picture?', '2026-09-22', { includeDeterministicFindings: true })
  const report = buildReportIntelligence(source, p, biomarkerHistories(p), [], null, '2026-09-22')
  assert.deepEqual(report.headlineChanges[0], model.headlines[0])
  assert.deepEqual(analyst.deterministicFindings[0].personalHistory, model.headlines[0].evidence.personalHistory)
  assert.ok(analyst.deterministicFindings[0].evidenceIds.length >= 4)
  assert.doesNotMatch(JSON.stringify(analyst.deterministicFindings), /owner-secret|panel-\d|result-\d|private-file|raw-secret/)
  assert.equal(model.headlines[0].evidence.history[0].panelId, 'panel-0')
  assert.equal(model.headlines[0].evidence.history[0].reference.status, 'unknown')
})
test('finding language makes no treatment, medical significance, or personal-normal claims', () => {
  for (const values of [[10], [10, 12], [10, 12, 11], [10, 12, 11, 11.1], [10, 20, 30, 40]]) {
    const f = derived(panels(values))
    assert.doesNotMatch(`${findings.labFindingLabel(f)} ${f.reason}`, /caused|due to|treatment effect|clinically significant|normal for you|your normal|improved|worsened/i)
  }
})

const presentation = load('../lib/health/labFindingPresentation.ts')
const { buildHealthBriefing } = load('../lib/health/healthBriefing.ts')
const { FindingEvidence } = load('../components/health/LabFindingsSummary.tsx')
const summaryFor = p => buildLabFindingsSummaryModel(p, biomarkerHistories(p))
const briefingFor = p => buildHealthBriefing({ panels: p, histories: biomarkerHistories(p), protocols: { status: 'ready', asOf: '2026-09-22', data: { protocols: [], events: [] } } })

test('human-first testosterone fixture shows the last comparison and verification without technical machinery', () => {
  const p = testosteroneImportHistory(), before = JSON.stringify(p), model = summaryFor(p), f = model.headlines[0]
  assert.equal(f.evidence.comparison.delta, 68)
  assert.equal(f.evidence.comparison.percent, 6.73934588702)
  assert.match(findings.labFindingLabel(f), /^Possible new recorded high/)
  assert.match(f.reason, /^Needs verification:/)
  const rendered = tree(View({ model, embedded: true })), card = nodes(rendered, n => n.type === 'article')[0]
  const detail = nodes(card, n => n.type === 'details')[0]
  assert.match(text(card, true), /Up 68 \(\+6\.7%\) since June 29/)
  assert.match(text(detail), /1009.*→.*1077 ng\/dL/)
  assert.match(text(detail), /Within the supplied 250–1100 range/)
  assert.match(text(card, true), /Imported result needs verification/)
  assert.match(text(detail), /Imported result needs verification/)
  assert.ok(nodes(detail, n => n.type === 'p').length <= 6)
  assert.doesNotMatch(text(card), /New recorded personal high|eligible|Presentation order|Category priority|Ties use|source row|import confidence|Median|fixture\.pdf|reported|manual|parser/i)
  assert.equal(JSON.stringify(p), before)
  const audit = text(tree(FindingEvidence({ finding: f })))
  assert.match(audit, /Median 432 ng\/dL/)
  assert.match(audit, /source row 28/)
  assert.match(audit, /import confidence low/)
  assert.deepEqual(f.evidence.history.map(row => row.value), [432, 59, 1009, 1077])
})

test('low-confidence personal highs and lows are qualified even after an import-confirmation checkbox', () => {
  for (const latest of [1077, 40]) {
    const p = testosteroneImportHistory()
    // No range transition so the personal extreme is the canonical primary fact.
    p.forEach(panel => Object.assign(panel.results[0], { reference_low: null, reference_high: null, status: 'unknown', status_source: 'unknown' }))
    p[3].results[0].value = latest
    const f = summaryFor(p).headlines[0]
    assert.equal(f.type, 'outside_previously_observed_values')
    assert.match(findings.labFindingLabel(f), /^Possible new recorded (high|low) — needs verification$/)
    assert.ok(f.limitations.includes('low_import_confidence'))
    assert.equal(f.evidence.current.provenance.confidence, 'low')
    const source = { panels: p, protocols: [], protocolEvents: [], journal: [] }
    const analyst = buildAnalystContext(source, 'What is my current health picture?', '2026-09-22', { includeDeterministicFindings: true })
    assert.match(analyst.deterministicFindings[0].reason, /^Needs verification:/)
    assert.ok(analyst.deterministicFindings[0].limitations.includes('low_import_confidence'))
    const report = buildReportIntelligence(source, p, biomarkerHistories(p), [], null, '2026-09-22')
    assert.deepEqual(report.headlineChanges[0].evidence, f.evidence)
  }
})

test('an uncertain older reading also qualifies claims based on the recorded history', () => {
  const p = testosteroneImportHistory()
  p[3].results[0].import_confidence = 'high'
  p[0].results[0].import_confidence = 'low'
  assert.match(findings.labFindingLabel(summaryFor(p).headlines[0]), /^Possible new recorded high/)
})

test('consumer range validation rejects partial, nonnumeric, inverted, identical, and contradictory bounds without mutation', () => {
  const f = summaryFor(testosteroneImportHistory()).headlines[0]
  for (const [low, high] of [[null, 1100], [250, null], ['250', 1100], [250, 'text'], [Infinity, 1100], [250, NaN], [1100, 250], [250, 250]]) {
    const row = { ...f.evidence.current, reference: { ...f.evidence.current.reference, low, high } }
    assert.equal(presentation.consumerSuppliedRange(row), null)
    assert.equal(row.reference.low, low)
    assert.equal(row.reference.high, high)
  }
  assert.equal(presentation.consumerSuppliedRange({ ...f.evidence.current, reference: { ...f.evidence.current.reference, status: 'high' } }), null)
  assert.equal(presentation.consumerSuppliedRange(f.evidence.current).text, 'Within the supplied 250–1100 range')
  for (const value of [250, 1100]) assert.equal(presentation.consumerSuppliedRange({ ...f.evidence.current, value }).outside, false)
})

test('malformed ranges never reach consumer rendered details and source evidence remains unchanged', () => {
  for (const [low, high] of [[null, 1100], [250, null], ['bad', 1100], [1100, 250], [250, 250]]) {
    const p = testosteroneImportHistory()
    Object.assign(p[3].results[0], { reference_low: low, reference_high: high })
    const before = JSON.stringify(p)
    assert.doesNotMatch(text(tree(View({ model: summaryFor(p), embedded: true }))), /Within the supplied|Outside the supplied/)
    assert.equal(JSON.stringify(p), before)
  }
})

test('one-reading in-range results cannot displace comparisons; outside-range or verification readings remain available', () => {
  const p = testosteroneImportHistory()
  const latest = p[3]
  for (let i = 0; i < 7; i++) latest.results.push({ ...latest.results[0], id: `extra-${i}`, biomarker_name: `New marker ${i}`, value: 500, import_confidence: null })
  let model = briefingFor(p)
  assert.equal(model.findings.headlines.length, 1)
  assert.equal(model.supplementalLabUpdates.length, 0)
  for (const result of latest.results.slice(1)) result.import_confidence = 'low'
  model = briefingFor(p)
  assert.ok(model.findings.headlines.length + model.supplementalLabUpdates.length <= 4)
  const only = [testosteroneImportHistory()[3]]
  only[0].results[0].import_confidence = null
  assert.equal(briefingFor(only).supplementalLabUpdates.length, 0)
  Object.assign(only[0].results[0], { value: 1200, status: 'high' })
  const flagged = briefingFor(only)
  assert.equal(flagged.supplementalLabUpdates.length, 1)
  assert.equal(flagged.supplementalLabUpdates[0].label, '1 reading')
  assert.doesNotMatch(text(tree(View({ model: flagged.findings, supplemental: flagged.supplementalLabUpdates, embedded: true }))), /1 readings/)
})

test('native consumer disclosures start closed with state-dependent labels and accessible tap targets', () => {
  const rendered = tree(View({ model: summaryFor(testosteroneImportHistory()), embedded: true }))
  const detail = nodes(rendered, n => n.type === 'details')[0], summary = nodes(detail, n => n.type === 'summary')[0]
  assert.equal(detail.props.open, undefined)
  assert.equal(summary.props.role, undefined) // native summary has disclosure semantics
  assert.deepEqual(nodes(summary, n => n.type === 'span').map(n => [n.props.className, text(n)]), [['detailsClosed', 'View details'], ['detailsOpen', 'Hide details']])
  const css = readFileSync(new URL('../app/health/health.module.css', import.meta.url), 'utf8')
  assert.match(css, /consumerDetails\[open\] > summary \.detailsClosed[^}]*display: none/)
  assert.match(css, /consumerDetails\[open\] > summary \.detailsOpen[^}]*display: inline/)
  assert.match(css, /consumerDetails > summary[^}]*min-height: 44px/)
  assert.match(css, /briefingUpdateName[^}]*white-space: normal/)
})
