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
test('report service reuses the analyst source and evidence layer', () => { const text = readFileSync(new URL('../lib/health/report/service.ts', import.meta.url), 'utf8'); assert.match(text, /loadHealthSourceData/); assert.match(text, /buildAnalystContext/); assert.match(text, /analyzeHealthContext/) })
test('owner scoping remains centralized in analyst context loading', () => { const text = readFileSync(new URL('../lib/health/analyst/context.ts', import.meta.url), 'utf8'); assert.ok((text.match(/\.eq\('user_id', userId\)/g) ?? []).length >= 3) })
test('report model contains no database ID fields', () => { const value = JSON.stringify(report()); assert.ok(!/"(?:id|user_id|protocol_id|compound_id|lab_panel_id)"/.test(value)) })
test('model API key remains server-only', () => { const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8'); assert.ok(!client.includes('OPENAI_API_KEY')); assert.ok(!client.includes('NEXT_PUBLIC_OPENAI')) })
test('preview exposes date range and section controls', () => { const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8'); for (const label of ['3 months', '6 months', '12 months', 'All history', 'Current protocols', 'Labs and trends']) assert.ok(client.includes(label)) })
test('presentation-only section toggles do not invoke report generation', () => { const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8'); assert.match(client, /setSections\(value/); assert.match(client, /without another AI request/) })
test('PDF export uses a deterministic report model and native print', () => { const client = readFileSync(new URL('../components/health/DoctorReport.tsx', import.meta.url), 'utf8'); assert.match(client, /window\.print\(\)/); assert.match(client, /response\?\.report/) })
test('print CSS uses a light paper surface and hides app controls', () => { const css = readFileSync(new URL('../app/health/report/report.module.css', import.meta.url), 'utf8'); assert.match(css, /@media print/); assert.match(css, /background: #fff/); assert.match(css, /\.app-tab-bar/) })
test('mobile preview has a focused narrow-screen layout', () => { const css = readFileSync(new URL('../app/health/report/report.module.css', import.meta.url), 'utf8'); assert.match(css, /@media \(max-width: 520px\)/); assert.match(css, /min-height: 44px/) })
test('export route handles failure without exposing database details', () => { const route = readFileSync(new URL('../app/api/health-report/route.ts', import.meta.url), 'utf8'); assert.match(route, /Your health data was not changed/); assert.ok(!route.includes('error.message')) })
test('health entry point links to the report without changing Labs routing', () => { const dashboard = readFileSync(new URL('../components/health/HealthDashboard.tsx', import.meta.url), 'utf8'); assert.match(dashboard, /href="\/health\/report"/); assert.match(dashboard, /href="\/health"/) })
