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
    if (!name.startsWith('.')) return require(name)
    for (const suffix of ['', '.ts']) { try { return load(new URL(name + suffix, url).href) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    throw new Error(`Missing module ${name}`)
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}

const intelligence = load('../lib/health/biomarkerIntelligence.ts')
const { biomarkerHistories } = load('../lib/health/labs.ts')
const { normalizeLabTimeline } = load('../lib/health/labTimeline.ts')
const base = { id: 'r', lab_panel_id: 'p', user_id: 'u', biomarker_name: 'Marker', canonical_name: null, value: 10, value_text: null, unit: 'ng/dL', reference_low: 5, reference_high: 20, reference_text: null, status: 'normal', status_source: 'reported', category: null }
const result = (overrides = {}) => ({ ...base, ...overrides })
const panel = (id, date, results, provider = null) => ({ id, user_id: 'u', test_date: date, panel_name: 'Panel', provider, notes: null, source_type: 'manual', created_at: date, updated_at: date, results })
const observations = (latest = {}, previous = {}) => [
  { date: '2026-09-01', panelId: 'new', result: result({ id: 'new', value: 12, ...latest }) },
  { date: '2026-08-01', panelId: 'old', result: result({ id: 'old', value: 10, ...previous }) },
]

test('normalization is deterministic and punctuation-insensitive', () => assert.equal(intelligence.normalizeBiomarkerName(' Testosterone,   Total '), 'testosterone total'))
test('Total Testosterone variants share one canonical key', () => {
  const keys = ['Testosterone, Total', 'Total Testosterone', 'Testosterone Total'].map(name => intelligence.classifyBiomarker(name).key)
  assert.equal(new Set(keys).size, 1)
})
test('Total and Free Testosterone remain separate', () => assert.notEqual(intelligence.classifyBiomarker('Total Testosterone').key, intelligence.classifyBiomarker('Free Testosterone').key))
test('Estradiol and sensitive Estradiol remain separate', () => assert.notEqual(intelligence.classifyBiomarker('Estradiol').key, intelligence.classifyBiomarker('Sensitive Estradiol').key))
test('LDL-C and LDL particle number remain separate', () => assert.notEqual(intelligence.classifyBiomarker('LDL-C').key, intelligence.classifyBiomarker('LDL Particle Number').key))
test('known marker receives its category', () => assert.equal(intelligence.classifyBiomarker('Creatinine').category, 'Kidney'))
test('unknown marker falls back to Other with stable normalized key', () => assert.deepEqual(intelligence.classifyBiomarker(' Novel.Marker '), { key: 'raw:novel marker', category: 'Other' }))
test('canonical grouping preserves the latest original display name', () => {
  const histories = biomarkerHistories([panel('a', '2026-08-01', [result({ biomarker_name: 'Testosterone, Total' })]), panel('b', '2026-09-01', [result({ id: 'b', biomarker_name: 'Total Testosterone' })])])
  assert.equal(histories.length, 1); assert.equal(histories[0].name, 'Total Testosterone')
})
test('canonical histories keep exact units in separate series', () => {
  const histories = biomarkerHistories([panel('a', '2026-08-01', [result({ biomarker_name: 'Total Testosterone' })]), panel('b', '2026-09-01', [result({ id: 'b', biomarker_name: 'Testosterone Total', unit: 'nmol/L' })])])
  assert.equal(histories[0].units.length, 2)
})
test('latest versus previous compares numeric same-unit readings', () => {
  const value = intelligence.compareLatest(observations()); assert.equal(value.delta, 2); assert.equal(value.direction, 'up')
})
test('different units are never compared', () => assert.equal(intelligence.compareLatest(observations({}, { unit: 'nmol/L' })), null))
test('percentage delta is calculated against prior magnitude', () => assert.equal(intelligence.compareLatest(observations()).percent, 20))
test('zero prior value omits percentage safely', () => assert.equal(intelligence.compareLatest(observations({}, { value: 0 })).percent, null))
test('qualitative values are excluded from numeric comparison', () => assert.equal(intelligence.compareLatest(observations({ value: null, value_text: 'Detected' })), null))
test('duplicate readings on a date do not produce an ambiguous comparison', () => assert.equal(intelligence.compareLatest([...observations(), observations()[0]]), null))
test('flagged summary includes only latest high low or abnormal series', () => {
  const panels = [panel('a', '2026-09-01', [result({ status: 'high' }), result({ id: 'n', biomarker_name: 'Creatinine', status: 'normal' })])]
  assert.equal(intelligence.labIntelligence(panels, biomarkerHistories(panels)).flagged.length, 1)
})
test('repeat-history count uses distinct dates', () => {
  const panels = [panel('a', '2026-08-01', [result()]), panel('b', '2026-09-01', [result({ id: 'b' })])]
  assert.equal(intelligence.labIntelligence(panels, biomarkerHistories(panels)).repeatCount, 1)
})
test('sparkline data supports two numeric readings', () => assert.equal(intelligence.trendChart(observations()).points.length, 2))
test('one reading has no trend line', () => assert.deepEqual(intelligence.trendChart(observations().slice(0, 1)).points, []))
test('consistent complete reference ranges create a chart overlay', () => assert.ok(intelligence.trendChart(observations()).range))
test('changing reference ranges omit the universal overlay', () => assert.equal(intelligence.trendChart(observations({}, { reference_high: 19 })).range, null))
test('panel grouping follows category order and puts flagged rows first', () => {
  const grouped = intelligence.groupPanelResults([result({ id: 'n', biomarker_name: 'Creatinine' }), result({ id: 'f', biomarker_name: 'eGFR', status: 'low' }), result({ id: 'h', biomarker_name: 'TSH' })])
  assert.deepEqual(grouped.map(group => group.category), ['Kidney', 'Thyroid']); assert.equal(grouped[0].results[0].id, 'f')
})
test('qualitative results remain available in category histories without charting', () => {
  const panels = [panel('a', '2026-08-01', [result({ value: null, value_text: 'Negative', biomarker_name: 'Novel test' })]), panel('b', '2026-09-01', [result({ id: 'b', value: null, value_text: 'Detected', biomarker_name: 'Novel test' })])]
  const history = biomarkerHistories(panels)[0]; assert.equal(history.units[0].observations.length, 2); assert.equal(intelligence.trendChart(history.units[0].observations).points.length, 0)
})
test('latest panel summary stays compact and does not copy historical result arrays', () => {
  const panels = [panel('a', '2026-09-01', Array.from({ length: 100 }, (_, index) => result({ id: String(index), biomarker_name: `Marker ${index}` })), 'Provider')]
  const summary = intelligence.labIntelligence(panels, biomarkerHistories(panels)); assert.equal(summary.latestPanel.id, 'a'); assert.equal(summary.singleReadingCount, 100); assert.ok(JSON.stringify(summary.categories).length < 300)
})
test('Timeline preview adds only a concise category summary', () => {
  const event = normalizeLabTimeline([panel('a', '2026-09-01', [result({ biomarker_name: 'TSH' }), result({ id: 'b', biomarker_name: 'Creatinine' }), result({ id: 'c', biomarker_name: 'ALT' })])])[0]
  assert.equal(event.description, '3 biomarkers measured · Liver, Kidney +1'); assert.ok(event.description.length < 100)
})
test('user-facing intelligence copy remains neutral', () => {
  const source = readFileSync(new URL('../components/health/LabInsights.tsx', import.meta.url), 'utf8')
  assert.ok(source.includes('Outside supplied range')); assert.ok(!/improved|worsened|unhealthy|danger/i.test(source))
})
