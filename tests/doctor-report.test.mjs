import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
function load(path) {
  const url = path.startsWith('file:') ? new URL(path) : new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const out = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'server-only') return {}
    if (!name.startsWith('.')) return require(name)
    for (const suffix of ['', '.ts']) { try { return load(new URL(name + suffix, url).href) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    throw new Error(`Missing module ${name}`)
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}

const model = load('../lib/health/report/model.ts')
const service = load('../lib/health/report/service.ts')
const labResult = (id, name, value, unit = 'mg/dL', status = 'normal', extra = {}) => ({ id, lab_panel_id: 'panel', user_id: 'owner', biomarker_name: name, canonical_name: null, value, value_text: null, unit, reference_low: 5, reference_high: 20, reference_text: null, status, status_source: 'reported', category: null, ...extra })
const panel = (id, date, results) => ({ id, user_id: 'owner', test_date: date, panel_name: `Panel ${id}`, provider: 'Clinic', notes: 'private panel note', source_type: 'manual', created_at: date, updated_at: date, results: results.map(row => ({ ...row, lab_panel_id: id })) })
const phase = (id, start, end, dose = 5, unit = 'mg', version = 1) => ({ id, start_week: start, end_week: end, dose, dose_unit: unit, dose_semantics_version: version, frequency: '1x/week', days_of_week: [1], route: 'SubQ' })
const protocol = (overrides = {}) => ({ id: 'p1', name: 'Plan', start_date: '2026-05-01', status: 'active', completed_date: null, compounds: [{ id: 'c1', name: 'Example compound', route: 'SubQ', phases: [phase('old', 1, 4), phase('current', 5, null, 3)] }], ...overrides })
const journal = (id, date, extra = {}) => ({ id, date, notes: 'private journal note', weight: null, mood: null, energy: null, sleep: null, hunger: null, ...extra })
const event = (id, date, extra = {}) => ({ id, date, event_type: 'dose_change', description: 'Recorded change', protocol_id: 'p1', compound_id: 'c1', metadata: { version: 1, previousDose: 5, previousUnit: 'mg', newDose: 3, newUnit: 'mg' }, ...extra })
const source = (extra = {}) => ({ protocols: [protocol()], protocolEvents: [event('e1', '2026-06-01')], panels: [panel('new', '2026-09-01', [labResult('new-r', 'Glucose', 15)]), panel('old', '2026-08-01', [labResult('old-r', 'Glucose', 10)])], journal: [journal('j1', '2026-08-01', { weight: 185, mood: 3 }), journal('j2', '2026-09-01', { weight: 180, mood: 4, energy: 4, sleep: 7 })], ...extra })
const report = (extra = {}, range = '6m') => model.buildDoctorReport(source(extra), range, '2026-09-10')

test('current protocol summary uses confirmed medication dose', () => assert.equal(report().currentProtocols[0].dose, '3 mg'))
test('current protocol summary includes structured frequency and route', () => assert.deepEqual([report().currentProtocols[0].frequency, report().currentProtocols[0].route], ['weekly', 'SubQ']))
test('unverified dose is labeled without substituting administration volume', () => {
  const p = protocol({ compounds: [{ id: 'c1', name: 'Unknown dose', phases: [phase('legacy', 1, null, 50, 'IU', null)] }] }); const row = report({ protocols: [p] }).currentProtocols[0]; assert.equal(row.dose, 'Dose not confirmed'); assert.equal(row.verified, false)
})
test('protocol history is ordered newest first', () => { const rows = report({ protocolEvents: [event('a', '2026-06-01'), event('b', '2026-08-01')] }).protocolHistory; assert.ok(rows.every((row, i) => !i || rows[i - 1].date >= row.date)) })
test('structured history is identified separately from legacy history', () => { const rows = report({ protocolEvents: [event('a', '2026-06-01'), event('b', '2026-07-01', { metadata: null })] }).protocolHistory; assert.ok(rows.some(row => row.source === 'Structured protocol event')); assert.ok(rows.some(row => row.source === 'Legacy protocol event')) })
test('later current dose is not substituted into historical phase change', () => assert.ok(report().protocolHistory.some(row => row.detail === '5 mg → 3 mg')))
test('same-unit repeated labs produce a deterministic trend', () => { const trend = report().trends[0]; assert.equal(trend.delta, 5); assert.equal(trend.percent, 50) })
test('Doctor Report projects shared facts and retains explicit comparison limitations', () => {
  const r = report(), trend = r.trends[0]
  assert.equal(trend.comparison.delta, trend.delta); assert.equal(trend.comparison.percent, trend.percent)
  assert.equal(trend.comparison.previous.date, trend.previousDate); assert.equal(trend.comparison.current.date, trend.latestDate)
  assert.ok(r.limitations.some(text => /Assay\/method compatibility is unverified/.test(text)))
  assert.doesNotMatch(JSON.stringify(trend.comparison), /resultId|panelId|ownerId|source_raw/)
})
test('duplicate same-day lab sources cannot create a deterministic Report trend', () => {
  const data = source(); data.panels.push(panel('same-day', '2026-09-01', [labResult('same-day-result', 'Glucose', 15)]))
  assert.equal(model.buildDoctorReport(data, 'all', '2026-09-10').trends.length, 0)
})
test('different-unit results are never compared', () => { const panels = [panel('new', '2026-09-01', [labResult('n', 'Glucose', 5, 'mmol/L')]), panel('old', '2026-08-01', [labResult('o', 'Glucose', 90, 'mg/dL')])]; assert.equal(report({ panels }).trends.length, 0) })
test('outside-range rows use only supplied reference text', () => { const rows = [panel('new', '2026-09-01', [labResult('n', 'Marker', 30, 'mg/dL', 'high', { reference_low: 10, reference_high: 20 })])]; assert.equal(report({ panels: rows }).highlightedResults[0].reference, '10–20') })
test('missing reference range is never invented', () => { const rows = [panel('new', '2026-09-01', [labResult('n', 'Marker', 30, 'mg/dL', 'high', { reference_low: null, reference_high: null })])]; assert.equal(report({ panels: rows }).highlightedResults[0].reference, 'Reference not supplied') })
test('qualitative abnormal labs are represented as text, not trends', () => { const rows = [panel('new', '2026-09-01', [labResult('n', 'Marker', null, '', 'abnormal', { value_text: 'Detected' })])], value = report({ panels: rows }); assert.equal(value.highlightedResults[0].value, 'Detected'); assert.equal(value.trends.length, 0) })
test('weight delta is deterministic', () => assert.equal(report().weight.delta, -5))
test('weight points are chronological and preserve recorded values', () => assert.deepEqual(report().weight.points.map(point => point.value), [185, 180]))
test('structured journal values are summarized', () => assert.equal(report().journal.averages.find(item => item.label === 'Mood').value, 3.5))
test('sparse journal returns a calm empty model', () => assert.equal(report({ journal: [] }).journal, null))
test('journal free text is excluded from the report model', () => assert.ok(!JSON.stringify(report()).includes('private journal note')))
test('panel notes and internal provenance are excluded', () => assert.ok(!JSON.stringify(report()).includes('private panel note')))
test('legacy history adds an automatic limitation', () => assert.ok(report({ protocolEvents: [event('legacy', '2026-06-01', { metadata: null })] }).limitations.some(item => /legacy or unstructured/.test(item))))
test('missing ranges add an automatic limitation', () => { const panels = [panel('new', '2026-09-01', [labResult('n', 'Marker', 1, '', 'unknown', { reference_low: null, reference_high: null })])]; assert.ok(report({ panels }).limitations.some(item => /no supplied reference range/.test(item))) })
test('one-reading biomarkers add an automatic limitation', () => { const panels = [panel('new', '2026-09-01', [labResult('n', 'Marker', 1)])]; assert.ok(report({ panels }).limitations.some(item => /only one recorded reading/.test(item))) })
test('protocol and lab timing is neutral and deterministic', () => { const value = report({ protocolEvents: [event('near', '2026-08-20')] }).protocolLabContext.find(item => item.labDate === '2026-09-01'); assert.equal(value.timing, 'Recorded 12 days before the lab') })
test('deterministic report copy makes no causal or diagnostic claims', () => { const text = JSON.stringify(report()); assert.ok(!/\bcaused\b|\byou have\b|\bdiagnos/i.test(text)) })
test('three-month filtering excludes older panels, events, and journal rows', () => { const value = report({}, '3m'); assert.ok(value.labPanels.every(row => row.date >= '2026-06-10')); assert.ok(value.protocolHistory.every(row => row.date >= '2026-06-10')); assert.equal(value.weight.earliestDate, '2026-08-01') })
test('all-history range has no artificial start date', () => assert.equal(model.reportStartDate('all', '2026-09-10'), null))
test('month subtraction clamps end-of-month dates', () => assert.equal(model.reportStartDate('3m', '2026-05-31'), '2026-02-28'))
test('trend prioritization is capped and puts supplied flags first', () => {
  const oldRows = [], newRows = []; for (let i = 0; i < 20; i++) { oldRows.push(labResult(`o${i}`, `Marker ${i}`, 10)); newRows.push(labResult(`n${i}`, `Marker ${i}`, i === 19 ? 25 : 11, 'mg/dL', i === 19 ? 'high' : 'normal')) }
  const trends = report({ panels: [panel('new', '2026-09-01', newRows), panel('old', '2026-08-01', oldRows)] }).trends; assert.equal(trends.length, 12); assert.equal(trends[0].flagged, true)
})
test('AI failure does not block deterministic report output', async () => { const response = await service.createDoctorReportFromSource(source(), '6m', true, '2026-09-10', { generate: async () => { throw new Error('down') } }); assert.ok(response.report.labPanels.length); assert.equal(response.aiSummary, null); assert.match(response.aiError, /deterministic report is complete/) })
test('AI failure invokes optional classified monitoring without blocking deterministic output', async () => { let captured = null; const failure = new Error('down'); const response = await service.createDoctorReportFromSource(source(), '6m', true, '2026-09-10', { generate: async () => { throw failure } }, error => { captured = error }); assert.equal(captured, failure); assert.ok(response.report.labPanels.length); assert.equal(response.aiSummary, null) })
test('AI-disabled generation never calls a provider', async () => { let called = false; const response = await service.createDoctorReportFromSource(source(), '6m', false, '2026-09-10', { generate: async () => { called = true } }); assert.equal(called, false); assert.equal(response.aiSummary, null) })
test('report AI receives only bounded deterministic report facts and returns wording only', async () => {
  let received = null
  const response = await service.createDoctorReportFromSource(source(), '6m', true, '2026-09-10', { generate: async context => {
    received = context
    return { summary: 'Recorded labs show a glucose change alongside one current protocol item. Comparison limitations remain documented below.', findings: [], uncertainties: [], nextObservations: [] }
  } })
  assert.deepEqual(response.aiSummary, { overview: 'Recorded labs show a glucose change alongside one current protocol item. Comparison limitations remain documented below.' })
  assert.equal(received.scope, 'Doctor Report wording over deterministic report intelligence only')
  assert.ok(received.evidence.length > 0 && received.evidence.length <= 23)
  assert.match(received.question, /ONLY the supplied deterministic facts/)
  assert.match(received.question, /Return findings, uncertainties, and nextObservations as empty arrays/)
  assert.doesNotMatch(JSON.stringify(received), /private journal note|private panel note|source_raw|user_id/)
})
test('report AI adapter is wording-only and has no database or provider dependency', () => {
  const text = readFileSync(new URL('../lib/health/report/ai.ts', import.meta.url), 'utf8')
  assert.match(text, /buildReportAiContext/); assert.match(text, /toReportAiSummary/)
  assert.doesNotMatch(text, /fetch\(|supabase|OPENAI_API_KEY|createHealthAnalystProvider/)
})
test('report service keeps owner-scoped loading and uses bounded report-specific AI context', () => { const text = readFileSync(new URL('../lib/health/report/service.ts', import.meta.url), 'utf8'); assert.match(text, /loadHealthSourceData/); assert.match(text, /buildReportAiContext/); assert.match(text, /analyzeHealthContext/); assert.doesNotMatch(text, /buildAnalystContext/) })
test('owner scoping remains centralized in analyst context loading', () => { const text = readFileSync(new URL('../lib/health/analyst/context.ts', import.meta.url), 'utf8'); assert.ok((text.match(/\.eq\('user_id', userId\)/g) ?? []).length >= 3) })
test('legacy report display fields contain no database ID fields', () => { const { intelligence, ...legacy } = report(); assert.ok(intelligence); const value = JSON.stringify(legacy); assert.ok(!/"(?:id|user_id|protocol_id|compound_id|lab_panel_id)"/.test(value)) })
test('model API key remains server-only', () => { const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8'); assert.ok(!client.includes('OPENAI_API_KEY')); assert.ok(!client.includes('NEXT_PUBLIC_OPENAI')) })
test('preview exposes report period controls and the locked intelligence hierarchy', () => { const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8'); for (const label of ['3 months', '6 months', '12 months', 'All history', 'Key Context Notes', 'Longitudinal Biomarker Domains', 'Recorded Protocol Timeline', 'Top Headline Changes', 'Items to Review', 'Data Verification &amp; Limitations']) assert.ok(client.includes(label)) })
test('V2 report removes legacy section checkboxes and renders intelligence instead', () => { const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8'); assert.doesNotMatch(client, /setSections|sectionLabels|Current protocols.*checkbox|Journal summary/); assert.match(client, /report\.intelligence/) })
test('PDF export uses a deterministic report model and native print', () => { const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8'); assert.match(client, /window\.print\(\)/); assert.match(client, /response\?\.report/) })
test('V2 report does not render legacy confidence badges, journal averages, weight chart, or generic Analyst findings', () => {
  const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(client, /data confidence|Structured journal summary|Weight trend|Largest recorded biomarker changes|aiSummary\.findings|What to watch next/)
  assert.match(client, /aiSummary\.overview/)
})
test('V2 report presentation is scan-first and bounded', () => {
  const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8')
  assert.match(client, /protocolTimeline\.slice\(0, 16\)/)
  assert.match(client, /headlineChanges\.map/)
  assert.match(client, /reviewItems\.map/)
  assert.match(client, /verification\.map/)
  assert.match(client, /Same-day ambiguity is never averaged/)
})
test('print CSS uses a light paper surface and hides app controls', () => { const css = readFileSync(new URL('../app/health/report/report.module.css', import.meta.url), 'utf8'); assert.match(css, /@media print/); assert.match(css, /background: #fff/); assert.match(css, /\.app-tab-bar/) })
test('mobile preview has a focused narrow-screen layout', () => { const css = readFileSync(new URL('../app/health/report/report.module.css', import.meta.url), 'utf8'); assert.match(css, /@media \(max-width: 520px\)/); assert.match(css, /min-height: 44px/) })
test('export route handles failure without exposing database details', () => { const route = readFileSync(new URL('../app/api/health-report/route.ts', import.meta.url), 'utf8'); assert.match(route, /Your health data was not changed/); assert.ok(!route.includes('error.message')) })
test('health entry point links to the report without changing Labs routing', () => { const dashboard = readFileSync(new URL('../components/health/HealthDashboard.tsx', import.meta.url), 'utf8'); assert.match(dashboard, /href="\/health\/report"/); assert.match(dashboard, /href="\/health"/) })

const labs = load('../lib/health/labs.ts')
const canonicalFindings = load('../lib/health/labFindings.ts')
const currentFindings = load('../lib/health/labFindingsSummary.ts')
const canonicalHistory = load('../lib/health/longitudinal/history.ts')
const canonicalInterventions = load('../lib/health/longitudinal/interventions.ts')
const intelligence = (extra = {}, range = '6m') => report(extra, range).intelligence
const biomarkerRows = value => value.biomarkerDomains.flatMap(domain => domain.rows)
const datedPanels = (dates, name = 'Glucose') => dates.map((date, i) => panel(`date-${i}`, date, [labResult(`result-${i}`, name, i + 8)]))
const snapshot = (id, dose, extra = {}) => ({ phaseId: id, startWeek: 1, endWeek: null, medicationDose: dose, medicationUnit: 'mg', doseConfirmed: true, frequency: 'weekly', route: 'SubQ', ...extra })

test('V2A intelligence is deterministic without AI, IO, or provider dependencies', async () => {
  const response = await service.createDoctorReportFromSource(source(), '6m', false, '2026-09-10', { generate: () => { assert.fail('No AI requested') } })
  assert.deepEqual(Object.keys(response.report.intelligence), ['contextNotes', 'biomarkerDomains', 'protocolTimeline', 'headlineChanges', 'reviewItems', 'verification'])
  assert.deepEqual(response.report.intelligence, intelligence())
  const implementation = readFileSync(new URL('../lib/health/report/intelligence.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(implementation, /fetch\(|supabase|provider|from ['"].*analyst|\.insert\(|\.update\(/)
})
test('V2A context is bounded and records the report period, unique latest date and active item count', () => {
  const notes = intelligence().contextNotes
  assert.ok(notes.length <= 4)
  assert.deepEqual(notes.find(n => n.kind === 'period'), { kind: 'period', start: '2026-03-10', end: '2026-09-10' })
  assert.deepEqual(notes.find(n => n.kind === 'latest_panel'), { kind: 'latest_panel', date: '2026-09-01' })
  assert.equal(notes.find(n => n.kind === 'active_items').count, 1)
})
test('V2A domains reuse canonical identity/category and retain unknown markers as Other', () => {
  const panels = [panel('p', '2026-09-01', [labResult('a', 'TESTOSTERONE, FREE', 11, 'pg/mL'), labResult('b', 'Unclassified marker', 4)])]
  const value = intelligence({ panels })
  assert.equal(value.biomarkerDomains.find(d => d.category === 'Hormones').rows[0].biomarkerKey, 'testosterone-free')
  assert.equal(value.biomarkerDomains.find(d => d.category === 'Other').rows[0].biomarkerKey, 'raw:unclassified marker')
  assert.equal(biomarkerRows(value)[0].readings[0].reference.status, 'normal')
})
test('V2A selects at most four dates using chronology and retains latest, comparator and period earliest', () => {
  const panels = datedPanels(['2026-02-01', '2026-03-15', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'])
  const row = biomarkerRows(intelligence({ panels }))[0]
  assert.deepEqual(row.readings.map(r => r.date), ['2026-03-15', '2026-05-01', '2026-08-01', '2026-09-01'])
  assert.equal(row.comparison.previous.date, '2026-08-01')
  assert.equal(row.comparison.current.date, '2026-09-01')
  assert.deepEqual(biomarkerRows(intelligence({ panels: [...panels].reverse() }))[0], row)
})
for (const value of [15, 99]) test(`V2A same-day ${value === 15 ? 'equal' : 'conflicting'} readings are never chosen`, () => {
  const panels = [...source().panels, panel('duplicate', '2026-09-01', [labResult('dup', 'Glucose', value)])]
  const result = intelligence({ panels }), row = biomarkerRows(result)[0]
  assert.deepEqual(row.readings.map(r => r.date), ['2026-08-01'])
  assert.equal(row.latestRecordedDate, '2026-09-01'); assert.equal(row.comparison, null)
  assert.equal(result.headlineChanges.length, 0)
  assert.ok(!result.contextNotes.some(n => n.kind === 'latest_panel'))
  assert.ok(result.verification.some(v => v.code === 'same_day_results'))
})
test('V2A missing and incompatible units remain separate with no fabricated comparisons', () => {
  const panels = [panel('new', '2026-09-01', [labResult('n', 'Glucose', 5, 'mmol/L')]), panel('old', '2026-08-01', [labResult('o', 'Glucose', 90)]), panel('missing', '2026-07-01', [labResult('m', 'Glucose', 80, '')])]
  const rows = biomarkerRows(intelligence({ panels }))
  assert.equal(rows.length, 3); assert.ok(rows.every(row => row.comparison === null))
  assert.equal(rows.find(row => row.unit === '').readings.length, 0)
  assert.ok(intelligence({ panels }).verification.some(v => v.code === 'measurement_units'))
})
test('V2A explicitly method-qualified identities are not merged', () => {
  const panels = [panel('new', '2026-09-01', [labResult('n', 'Free Testosterone (Dialysis)', 15, 'pg/mL')]), panel('old', '2026-08-01', [labResult('o', 'TESTOSTERONE, FREE', 10, 'pg/mL')])]
  const rows = biomarkerRows(intelligence({ panels }))
  assert.equal(new Set(rows.map(row => row.biomarkerKey)).size, 2)
  assert.ok(rows.every(row => row.comparison === null && row.limitations.includes('assay_method_unknown')))
})
test('V2A headlines exactly match canonical current finding ranking and cap of five', () => {
  const oldRows = [], newRows = []
  for (let i = 0; i < 9; i++) { oldRows.push(labResult(`o-${i}`, `Marker ${i}`, 10)); newRows.push(labResult(`n-${i}`, `Marker ${i}`, i + 21, 'mg/dL', 'high')) }
  const panels = [panel('new', '2026-09-01', newRows), panel('old', '2026-08-01', oldRows)]
  const expected = canonicalFindings.selectHeadlineFindings(currentFindings.deriveCurrentLabFindingSet(panels, labs.biomarkerHistories(panels)).findings, 5)
  assert.equal(expected.length, 5); assert.deepEqual(intelligence({ panels }).headlineChanges, expected)
  assert.equal(expected[0].type, 'newly_outside_range')
  assert.equal(expected[0].evidence.comparison.range.transition, 'newly_outside')
})
test('V2A preserves changed-range and unknown-prior uncertainty and zero baseline arithmetic', () => {
  const panels = [panel('new', '2026-09-01', [labResult('n', 'Marker', 30, 'mg/dL', 'high')]), panel('old', '2026-08-01', [labResult('o', 'Marker', 0, 'mg/dL', 'unknown', { reference_high: 25, status_source: 'unknown' })])]
  const row = biomarkerRows(intelligence({ panels }))[0]
  assert.equal(row.comparison.percent, null)
  assert.equal(row.comparison.range.transition, 'prior_status_unknown')
  assert.ok(intelligence({ panels }).headlineChanges.every(f => f.type !== 'newly_outside_range'))
})
test('V2A protocol timeline preserves canonical event, protocol, compound and phase identities', () => {
  const data = source({ protocols: [protocol(), protocol({ id: 'p2', compounds: [{ id: 'c2', name: 'Example compound', phases: [phase('different-phase', 1, null)] }] })] })
  const value = model.buildDoctorReport(data, '6m', '2026-09-10').intelligence
  const expected = canonicalInterventions.detectInterventions(data, '2026-09-10').filter(item => item.date >= '2026-03-10')
  assert.deepEqual(value.protocolTimeline.map(({ contextDate, recordedStates, ...item }) => item), expected)
  assert.ok(value.protocolTimeline.some(item => item.protocolId === 'p1'))
  assert.ok(value.protocolTimeline.some(item => item.protocolId === 'p2'))
  for (const item of value.protocolTimeline) for (const state of item.recordedStates) {
    assert.equal(state.protocolId, item.protocolId)
    if (item.compoundId) assert.equal(state.compoundId, item.compoundId)
    if (item.phaseId) assert.equal(state.phaseId, item.phaseId)
  }
})
test('V2A historical replay uses snapshots outside report period instead of substituting current dose backward', () => {
  const p = protocol({ compounds: [{ id: 'c1', name: 'Recorded compound', phases: [phase('one', 1, null, 9)] }] })
  const events = [event('edit', '2026-09-01', { metadata: { version: 1, phaseId: 'one', previousState: snapshot('one', 5), newState: snapshot('one', 9) } })]
  const data = source({ protocols: [p], protocolEvents: events })
  const value = model.buildDoctorReport(data, '6m', '2026-09-10')
  assert.equal(value.intelligence.protocolTimeline.find(item => item.kind === 'started').recordedStates[0].medication.value, 5)
  assert.equal(value.intelligence.protocolTimeline.find(item => item.id === 'event:edit').after.value, 9)
  assert.equal(value.currentProtocols[0].dose, '9 mg')
  const past = model.buildDoctorReport(data, 'all', '2026-08-01')
  assert.equal(past.currentProtocols[0].dose, '5 mg')
  assert.ok(past.intelligence.protocolTimeline.every(item => item.date <= '2026-08-01'))
})
test('V2A completed boundary has no current state or fabricated post-completion dose', () => {
  const p = protocol({ status: 'completed', completed_date: '2026-09-10' })
  const r = report({ protocols: [p] })
  assert.equal(r.currentProtocols.length, 0)
  const ended = r.intelligence.protocolTimeline.find(item => item.kind === 'stopped')
  assert.equal(ended.recordedStates.length, 0)
})
test('V2A current protocol rows directly preserve canonical medication/schedule/route state', () => {
  const states = canonicalHistory.healthStateAtDate(source(), '2026-09-10')
  const current = report().currentProtocols[0]
  assert.equal(current.dose, `${states[0].medication.value} ${states[0].medication.unit}`)
  assert.equal(current.frequency, states[0].frequency); assert.equal(current.route, states[0].route)
})
for (const [unit, dose, version, expected] of [['mg', 3, 1, '3 mg'], ['mcg', 150, 1, '150 mcg'], ['IU', 250, 1, '250 IU'], ['IU', 18, null, 'Dose not confirmed'], ['mL', 0.18, 1, 'Dose not confirmed']]) {
  test(`V2A dose separation: ${dose} ${unit}, semantics ${version}`, () => {
    const p = protocol({ compounds: [{ id: 'c1', name: 'Fictional medication', phases: [{ ...phase('one', 1, null, dose, unit, version), syringe_units: 18, syringe_scale: 100, injection_volume_ml: 0.18 }] }] })
    const r = report({ protocols: [p], protocolEvents: [] })
    assert.equal(r.currentProtocols[0].dose, expected)
    const medication = r.intelligence.protocolTimeline[0].recordedStates[0].medication
    assert.deepEqual(medication, expected === 'Dose not confirmed' ? null : { value: dose, unit })
  })
}
test('V2A verification is deduplicated and bounded, review items are descriptive and bounded', () => {
  const oldRows = [], newRows = []
  for (let i = 0; i < 12; i++) { oldRows.push(labResult(`o-${i}`, `Marker ${i}`, 10)); newRows.push(labResult(`n-${i}`, `Marker ${i}`, 30, 'mg/dL', 'high')) }
  const value = intelligence({ panels: [panel('new', '2026-09-01', newRows), panel('old', '2026-08-01', oldRows)] })
  assert.ok(value.reviewItems.length <= 5); assert.ok(value.verification.length <= 6)
  assert.equal(new Set(value.verification.map(item => item.code)).size, value.verification.length)
  assert.equal(value.verification.filter(item => item.code === 'assay_method').length, 1)
  assert.ok(value.reviewItems.every(item => item.text.includes('supplied range')))
  assert.doesNotMatch(JSON.stringify(value), /\bcaused\b|\bdiagnosis\b|\burgent\b|\bdangerous\b|you should|order this test|normal for (you|this person)|treatment effect/i)
  assert.ok(value.protocolTimeline.every(item => item.contextDate === item.date))
})
test('V2A no-data output contains real gaps, not filler or invented readings', () => {
  const value = intelligence({ panels: [], protocols: [], protocolEvents: [], journal: [] })
  assert.equal(value.biomarkerDomains.length, 0); assert.equal(value.headlineChanges.length, 0)
  assert.equal(value.protocolTimeline.length, 0)
  assert.deepEqual(value.verification, [{ code: 'no_labs', text: 'No lab panels are recorded in the selected report period.' }])
})
test('V2A identities are traceable but raw document and owner metadata are excluded', () => {
  const panels = source().panels.map(p => ({ ...p, source_filename: 'PRIVATE_FILENAME', source_metadata: { raw: 'PRIVATE_EXTRACTION' }, results: p.results.map(r => ({ ...r, source_raw: 'PRIVATE_RESULT' })) }))
  const value = intelligence({ panels }), row = biomarkerRows(value)[0]
  assert.equal(row.readings[0].resultId, 'old-r'); assert.equal(row.readings[0].panelId, 'old')
  assert.doesNotMatch(JSON.stringify(value), /PRIVATE_|ownerId|user_id|private journal note|private panel note/)
})
test('V2A existing fields remain populated alongside intelligence', () => {
  const value = report({ protocolEvents: [event('near-labs', '2026-08-20')] })
  for (const key of ['currentProtocols', 'protocolHistory', 'labPanels', 'trends', 'protocolLabContext', 'limitations']) assert.ok(value[key].length, key)
  assert.ok(value.weight); assert.ok(value.journal); assert.ok(value.generatedAt); assert.equal(value.range, '6m')
})
test('V2A does not mutate source data and journal values cannot affect biomarker domains or headlines', () => {
  const data = source(), before = structuredClone(data)
  const a = model.buildDoctorReport(data, 'all', '2026-09-10').intelligence
  assert.deepEqual(data, before)
  const b = model.buildDoctorReport({ ...data, journal: [] }, 'all', '2026-09-10').intelligence
  assert.deepEqual(a.biomarkerDomains, b.biomarkerDomains); assert.deepEqual(a.headlineChanges, b.headlineChanges)
})

// Doctor Report V2D — compression + classification polish
test('V2D renders compact longitudinal domain tables without repeated no-comparison prose', () => {
  const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8')
  assert.match(client, /domainTableHeader/)
  assert.match(client, /biomarkerChange/)
  assert.match(client, /rows\.filter\(row => row\.readings\.length > 0\)/)
  assert.doesNotMatch(client, /No eligible comparison/)
})

test('V2D keeps incomplete numeric evidence out of primary tables and summarizes it for verification', () => {
  const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8')
  assert.match(client, /incompleteMarkerCount/)
  assert.match(client, /incomplete numeric evidence/)
  assert.match(client, /summarized under verification/)
})

test('V2D explicit biomarker aliases improve domain classification without fuzzy method stripping', () => {
  const registry = load('../lib/health/biomarkerIntelligence.ts')
  for (const name of ['Apolipoprotein B (ApoB)', 'LDL Particle Number', 'LDL Small', 'LDL Medium', 'LDL Peak Size', 'HDL Large', 'Non-HDL Cholesterol']) {
    assert.equal(registry.classifyBiomarker(name).category, 'Lipids', name)
  }
  for (const name of ['Dihydrotestosterone (DHT)', 'Estradiol (E2)', 'Follicle Stimulating Hormone (FSH)', 'Luteinizing Hormone (LH)', 'Sex Hormone Binding Globulin (SHBG)', 'DHEA Sulfate']) {
    assert.equal(registry.classifyBiomarker(name).category, 'Hormones', name)
  }
  for (const name of ['Mean Corpuscular Volume', 'Mean Corpuscular Hemoglobin', 'Mean Corpuscular Hemoglobin Concentration', 'Red Blood Cell Count']) {
    assert.equal(registry.classifyBiomarker(name).category, 'CBC / Blood', name)
  }
  assert.equal(registry.classifyBiomarker('TESTOSTERONE, TOTAL, MS').key, 'testosterone-total')
  assert.equal(registry.classifyBiomarker('TESTOSTERONE, FREE').key, 'testosterone-free')
  assert.notEqual(registry.classifyBiomarker('Free Testosterone (Dialysis)').key, 'testosterone-free')
})

test('V2D report formatting rounds percentages for display only', () => {
  const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8')
  assert.match(client, /toFixed\(digits\)/)
  assert.match(client, /FindingEvidence finding=\{finding\}/)
  const shared = readFileSync(new URL('../components/health/LabFindingsSummary.tsx', import.meta.url), 'utf8')
  assert.match(shared, /formatPercent\(comparison\.percent\)/)
  assert.match(client, /signedPercent\(row\.comparison\.percent\)/)
})

test('V2D protocol timeline suppresses equal dose transitions and repeated provenance caveats', () => {
  const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8')
  assert.match(client, /sameMedication/)
  assert.match(client, /!sameMedication\(item\.before, item\.after\)/)
  assert.doesNotMatch(client, /item\.limitations\[0\]/)
  const types = readFileSync(new URL('../lib/health/report/types.ts', import.meta.url), 'utf8')
  assert.match(types, /ReportProtocolTimelineItem/)
})

test('V2D separates specific review items from report-wide verification limitations', () => {
  const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8')
  assert.match(client, /findingIds\.length > 0/)
  assert.match(client, /reviewSet/)
  assert.match(client, /verification\.filter\(item => !reviewSet\.has\(item\.text\)\)/)
  assert.match(client, /slice\(0, 5\)/)
  assert.match(client, /slice\(0, 6\)/)
})

test('V2D AI overview is scan-first and humanizes ISO dates without generating new facts', () => {
  const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8')
  assert.match(client, /overviewBullets/)
  assert.match(client, /response\.aiSummary\.overview/)
  assert.match(client, /<ul>\{overviewBullets/)
  assert.match(client, /\\b\(\\d\{4\}-\\d\{2\}-\\d\{2\}\)\\b/)
})

test('V2D print CSS keeps compact rows intact and section headings with following content', () => {
  const css = readFileSync(new URL('../app/health/report/report.module.css', import.meta.url), 'utf8')
  assert.match(css, /\.sectionTitle[^}]*break-after:\s*avoid/s)
  assert.match(css, /\.domainHeading[^}]*break-after:\s*avoid/s)
  assert.match(css, /\.biomarkerRow[^}]*break-inside:\s*avoid/s)
  assert.match(css, /\.timeline li[^}]*break-inside:\s*avoid/s)
})

test('V2D mobile biomarker rows collapse without requiring horizontal scrolling', () => {
  const css = readFileSync(new URL('../app/health/report/report.module.css', import.meta.url), 'utf8')
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.domainTableHeader \{ display: none; \}/)
  assert.match(css, /\.biomarkerRow \{ grid-template-columns: minmax\(0, 1fr\) auto;/)
  assert.doesNotMatch(css, /overflow-x:\s*(?:auto|scroll)/)
})

test('V2D preserves the locked six-section report hierarchy', () => {
  const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8')
  const headings = ['Key Context Notes', 'Longitudinal Biomarker Domains', 'Recorded Protocol Timeline', 'Top Headline Changes', 'Items to Review', 'Data Verification &amp; Limitations']
  for (const heading of headings) assert.ok(client.includes(heading), heading)
})
