import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
function load(path) {
  const url = path.startsWith('file:') ? new URL(path) : new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const out = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => {
    if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    if (name === 'react/jsx-runtime') {
      const make = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null })
      return { __esModule: true, jsx: make, jsxs: make, Fragment: Symbol.for('fragment') }
    }
    if (name === 'next/link') return { __esModule: true, default: props => ({ type: 'a', props, key: null }) }
    if (!name.startsWith('.')) return require(name)
    for (const suffix of ['', '.ts', '.tsx']) { try { return load(new URL(name + suffix, url).href) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    throw new Error(`Missing module ${name}`)
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}

const { biomarkerHistories } = load('../lib/health/labs.ts')
const ViewModule = load('../components/health/LabFindingsSummary.tsx')
const { buildLabFindingsSummaryModel } = ViewModule
const Fragment = Symbol.for('fragment')
function textContent(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textContent).join('')
  if (typeof node.type === 'function') return textContent(node.type(node.props))
  if (node.type === Fragment) return textContent(node.props?.children)
  return textContent(node.props?.children)
}
function renderTree(node) {
  if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') return node
  if (Array.isArray(node)) return node.map(renderTree)
  if (typeof node.type === 'function') return renderTree(node.type(node.props))
  if (node.type === Fragment) return renderTree(node.props?.children)
  const props = { ...node.props }
  if ('children' in props) props.children = renderTree(props.children)
  return { type: node.type, props, key: node.key ?? null }
}
function treeJson(node) {
  return JSON.stringify(renderTree(node), (_key, value) => typeof value === 'function' ? '[function]' : typeof value === 'symbol' ? String(value) : value)
}

let resultCounter = 0
const result = (name, value, overrides = {}) => ({
  id: `result-${++resultCounter}`,
  lab_panel_id: 'unset',
  user_id: 'fictional-owner',
  biomarker_name: name,
  canonical_name: null,
  value,
  value_text: null,
  unit: 'mg/dL',
  reference_low: 5,
  reference_high: 20,
  reference_text: null,
  status: value < 5 ? 'low' : value > 20 ? 'high' : 'normal',
  status_source: 'reported',
  category: null,
  ...overrides,
})
const panel = (id, date, results) => ({
  id,
  user_id: 'fictional-owner',
  test_date: date,
  panel_name: 'Fictional panel',
  provider: 'Fictional provider',
  notes: null,
  source_type: 'manual',
  created_at: `${date}T12:00:00Z`,
  updated_at: `${date}T12:00:00Z`,
  results: results.map(row => ({ ...row, lab_panel_id: id })),
})
const histories = panels => biomarkerHistories(panels)
const model = panels => buildLabFindingsSummaryModel(panels, histories(panels))
const view = panels => ViewModule.default({ panels, histories: histories(panels) })
const html = panels => textContent(view(panels))

function sameMarkerPanels(values, overrides = {}) {
  return values.map(([id, date, value], index) => panel(id, date, [result('Fictional marker', value, typeof overrides === 'function' ? overrides(index, value) : overrides)]))
}

test('newly outside range becomes an attention headline', () => {
  const m = model(sameMarkerPanels([['old', '2026-08-01', 10], ['new', '2026-09-01', 30]]))
  assert.equal(m.headlines[0].type, 'newly_outside_range'); assert.equal(m.headlines[0].priority, 'attention')
})

test('returned to range is surfaced descriptively', () => {
  const p = sameMarkerPanels([['old', '2026-08-01', 30], ['new', '2026-09-01', 10]])
  assert.equal(model(p).headlines[0].type, 'returned_to_range')
  assert.match(html(p), /Within the supplied 5–20 range/)
})

test('persistent outside range is supported', () => {
  const p = sameMarkerPanels([['old', '2026-08-01', 25], ['new', '2026-09-01', 30]])
  assert.equal(model(p).headlines[0].type, 'persistently_outside_range')
})

test('outside previously observed values uses prior eligible extent', () => {
  const p = sameMarkerPanels([['a', '2026-07-01', 10], ['b', '2026-08-01', 12], ['c', '2026-09-01', 18]], { reference_high: 100, status: 'normal' })
  assert.equal(model(p).headlines[0].type, 'outside_previously_observed_values')
})

test('increase can be a headline when no more specific finding applies', () => {
  const p = sameMarkerPanels([['old', '2026-08-01', 10], ['new', '2026-09-01', 12]], { reference_high: 100, status: 'normal' })
  assert.equal(model(p).headlines[0].type, 'increased')
})

test('decrease can be a headline when no more specific finding applies', () => {
  const p = sameMarkerPanels([['old', '2026-08-01', 12], ['new', '2026-09-01', 10]], { reference_high: 100, status: 'normal' })
  assert.equal(model(p).headlines[0].type, 'decreased')
})

test('unchanged does not dominate the briefing', () => {
  const p = sameMarkerPanels([['old', '2026-08-01', 10], ['new', '2026-09-01', 10]], { reference_high: 100, status: 'normal' })
  assert.equal(model(p).headlines.length, 0)
  assert.match(html(p), /No headline changes identified/)
})

test('headline count is capped at four', () => {
  const oldRows = [], newRows = []
  for (let i = 0; i < 7; i++) { oldRows.push(result(`Marker ${i}`, 10, { reference_high: 100, status: 'normal' })); newRows.push(result(`Marker ${i}`, 12 + i, { reference_high: 100, status: 'normal' })) }
  assert.equal(model([panel('old', '2026-08-01', oldRows), panel('new', '2026-09-01', newRows)]).headlines.length, 4)
})

test('totalFindingsCount reflects the true count beyond the four-headline cap', () => {
  const oldRows = [], newRows = []
  for (let i = 0; i < 7; i++) { oldRows.push(result(`Marker ${i}`, 10, { reference_high: 100, status: 'normal' })); newRows.push(result(`Marker ${i}`, 12 + i, { reference_high: 100, status: 'normal' })) }
  const m = model([panel('old', '2026-08-01', oldRows), panel('new', '2026-09-01', newRows)])
  assert.equal(m.headlines.length, 4)
  assert.equal(m.totalFindingsCount, 7)
})

test('totalFindingsCount excludes missing-from-latest-panel findings, matching the headline pool', () => {
  const p = [panel('old', '2026-08-01', [result('Old A', 10), result('Old B', 11)]), panel('new', '2026-09-01', [result('Current', 12)])]
  const m = model(p)
  assert.equal(m.missingFromLatestCount, 2)
  assert.equal(m.totalFindingsCount, 0)
})

test('latestPanelId identifies the panel the current findings are anchored to', () => {
  const p = sameMarkerPanels([['old', '2026-08-01', 10], ['new', '2026-09-01', 30]])
  assert.equal(model(p).latestPanelId, 'new')
})

test('deterministic priority ordering is preserved', () => {
  const oldRows = [result('Directional', 10, { reference_high: 100, status: 'normal' }), result('Range transition', 10)]
  const newRows = [result('Directional', 12, { reference_high: 100, status: 'normal' }), result('Range transition', 30)]
  const m = model([panel('old', '2026-08-01', oldRows), panel('new', '2026-09-01', newRows)])
  assert.equal(m.headlines[0].type, 'newly_outside_range')
})

test('one-reading in-range biomarkers do not fill headline positions', () => {
  const oldRows = [result('Existing', 10)]
  const newRows = [result('Existing', 10), ...Array.from({ length: 6 }, (_, i) => result(`New ${i}`, i + 7))]
  const m = model([panel('old', '2026-08-01', oldRows), panel('new', '2026-09-01', newRows)])
  assert.equal(m.newlyMeasuredCount, 6)
  assert.equal(m.headlines.filter(item => item.type === 'newly_measured').length, 0)
})

test('missing from latest panel is grouped and not rendered as headline cards', () => {
  const p = [panel('old', '2026-08-01', [result('Old A', 10), result('Old B', 11)]), panel('new', '2026-09-01', [result('Current', 12)])]
  const m = model(p)
  assert.equal(m.missingFromLatestCount, 2)
  assert.ok(!m.headlines.some(item => item.type === 'missing_from_latest_panel'))
})

test('single panel yields one concise insufficient-history state', () => {
  const p = [panel('only', '2026-09-01', [result('A', 10), result('B', 11)])]
  assert.equal(model(p).state, 'insufficient')
  assert.equal((html(p).match(/not enough comparable lab history/g) || []).length, 1)
})

test('no panels produce no summary UI', () => {
  assert.equal(model([]).state, 'empty'); assert.equal(html([]), '')
})

test('multiple panels on latest date are not ordered by id', () => {
  const p = [panel('old', '2026-08-01', [result('A', 10)]), panel('new-a', '2026-09-01', [result('A', 11)]), panel('new-b', '2026-09-01', [result('A', 12)])]
  assert.equal(model(p).state, 'ambiguous_latest')
  assert.match(html(p), /will not guess which panel is newest/)
})

test('multiple panels on prior date preserve panel-membership uncertainty', () => {
  const p = [panel('prior-a', '2026-08-01', [result('A', 10)]), panel('prior-b', '2026-08-01', [result('B', 11)]), panel('new', '2026-09-01', [result('A', 12)])]
  assert.equal(model(p).previousPanelAmbiguous, true)
  const rendered = html(p)
  assert.match(rendered, /Some older results share the same test date, so new or missing biomarker comparisons are omitted\./)
  const tree = treeJson(view(p))
  assert.ok(tree.indexOf('Some older results share the same test date') > tree.indexOf('Up 2'))
})

test('older eligible series are not promoted into latest-panel briefing', () => {
  const p = [panel('a', '2026-07-01', [result('Old marker', 10, { reference_high: 100, status: 'normal' })]), panel('b', '2026-08-01', [result('Old marker', 15, { reference_high: 100, status: 'normal' })]), panel('new', '2026-09-01', [result('Current marker', 12)])]
  assert.ok(!model(p).headlines.some(item => item.biomarkerName === 'Old marker'))
})

test('different units remain separate and do not create a directional headline', () => {
  const p = [panel('old', '2026-08-01', [result('Free marker', 1, { unit: 'ng/dL', reference_high: 100, status: 'normal' })]), panel('new', '2026-09-01', [result('Free marker', 10, { unit: 'pg/mL', reference_high: 100, status: 'normal' })])]
  assert.ok(!model(p).headlines.some(item => ['increased', 'decreased'].includes(item.type)))
})

test('conflicting same-day current results do not generate misleading change', () => {
  const p = [panel('old', '2026-08-01', [result('A', 10, { reference_high: 100, status: 'normal' })]), panel('new', '2026-09-01', [result('A', 12, { reference_high: 100, status: 'normal' }), result('A', 13, { reference_high: 100, status: 'normal' })])]
  assert.ok(!model(p).headlines.some(item => ['increased', 'decreased', 'newly_outside_range'].includes(item.type)))
})

test('zero baseline keeps percentage unavailable in evidence UI', () => {
  const p = sameMarkerPanels([['old', '2026-08-01', 0], ['new', '2026-09-01', 2]], { reference_low: -10, reference_high: 100, status: 'normal' })
  const finding = model(p).headlines[0]
  assert.equal(finding.evidence.comparison.percent, null)
  assert.doesNotMatch(html(p), /\(\+?[^)]*%\)/)
})

test('evidence disclosure contains current and previous deterministic values', () => {
  const p = sameMarkerPanels([['old', '2026-08-01', 10], ['new', '2026-09-01', 12]], { reference_high: 100, status: 'normal' })
  const rendered = html(p)
  assert.match(rendered, /10 → 12 mg\/dL/)
  assert.match(rendered, /Up 2 \(\+20%\) since August 1/)
})

test('rendered summary never exposes raw result or panel ids', () => {
  const p = sameMarkerPanels([['secret-old-panel', '2026-08-01', 10], ['secret-new-panel', '2026-09-01', 12]], { reference_high: 100, status: 'normal' })
  const rendered = html(p)
  assert.doesNotMatch(rendered, /secret-old-panel|secret-new-panel|result-\d+/)
  assert.doesNotMatch(treeJson(view(p)), /secret-old-panel|secret-new-panel|result-\d+/)
})

test('presentation model does not mutate panels or histories', () => {
  const p = sameMarkerPanels([['old', '2026-08-01', 10], ['new', '2026-09-01', 12]], { reference_high: 100, status: 'normal' })
  const h = histories(p), beforePanels = JSON.stringify(p), beforeHistories = JSON.stringify(h)
  buildLabFindingsSummaryModel(p, h)
  assert.equal(JSON.stringify(p), beforePanels); assert.equal(JSON.stringify(h), beforeHistories)
})

test('user-facing integration copy avoids causal and medical-risk language', () => {
  const source = readFileSync(new URL('../components/health/LabFindingsSummary.tsx', import.meta.url), 'utf8')
  assert.ok(!/treatment caused|treatment improved|treatment worsened|clinically significant|dangerous|unhealthy|normal for you|safe|optimal/i.test(source))
})

test('integration adds no provider, API, fetch, Supabase, or persistence call', () => {
  const source = readFileSync(new URL('../components/health/LabFindingsSummary.tsx', import.meta.url), 'utf8')
  assert.ok(!/openai|supabase|fetch\s*\(|\/api\/|insert\s*\(|update\s*\(|delete\s*\(/i.test(source))
})

test('What Changed omits the duplicate latest recorded test date line', () => {
  const source = readFileSync(new URL('../components/health/LabFindingsSummary.tsx', import.meta.url), 'utf8')
  assert.ok(!source.includes('Latest recorded test date'))
})

test('findings use a dedicated responsive grid with a full-width single-finding state', () => {
  const source = readFileSync(new URL('../components/health/LabFindingsSummary.tsx', import.meta.url), 'utf8')
  const css = readFileSync(new URL('../app/health/health.module.css', import.meta.url), 'utf8')
  assert.ok(source.includes('className={styles.findingsList}'))
  assert.ok(source.includes('data-count={model.headlines.length}'))
  assert.match(css, /\.findingsList \{[^}]*grid-template-columns: minmax\(0, 1fr\)/s)
  assert.match(css, /\.findingsList\[data-count='1'\] \{ grid-template-columns: minmax\(0, 1fr\); \}/)
})

test('multiple findings retain the responsive two-column desktop layout', () => {
  const css = readFileSync(new URL('../app/health/health.module.css', import.meta.url), 'utf8')
  assert.match(css, /\.panelList, \.findingsList \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); \}/)
})

test('the single findings section moves into the briefing before existing lab details', () => {
  const dashboard = readFileSync(new URL('../components/health/HealthDashboard.tsx', import.meta.url), 'utf8')
  const insights = readFileSync(new URL('../components/health/LabInsights.tsx', import.meta.url), 'utf8')
  const briefing = readFileSync(new URL('../components/health/HealthBriefing.tsx', import.meta.url), 'utf8')
  assert.ok(dashboard.indexOf('<HealthBriefing') < dashboard.indexOf('<LabInsights'))
  assert.equal((briefing.match(/<LabFindingsSummary /g) || []).length, 1)
  assert.ok(!insights.includes('LabFindingsSummary'))
  assert.ok(insights.indexOf('className={styles.summaryGrid}') < insights.indexOf('By category'))
})
