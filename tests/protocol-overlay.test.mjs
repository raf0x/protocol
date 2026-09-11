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
    if (!name.startsWith('.')) return require(name)
    for (const suffix of ['', '.ts']) { try { return load(new URL(name + suffix, url).href) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    throw new Error(`Missing ${name}`)
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}

const overlay = load('../lib/health/protocolOverlay.ts')
const { readProtocolOverlay } = load('../lib/health/loadProtocolOverlay.ts')
const phase = (id, start, end, dose = 5, unit = 'mg', extra = {}) => ({ id, start_week: start, end_week: end, dose, dose_unit: unit, dose_semantics_version: 1, frequency: '1x/week', route: 'SubQ', ...extra })
const protocol = (overrides = {}) => ({ id: 'p1', name: 'Example protocol', start_date: '2026-01-01', status: 'active', completed_date: null,
  compounds: [{ id: 'c1', name: 'Example compound', phases: [phase('old', 1, 4), phase('new', 5, null, 3)] }], ...overrides })
const event = (overrides = {}) => ({ id: 'e1', date: '2026-02-01', event_type: 'dose_change', description: 'Recorded adjustment', protocol_id: 'p1', compound_id: 'c1', ...overrides })
const result = (id, date, value = 10, unit = 'ng/dL', extra = {}) => ({ date, panelId: `panel-${id}`, result: { id, lab_panel_id: `panel-${id}`, user_id: 'u', biomarker_name: 'Marker', canonical_name: null, value, value_text: null, unit, reference_low: 5, reference_high: 20, reference_text: null, status: 'normal', status_source: 'reported', category: null, ...extra } })

test('phase active at the lab date is selected strictly', () => assert.equal(overlay.contextAtDate(protocol(), '2026-01-15')[0].phaseId, 'old'))
test('a different saved phase is selected at a later lab date', () => assert.equal(overlay.contextAtDate(protocol(), '2026-02-15')[0].phaseId, 'new'))
test('an expired latest phase is not treated as current', () => {
  const p = protocol({ compounds: [{ id: 'c1', name: 'Example', phases: [phase('only', 1, 4)] }] })
  const context = overlay.contextAtDate(p, '2026-03-01')[0]; assert.equal(context.phaseId, null); assert.equal(context.dose, 'Dose not confirmed for this date')
})
test('an ongoing phase works for later historical dates', () => assert.equal(overlay.contextAtDate(protocol(), '2026-08-01')[0].phaseId, 'new'))
test('a completed protocol is active on its completion date but not after it', () => {
  const p = protocol({ status: 'completed', completed_date: '2026-03-01' }); assert.equal(overlay.protocolActiveOnDate(p, '2026-03-01'), true); assert.equal(overlay.protocolActiveOnDate(p, '2026-03-02'), false)
})
test('a recorded completion event stops activity after its date', () => assert.equal(overlay.protocolActiveOnDate(protocol(), '2026-03-02', [event({ date: '2026-03-01', event_type: 'completed' })]), false))
test('paused and resumed events determine historical activity without using current status', () => {
  const events = [event({ id: 'pause', date: '2026-02-01', event_type: 'paused' }), event({ id: 'resume', date: '2026-02-10', event_type: 'resumed' })]
  assert.equal(overlay.protocolActiveOnDate(protocol(), '2026-02-05', events), false); assert.equal(overlay.protocolActiveOnDate(protocol(), '2026-02-15', events), true)
})
test('a saved phase boundary creates a dose-change marker', () => {
  const marker = overlay.overlayMarkers([protocol()], []).find(item => item.type === 'change'); assert.equal(marker.date, '2026-01-29'); assert.equal(marker.description, '5 mg → 3 mg')
})
test('dose change between two readings is detected by date only', () => {
  const marker = overlay.overlayMarkers([protocol()], []); assert.equal(overlay.changesBetween(marker, '2026-01-20', '2026-02-10').some(item => item.type === 'change'), true)
})
test('protocol start between readings is included neutrally', () => {
  const marker = overlay.overlayMarkers([protocol({ start_date: '2026-02-01' })], []); assert.equal(overlay.changesBetween(marker, '2026-01-01', '2026-03-01').some(item => item.type === 'started'), true)
})
test('protocol completion between readings is included neutrally', () => {
  const marker = overlay.overlayMarkers([protocol({ completed_date: '2026-02-15', status: 'completed' })], []); assert.equal(overlay.changesBetween(marker, '2026-01-01', '2026-03-01').some(item => item.type === 'completed'), true)
})
test('historical context never substitutes the later current dose', () => {
  const context = overlay.contextAtDate(protocol(), '2026-01-10')[0]; assert.equal(context.dose, '5 mg'); assert.notEqual(context.dose, '3 mg')
})
test('unverified historical medication semantics are handled calmly', () => {
  const p = protocol({ compounds: [{ id: 'c1', name: 'Example', phases: [phase('legacy', 1, null, 50, 'IU', { dose_semantics_version: null })] }] })
  const context = overlay.contextAtDate(p, '2026-02-01')[0]; assert.equal(context.confirmed, false); assert.match(context.issue, /unverified/)
})
test('reviewed raw syringe entry without medication dose remains unconfirmed', () => {
  const dosing_entry = { version: 2, mode: 'syringe', review_status: 'confirmed', dose: '', dose_unit: '', syringe_markings: '20', syringe_scale: '100', injection_volume: '', vial_strength: '', vial_unit: '', bac_water_ml: '', concentration_value: '', concentration_unit: '', vial_label: '' }
  const p = protocol({ compounds: [{ id: 'c1', name: 'Example', phases: [phase('raw', 1, null, null, null, { dosing_entry })] }] })
  assert.equal(overlay.contextAtDate(p, '2026-02-01')[0].dose, 'Dose not confirmed for this date')
})
test('multiple active protocols are returned for a lab date', () => {
  const second = protocol({ id: 'p2', name: 'Second', compounds: [{ id: 'c2', name: 'Second compound', phases: [phase('p2-phase', 1, null)] }] })
  assert.equal([protocol(), second].flatMap(item => overlay.contextAtDate(item, '2026-02-15')).length, 2)
})
test('different biomarker units remain explicit separate series', () => {
  const history = { units: [{ unit: 'ng/dL', observations: [result('a', '2026-01-01')] }, { unit: 'nmol/L', observations: [result('b', '2026-02-01', 2, 'nmol/L')] }] }
  assert.equal(overlay.unitSeries(history, 'ng/dL').observations.length, 1); assert.equal(overlay.unitSeries(history, 'mg/dL'), null)
})
test('qualitative biomarker overlay has events but no numeric line', () => {
  const observations = [result('a', '2026-01-01', null, '', { value_text: 'Negative' }), result('b', '2026-02-01', null, '', { value_text: 'Detected' })]
  const chart = overlay.overlayChart(observations, overlay.overlayMarkers([protocol()], [])); assert.equal(chart.points.length, 0); assert.ok(chart.markers.length > 0)
})
test('identical reference ranges allow an overlay band', () => assert.ok(overlay.overlayChart([result('a', '2026-01-01'), result('b', '2026-02-01', 11)], []).range))
test('changing reference ranges omit the overlay band', () => assert.equal(overlay.overlayChart([result('a', '2026-01-01'), result('b', '2026-02-01', 11, 'ng/dL', { reference_high: 21 })], []).range, null))
test('three six and twelve month windows use actual dates', () => {
  const rows = [result('old', '2025-08-01'), result('year', '2025-10-01'), result('six', '2026-04-01'), result('three', '2026-07-01'), result('latest', '2026-09-01')]
  assert.deepEqual(['3m', '6m', '12m'].map(window => overlay.filterByWindow(rows, '2026-09-01', window).length), [2, 3, 4])
})
test('All window preserves every supplied item without mutation', () => {
  const rows = [result('a', '2025-01-01'), result('b', '2026-01-01')], before = JSON.stringify(rows); assert.equal(overlay.filterByWindow(rows, '2026-01-01', 'all').length, 2); assert.equal(JSON.stringify(rows), before)
})
test('default protocol IDs are limited to protocols overlapping reading dates', () => {
  const before = protocol({ id: 'before', completed_date: '2025-12-01' }), during = protocol({ id: 'during' }), after = protocol({ id: 'after', start_date: '2027-01-01' })
  assert.deepEqual(overlay.overlappingProtocolIds([before, during, after], [result('a', '2026-02-01')]), ['during'])
})
test('selected protocol filtering cannot introduce another protocol marker', () => {
  const markers = overlay.overlayMarkers([protocol(), protocol({ id: 'p2', name: 'Second', compounds: [] })], []); assert.equal(markers.filter(item => item.protocolId === 'p1').every(item => item.protocolId !== 'p2'), true)
})
test('no recorded event rows still yields date-backed lifecycle context', () => {
  const markers = overlay.overlayMarkers([protocol()], []); assert.ok(markers.some(item => item.type === 'started'))
})
test('free-text events are preserved without inventing a dose delta', () => {
  const marker = overlay.overlayMarkers([protocol()], [event({ description: 'Changed plan after review' })]).find(item => item.id === 'event:e1'); assert.equal(marker.description, 'Changed plan after review'); assert.ok(!marker.description.includes('→'))
})
test('overlay user-facing copy contains an explicit non-causal safeguard', () => {
  const source = readFileSync(new URL('../components/health/ProtocolOverlayView.tsx', import.meta.url), 'utf8'); assert.match(source, /without claiming that one caused the other/); assert.ok(!/improved|worsened|caused your|because the dose/i.test(source))
})
test('protocol detail was not expanded with a duplicate labs loader', () => {
  const source = readFileSync(new URL('../components/protocols/ProtocolDetail.tsx', import.meta.url), 'utf8'); assert.ok(!source.includes('loadLabs'))
})
test('overlay loader scopes events to relevant protocol IDs without truncating earlier lifecycle state', async () => {
  const calls = []
  const client = { from(table) {
    const state = { table, filters: [] }
    const query = { select() { return query }, eq(key, value) { state.filters.push(['eq', key, value]); return query }, lte(key, value) { state.filters.push(['lte', key, value]); return query }, or(value) { state.filters.push(['or', value]); return query }, in(key, value) { state.filters.push(['in', key, value]); return query }, order() { return query }, then(resolve) { calls.push(state); resolve({ data: table === 'protocols' ? [protocol()] : [event({ date: '2025-12-20', event_type: 'paused' })], error: null }) } }
    return query
  } }
  const data = await readProtocolOverlay(client, 'owner', '2026-01-01', '2026-09-01')
  assert.equal(data.events[0].date, '2025-12-20')
  assert.deepEqual(calls[1].filters.find(filter => filter[0] === 'in'), ['in', 'protocol_id', ['p1']])
  assert.equal(calls[1].filters.some(filter => filter[0] === 'gte'), false)
})
