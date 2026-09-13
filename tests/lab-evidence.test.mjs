import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
function load(path) {
  const url = path.startsWith('file:') ? new URL(path) : new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'server-only') return {}
    if (!name.startsWith('.')) return require(name)
    for (const suffix of ['', '.ts']) { try { return load(new URL(name + suffix, url).href) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    throw new Error(`Missing module ${name}`)
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}
const bio = load('../lib/health/biomarkerIntelligence.ts')
const labs = load('../lib/health/labs.ts')
const longitudinal = load('../lib/health/longitudinal/engine.ts')
const analyst = load('../lib/health/analyst/evidence.ts')
const report = load('../lib/health/report/model.ts')
const shared = load('../lib/health/labEvidence.ts')
const longitudinalAnalyst = load('../lib/health/longitudinal/analyst.ts')
const { analystInput } = load('../lib/health/analyst/prompts.ts')
const panel = (id, date, value = 10, extra = {}) => ({
  id, user_id: 'fictional-owner', test_date: date, panel_name: 'Fictional panel', provider: null, notes: null,
  source_type: 'csv', source_filename: 'fictional.csv', source_metadata: { parser: 'csv-v2' },
  results: [{ id: `result-${id}`, lab_panel_id: id, user_id: 'fictional-owner', biomarker_name: 'Fictional marker',
    canonical_name: null, value, value_text: null, unit: 'mg/dL', reference_low: 2, reference_high: 20,
    reference_text: null, status: 'normal', status_source: 'reported', category: null,
    source_raw: { original: 'fictional raw entry' }, source_row_index: 1, import_confidence: 'low', ...extra }],
})
const pair = (a = 10, b = 12) => [panel('old', '2026-01-05', a), panel('new', '2026-01-31', b)]
const rows = panels => labs.biomarkerHistories(panels)[0].units[0].observations
const source = (panels = pair()) => ({ panels, journal: [], protocols: [], protocolEvents: [{
  id: 'fictional-event', protocol_id: 'fictional-protocol', compound_id: null, date: '2026-01-10', event_type: 'started', metadata: { version: 1 },
}] })
const obs = panels => longitudinal.buildLongitudinal(source(panels), '2026-05-01').observations[0]
const context = panels => analyst.buildAnalystContext(source(panels), 'since my last labs', '2026-05-01', { includeDeterministicFindings: true })

// Recorded before refactoring. Intentional policy corrections are called out in
// the corresponding assertions below and the delivery report, not hidden.
test('characterization: one date has no pair', () => assert.equal(bio.compareLatest(rows(pair().slice(0, 1))), null))
test('characterization: same numeric pair has delta 2 and 20 percent in all consumers', () => {
  const p = pair(), c = bio.compareLatest(rows(p)), l = obs(p).changes[0], r = report.buildDoctorReport(source(p), 'all', '2026-05-01').trends[0]
  for (const item of [c, l, r]) { assert.equal(item.delta, 2); assert.equal(item.percent, 20) }
  assert.match(context(p).evidence.find(e => e.type === 'lab_comparison').detail, /20\.0%/)
})
test('characterization: last pair, not earliest pair, is the existing Labs comparator', () => {
  const p = [panel('first', '2025-12-01', 4), ...pair()]
  assert.equal(bio.compareLatest(rows(p)).previous.result.value, 10)
})
test('characterization: equal values on different dates remain a valid unchanged comparison', () => assert.equal(bio.compareLatest(rows(pair(10, 10))).direction, 'unchanged'))
test('characterization: Labs rejects equal-valued same-day records', () => assert.equal(bio.compareLatest(rows([...pair(), panel('copy', '2026-01-31', 12)])), null))
test('intentional correction: longitudinal no longer selects equal-valued same-day records', () => assert.equal(obs([...pair(), panel('copy', '2026-01-31', 12)]).changes.length, 0))
test('characterization: conflicting same-day values are not selected by either comparator', () => {
  const p = [...pair(), panel('conflict', '2026-01-31', 13)]
  assert.equal(bio.compareLatest(rows(p)), null); assert.equal(obs(p).changes.length, 0)
})
test('characterization: missing units cannot produce numeric changes', () => {
  const p = pair().map(p => ({ ...p, results: p.results.map(r => ({ ...r, unit: '' })) }))
  assert.equal(bio.compareLatest(rows(p)), null); assert.equal(obs(p).changes.length, 0)
})
test('characterization: incompatible units stay separate', () => {
  const p = pair(); p[1].results[0].unit = 'nmol/L'
  assert.equal(labs.biomarkerHistories(p)[0].units.length, 2)
  assert.equal(bio.compareLatest(p.map(p => ({ date: p.test_date, panelId: p.id, result: p.results[0] }))), null)
})
test('characterization: qualitative newest result has no numeric pair', () => {
  const p = pair(); p[1].results[0] = { ...p[1].results[0], value: null, value_text: 'Detected' }
  assert.equal(bio.compareLatest(rows(p)), null)
})
test('characterization: zero denominator omits percent', () => { assert.equal(bio.compareLatest(rows(pair(0, 2))).percent, null); assert.equal(obs(pair(0, 2)).changes[0].percent, null) })
test('intentional correction: negative baseline percentage is now unavailable in every consumer', () => {
  assert.equal(bio.compareLatest(rows(pair(-10, -8))).percent, null); assert.equal(obs(pair(-10, -8)).changes[0].percent, null)
})
for (const value of [NaN, Infinity, -Infinity, '12', 'invalid']) test(`characterization: rejects non-finite/malformed numeric ${value}`, () => assert.equal(bio.compareLatest(rows(pair(10, value))), null))
test('characterization: missing reference ranges do not prevent numeric arithmetic', () => {
  const p = pair().map(p => ({ ...p, results: p.results.map(r => ({ ...r, reference_low: null, reference_high: null, status: 'unknown', status_source: 'unknown' })) }))
  assert.equal(bio.compareLatest(rows(p)).delta, 2)
})
test('intentional correction: unknown prior status never manufactures a new flag', () => {
  const p = pair(10, 30); Object.assign(p[0].results[0], { status: 'unknown', reference_low: null, reference_high: null }); p[1].results[0].status = 'high'
  assert.ok(!context(p).deterministicFindings.some(f => f.type === 'newly_outside_range'))
  assert.equal(context(p).deterministicFindings[0].comparison.range.transition, 'prior_status_unknown')
})
test('characterization: panel membership includes unusable measurements rather than treating them as absent', () => {
  const p = pair(); p[1].results.push({ ...p[1].results[0], id: 'novel', biomarker_name: 'Novel fictional marker', value: null, value_text: 'Detected' })
  assert.equal(context(p).deterministicFindings.filter(f => f.type === 'newly_measured').length, 1)
})
test('characterization: raw result identity and import confidence survive biomarker grouping', () => {
  const r = rows(pair())[0]; assert.equal(r.result.id, 'result-new'); assert.equal(r.panelId, 'new'); assert.equal(r.result.import_confidence, 'low'); assert.deepEqual(r.result.source_raw, { original: 'fictional raw entry' })
})
test('characterization: conservative alias grouping preserves distinct marker identities', () => {
  assert.equal(bio.classifyBiomarker('Total Testosterone').key, bio.classifyBiomarker('Testosterone, Total').key)
  assert.notEqual(bio.classifyBiomarker('Estradiol').key, bio.classifyBiomarker('Sensitive estradiol').key)
})

const trajectory = p => bio.labTrajectory(rows(p))
const membership = (p, current = 'new', previous = 'old') => shared.labPanelMembership(labs.biomarkerHistories(p), current, previous)
const three = () => [panel('earliest', '2025-12-01', 4), ...pair()]
test('one date has a latest/earliest reading, no prior extent and explicit insufficient history', () => {
  const t = trajectory([pair()[1]])
  assert.equal(t.latest.value, 12); assert.equal(t.earliest.value, 12); assert.equal(t.previous, null)
  assert.equal(t.priorEligibleDates, 0); assert.equal(t.priorObservedExtent, null)
  assert.equal(t.latestVsEarliest.comparison, null); assert.ok(t.limitations.includes('insufficient_history'))
})
test('two dates yield latest, previous and earliest', () => {
  const t = trajectory(pair()); assert.equal(t.latest.value, 12); assert.equal(t.previous.value, 10)
  assert.equal(t.earliest.value, 10); assert.equal(t.priorEligibleDates, 1)
})
test('three dates expose ascending trajectory independent of input ordering', () => {
  const t = trajectory(three().reverse())
  assert.deepEqual(t.ordered.map(r => r.value), [4, 10, 12])
  assert.deepEqual(t.ordered.map(r => r.date), ['2025-12-01', '2026-01-05', '2026-01-31'])
  assert.equal(t.priorEligibleDates, 2)
})
test('latest vs earliest is a separate explicit comparator from latest vs previous', () => {
  const t = trajectory(three())
  assert.equal(t.latestVsPrevious.comparison.delta, 2); assert.equal(t.latestVsPrevious.comparison.percent, 20)
  assert.equal(t.latestVsEarliest.comparison.delta, 8); assert.equal(t.latestVsEarliest.comparison.percent, 200)
  assert.equal(t.latestVsEarliest.comparison.elapsedDays, 61)
})
test('prior observed extent excludes the current reading', () => {
  assert.deepEqual(trajectory(three()).priorObservedExtent, { min: 4, max: 10, start: '2025-12-01', end: '2026-01-05', count: 2 })
})
test('comparison preserves exact source identity, original units, range and parser provenance', () => {
  const c = trajectory(pair()).latestVsPrevious.comparison, r = c.current
  assert.equal(c.previous.resultId, 'result-old'); assert.equal(r.resultId, 'result-new'); assert.equal(r.panelId, 'new')
  assert.equal(r.date, '2026-01-31'); assert.equal(r.value, 12); assert.equal(r.originalUnit, 'mg/dL')
  assert.deepEqual(r.reference, { low: 2, high: 20, text: null, status: 'normal', statusSource: 'reported' })
  assert.deepEqual(r.provenance, { sourceType: 'csv', filename: 'fictional.csv', parser: 'csv-v2', rowIndex: 1, confidence: 'low', rawAvailable: true, metadataAvailable: true })
})
test('provenance points to original extraction data without copying raw content into facts', () => {
  const p = pair(), original = rows(p)[0]
  assert.equal(original.source.source_metadata, p[1].source_metadata)
  assert.equal(original.result.source_raw, p[1].results[0].source_raw)
  assert.doesNotMatch(JSON.stringify(trajectory(p)), /fictional raw entry/)
})
test('newly measured is distinct from having no prior panel', () => {
  const p = [panel('old', '2026-01-05', 8, { biomarker_name: 'Another fictional marker' }), pair()[1]]
  assert.equal(membership(p).find(r => r.name === 'Fictional marker').change, 'newly_measured')
  assert.equal(membership([pair()[1]], 'new', null)[0].change, 'no_previous_panel')
})
test('absence from latest panel is not unchanged or zero', () => {
  const p = [pair()[0], panel('new', '2026-01-31', 2, { biomarker_name: 'Another fictional marker' })]
  const m = membership(p).find(r => r.name === 'Fictional marker')
  assert.equal(m.change, 'absent_from_latest'); assert.deepEqual(m.currentResultIds, []); assert.equal(m.currentUsable, false)
})
test('unusable newly measured qualitative result is present, not absent', () => {
  const p = [panel('old', '2026-01-05', 8, { biomarker_name: 'Another fictional marker' }), panel('new', '2026-01-31', null, { value_text: 'Detected' })]
  const m = membership(p).find(r => r.name === 'Fictional marker')
  assert.equal(m.change, 'newly_measured'); assert.equal(m.currentUsable, false); assert.deepEqual(m.currentResultIds, ['result-new'])
})
test('measured but malformed is distinct from absent', () => {
  const m = membership(pair(10, 'bad'))[0]; assert.equal(m.change, 'present_both'); assert.equal(m.currentUsable, false)
})
test('unit whitespace trims without unit conversion or loss of source spelling', () => {
  const p = pair(); p[1].results[0].unit = ' mg/dL '
  const c = trajectory(p).latestVsPrevious.comparison; assert.equal(c.unit, 'mg/dL'); assert.equal(c.current.originalUnit, ' mg/dL ')
})
for (const unit of ['', ' ', null, undefined]) test(`missing unit ${String(unit)} remains an explicit gap`, () => {
  const p = pair().map(p => ({ ...p, results: p.results.map(r => ({ ...r, unit })) }))
  const t = trajectory(p); assert.equal(t.latestRecordedPair.comparison, null); assert.ok(t.limitations.includes('missing_unit'))
})
test('different units reject direct comparison rather than relying only on grouping', () => {
  const p = pair(); p[1].results[0].unit = 'mmol/L'
  const dates = p.map(p => shared.labDateEvidence([shared.toLabEvidenceObservation({ date: p.test_date, panelId: p.id, result: p.results[0] }, 'same')]))
  const r = shared.compareLabDates(...dates); assert.equal(r.comparison, null); assert.ok(r.reasons.includes('incompatible_unit'))
})
test('numeric value accompanied by qualitative text is not silently coerced', () => {
  const p = pair(); p[1].results[0].value_text = '<12'
  assert.ok(trajectory(p).latestRecordedPair.reasons.includes('qualitative_value')); assert.equal(bio.compareLatest(rows(p)), null)
})
test('blank qualitative text is treated consistently as absent, never as a different numeric policy', () => {
  const p = pair(); p[1].results[0].value_text = '  '
  assert.equal(bio.compareLatest(rows(p)).delta, 2); assert.equal(obs(p).changes[0].delta, 2)
})
test('qualitative same-date companion cannot disappear during longitudinal normalization', () => {
  const p = [...pair(), panel('qualitative', '2026-01-31', null, { value_text: 'Detected' })]
  assert.equal(obs(p).changes.length, 0); assert.equal(bio.compareLatest(rows(p)), null)
})
for (const [value, gap] of [[null, 'missing_value'], [NaN, 'non_finite_value'], [Infinity, 'non_finite_value'], ['12', 'malformed_value'], ['bad', 'malformed_value']]) test(`typed exclusion for ${String(value)}`, () => {
  assert.ok(trajectory(pair(10, value)).latestRecordedPair.reasons.includes(gap))
})
test('zero baseline preserves absolute arithmetic but not percentage', () => {
  const c = trajectory(pair(0, 12)).latestVsPrevious.comparison
  assert.equal(c.delta, 12); assert.equal(c.absoluteDelta, 12); assert.equal(c.percent, null); assert.ok(c.limitations.includes('percentage_unavailable'))
})
test('non-finite delta rejects the pair', () => {
  const r = trajectory(pair(-Number.MAX_VALUE, Number.MAX_VALUE)).latestRecordedPair
  assert.equal(r.comparison, null); assert.deepEqual(r.reasons, ['non_finite_arithmetic'])
})
test('overflowing percentage is omitted without losing a finite delta', () => {
  const c = trajectory(pair(Number.MIN_VALUE, 12)).latestRecordedPair.comparison
  assert.equal(c.delta, 12); assert.equal(c.percent, null)
})
for (const date of ['2026-02-30', 'bad', '0000-01-01']) test(`invalid date ${date} cannot yield a comparison`, () => {
  const p = pair(); p[1].test_date = date; assert.ok(trajectory(p).limitations.includes('invalid_date')); assert.equal(bio.compareLatest(rows(p)), null)
})
test('conflicting same-day results retain every identity and are not averaged', () => {
  const t = trajectory([...pair(), panel('conflict', '2026-01-31', 13)]), d = t.dates.at(-1)
  assert.equal(d.reading, null); assert.ok(d.reasons.includes('conflicting_same_day'))
  assert.deepEqual(d.observations.map(r => r.resultId).sort(), ['result-conflict', 'result-new'])
})
test('equal-valued same-day observations remain distinct with their provenance', () => {
  const t = trajectory([...pair(), panel('equal', '2026-01-31', 12)]), d = t.dates.at(-1)
  assert.equal(d.reading, null); assert.ok(d.reasons.includes('same_day_records'))
  assert.equal(d.observations.length, 2); assert.ok(d.observations.every(r => r.provenance.parser === 'csv-v2'))
  assert.equal(t.priorEligibleDates, 0)
})
test('a duplicate date is excluded from trajectory, not silently treated as an earlier comparator', () => {
  const p = [...three(), panel('same', '2026-01-05', 10)], t = trajectory(p)
  assert.deepEqual(t.ordered.map(r => r.value), [4, 12]); assert.ok(t.limitations.includes('excluded_history'))
  assert.equal(t.latestVsPrevious.comparison.delta, 8); assert.equal(t.latestRecordedPair.comparison, null)
})
test('unusable latest date does not label an older eligible pair as the latest Labs result', () => {
  const p = [...three(), panel('invalid', '2026-02-20', null, { value_text: 'Pending' })], t = trajectory(p)
  assert.equal(t.latest.value, 12); assert.equal(t.latestVsPrevious.comparison.delta, 2)
  assert.equal(t.latestRecordedPair.comparison, null); assert.equal(bio.compareLatest(rows(p)), null)
})
test('same-day pair cannot be compared directly', () => {
  const t = trajectory(pair()); assert.ok(shared.compareLabDates(t.dates[0], t.dates[0]).reasons.includes('unordered_dates'))
})
test('reference ranges can be missing without inventing range status', () => {
  const p = pair().map(p => ({ ...p, results: p.results.map(r => ({ ...r, reference_low: null, reference_high: null, status: 'unknown', status_source: 'unknown' })) }))
  const c = trajectory(p).latestVsPrevious.comparison; assert.equal(c.delta, 2)
  assert.deepEqual(c.range, { previous: 'unknown', current: 'unknown', transition: 'prior_status_unknown' }); assert.ok(c.limitations.includes('reference_range_unavailable'))
})
for (const [previous, current, transition] of [['normal', 'high', 'newly_outside'], ['high', 'normal', 'returned_inside'], ['low', 'high', 'persistently_outside'], ['normal', 'normal', 'remained_inside'], ['unknown', 'high', 'prior_status_unknown'], ['high', 'unknown', 'current_status_unknown']]) test(`range transition ${previous} to ${current}`, () => {
  const p = pair(); p[0].results[0].status = previous; p[1].results[0].status = current
  assert.equal(trajectory(p).latestVsPrevious.comparison.range.transition, transition)
})
test('changed supplied range prevents unsupported transition', () => {
  const p = pair(); p[1].results[0].reference_high = 11; p[1].results[0].status = 'high'
  assert.equal(trajectory(p).latestVsPrevious.comparison.range.transition, 'reference_ranges_differ')
})
test('legacy status without source attribution is unknown, not presumed in range', () => {
  const p = pair(); delete p[0].results[0].status_source
  assert.equal(trajectory(p).latestVsPrevious.comparison.range.previous, 'unknown')
})
test('derived status without numeric bounds is not confirmed', () => {
  const p = pair(); Object.assign(p[0].results[0], { status_source: 'derived', reference_low: null, reference_high: null })
  assert.equal(trajectory(p).latestVsPrevious.comparison.range.previous, 'unknown')
})
test('reversed bounds cannot substantiate a derived range state', () => {
  const p = pair(); Object.assign(p[0].results[0], { status_source: 'derived', reference_low: 30, reference_high: 2 })
  assert.equal(trajectory(p).latestVsPrevious.comparison.range.previous, 'unknown')
})
test('legacy lab with missing parser metadata stays supported with unknown provenance', () => {
  const p = pair(); for (const x of p) { delete x.source_metadata; delete x.source_filename; delete x.results[0].import_confidence }
  const c = trajectory(p).latestVsPrevious.comparison
  assert.equal(c.delta, 2); assert.equal(c.current.provenance.parser, null); assert.equal(c.current.provenance.confidence, null)
})
test('legacy observation adapter can use its explicit result foreign key, but never invents one', () => {
  const p = pair(), observations = p.map(p => ({ date: p.test_date, result: p.results[0] }))
  const c = bio.compareLatest(observations)
  assert.equal(c.evidence.current.panelId, 'new'); assert.equal(c.latest.result.id, 'result-new')
  delete observations[1].result.lab_panel_id
  assert.equal(bio.compareLatest(observations), null)
})
test('same name and unit do not establish assay compatibility', () => {
  const c = trajectory(pair()).latestVsPrevious.comparison
  assert.ok(c.limitations.includes('assay_method_unknown')); assert.doesNotMatch(JSON.stringify(c), /equivalentAssay|assayConfirmed/)
})
test('unrecognized lookalike names and different assays are not heuristically merged', () => {
  for (const [a, b] of [['Glucose', 'Glucose (new method)'], ['Free Testosterone', 'Total Testosterone'], ['Marker A', 'Marker A special assay']]) assert.notEqual(bio.classifyBiomarker(a).key, bio.classifyBiomarker(b).key)
})
test('direct different-identity pair rejects regardless of matching units', () => {
  const t = trajectory(pair()), current = { ...t.dates[1], reading: { ...t.dates[1].reading, biomarkerKey: 'different' } }
  assert.ok(shared.compareLabDates(t.dates[0], current).reasons.includes('incompatible_biomarker'))
})
test('full history derivation does not mutate source content or ordering', () => {
  const p = [...three().reverse(), panel('duplicate', '2026-01-05', 10)], before = structuredClone(p), r = rows(p), beforeRows = structuredClone(r)
  bio.labTrajectory(r); bio.compareLatest(r); membership(p); context(p); obs(p)
  assert.deepEqual(p, before); assert.deepEqual(r, beforeRows)
})
test('deterministic facts are invariant to source ordering', () => {
  const p = [...three(), panel('duplicate', '2026-01-05', 10)]
  assert.deepEqual(trajectory(p), trajectory([...p].reverse()))
})

for (const [a, b] of [[10, 12], [12, 10], [10, 10], [0, 12], [-10, -8], [0.3, 0.4], [Number.MIN_VALUE, 12]]) test(`cross-consumer parity for the same source pair ${a} to ${b}`, () => {
  const p = pair(a, b), c = bio.compareLatest(rows(p)).evidence, expected = shared.labComparisonSummary(c)
  const l = obs(p).changes[0].labComparison, ai = context(p).evidence.find(e => e.type === 'lab_comparison').comparison
  const r = report.buildDoctorReport(source(p), 'all', '2026-05-01').trends[0].comparison
  assert.deepEqual(l, c); assert.deepEqual(ai, expected); assert.deepEqual(r, expected)
  assert.equal(l.previous.resultId, c.previous.resultId); assert.equal(l.current.panelId, c.current.panelId)
  const longitudinalAi = longitudinalAnalyst.longitudinalAnalystEvidence(source(p), '2026-05-01').evidence[0]
  assert.deepEqual(longitudinalAi.longitudinal.followups[0].comparison, expected)
})
test('typed Analyst comparison contains numeric facts, not parsed prose', () => {
  const e = context(pair()).evidence.find(e => e.type === 'lab_comparison')
  assert.equal(e.comparison.delta, 2); assert.equal(e.comparison.percent, 20); assert.equal(e.confidence, 'low')
  const src = readFileSync(new URL('../lib/health/analyst/evidence.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /detail\.match|Stored status: \(high/); assert.match(src, /value\.comparison\?\.percent/)
})
test('Analyst ranking uses exact percentages rather than one-decimal formatted prose', () => {
  const p = pair(100, 101.041)
  for (const x of p) x.results.push({ ...x.results[0], id: `${x.id}-second`, biomarker_name: 'Second marker', value: x.id === 'old' ? 100 : 101.049 })
  const e = analyst.buildAnalystContext(source(p), 'Which biomarkers changed the most?', '2026-05-01').evidence.filter(e => e.type === 'lab_comparison')
  assert.equal(e[0].title, 'Second marker: up'); assert.equal(e[0].comparison.percent, 1.049)
})
test('Analyst projection does not leak result/panel/owner identities or extraction metadata', () => {
  const data = source(), outputs = [JSON.parse(analystInput(context(data.panels))), JSON.parse(analystInput(analyst.buildAnalystContext(data, 'Show protocol changes around labs', '2026-05-01'))), longitudinalAnalyst.longitudinalAnalystEvidence(data, '2026-05-01')]
  for (const output of outputs) assert.doesNotMatch(JSON.stringify(output), /result-old|result-new|fictional-owner|fictional\.csv|fictional raw entry|source_raw|source_metadata|parser|rowIndex|ownerId|panelId|resultId/)
})
test('chart geometry uses shared eligibility without choosing duplicate or qualitative readings', () => {
  for (const p of [pair(10, '12'), [...pair(), panel('copy', '2026-01-31', 12)], [pair()[0], panel('new', '2026-01-31', 12, { value_text: '<12' })], pair(-Number.MAX_VALUE, Number.MAX_VALUE)]) assert.deepEqual(bio.trendChart(rows(p)).points, [])
  const missing = pair(); missing[0].results[0].unit = null
  assert.deepEqual(bio.trendChart(missing.map(p => ({ date: p.test_date, panelId: p.id, result: p.results[0] }))).points, [])
})
test('Report identity-free projection remains deterministic without AI', () => {
  const r = report.buildDoctorReport(source(), 'all', '2026-05-01')
  assert.equal(r.trends[0].comparison.delta, 2); assert.doesNotMatch(JSON.stringify(r), /result-old|result-new|fictional-owner|source_raw/)
  assert.ok(r.limitations.some(text => text.includes('Assay/method compatibility is unverified')))
})
test('no arbitrary range-transition claim from equal same-day records', () => {
  const p = [...pair(), panel('same', '2026-01-31', 12, { status: 'high' })]
  assert.ok(!context(p).facts.some(f => /Newly outside|Returned to|on both recorded dates/.test(f.text)))
})
test('foreign owner pair is rejected, including a panel/result owner mismatch', () => {
  const p = pair(); p[1].user_id = 'other-owner'; p[1].results[0].user_id = 'other-owner'
  assert.equal(bio.compareLatest(rows(p)), null); assert.equal(obs(p).changes.length, 0)
  p[1].results[0].user_id = 'fictional-owner'
  assert.ok(trajectory(p).limitations.includes('different_owners'))
})
for (const metric of ['weight', 'sleep', 'mood', 'energy', 'hunger']) test(`${metric} cannot affect shared or longitudinal lab comparisons`, () => {
  const s = source(), expected = longitudinal.buildLongitudinal(s, '2026-05-01')
  s.journal = [{ id: 'journal-secret', date: '2026-01-05', [metric]: 3 }, { id: 'journal-secret-2', date: '2026-01-31', [metric]: 9 }]
  assert.deepEqual(longitudinal.buildLongitudinal(s, '2026-05-01'), expected)
  assert.deepEqual(trajectory(s.panels), trajectory(pair()))
  assert.doesNotMatch(JSON.stringify(longitudinalAnalyst.longitudinalAnalystEvidence(s, '2026-05-01')), /journal-secret/)
})
test('shared module performs no queries, provider calls, persistence or journal normalization', () => {
  const src = readFileSync(new URL('../lib/health/labEvidence.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /supabase|fetch\(|\.from\(|\.insert\(|\.update\(|\.journal|\.weight|OpenAI/)
  assert.match(src, /^import type/)
})
test('existing owner-scoped bulk loaders remain outside the evidence engine', () => {
  const loader = readFileSync(new URL('../lib/health/longitudinal/load.ts', import.meta.url), 'utf8')
  assert.match(loader, /loadHealthSourceData\(client, userId\)/)
  const context = readFileSync(new URL('../lib/health/analyst/context.ts', import.meta.url), 'utf8')
  assert.match(context, /\.eq\('user_id', userId\)/)
  const src = readFileSync(new URL('../lib/health/longitudinal/engine.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(src, /supabase|fetch\(|\.from\(/)
})
test('same-day panels do not acquire chronology from IDs', () => {
  const p = pair(); p[1].test_date = p[0].test_date
  assert.equal(membership(p)[0].change, 'unordered_panels')
  assert.ok(context(p).gaps.some(gap => /within-day order is unknown/.test(gap.text)))
  assert.ok(!context(p).facts.some(fact => /newly measured|newly outside/i.test(fact.text)))
})
