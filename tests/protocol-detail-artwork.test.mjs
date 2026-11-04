import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
function load(file) {
  const url = new URL(file, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const output = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
    if (name.endsWith('/supabase')) return { createClient() { throw Error('Rendering artwork must not request backend data') } }
    if (!name.startsWith('.')) return require(name)
    return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url))
  }, output, output.exports)
  cache.set(url.href, output.exports)
  return output.exports
}
const Detail = load('../components/protocols/ProtocolDetail.tsx').default
const Artwork = load('../components/protocols/ProtocolDetailArtwork.tsx').default
const { entryFromForm, administrationDisplay, formatProtocolAmount } = load('../lib/health/dosingEntry.ts')
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props))
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const noop = () => {}
const today = '2026-11-04'
const phase = { id: 'phase-a', dose: 1, dose_unit: 'mg', dose_semantics_version: 1, injection_volume_ml: .2, syringe_units: 20, syringe_scale: 100, route: 'SubQ', frequency: 'daily', start_week: 1, end_week: null }
function detail({ stock = 3, phases = [phase], compounds, status = 'active' } = {}) {
  const protocol = { id: 'synthetic-protocol', name: 'Fictional QA protocol', status, start_date: '2026-11-01', compounds: compounds ?? [{ id: 'compound-a', name: 'Fictional compound identity', vials_in_stock: stock, notes: 'Original notes retained', phases }] }
  const before = JSON.stringify(protocol)
  const html = render(Detail, { protocol, today, onBack: noop, onEdit: noop, onComplete: noop, onPause: noop, onResume: noop, onReactivate: noop, onDelete: noop, onReload: noop })
  assert.equal(JSON.stringify(protocol), before, 'Presentation must not mutate supplied records')
  return html
}
const section = (html, kind) => html.split(`data-protocol-artwork-section="${kind}"`)[1]?.split('</section>')[0] ?? ''

for (const stock of [0, 1, 3, 12, null, undefined, -1, NaN, Infinity]) test(`real detail preserves inventory formatter for ${String(stock)}`, () => {
  // Avoid default-parameter substitution when explicitly testing missing stock.
  const html = detail({ compounds: [{ id: 'c', name: 'Synthetic item', vials_in_stock: stock, phases: [phase] }] })
  const inventory = text(section(html, 'inventory'))
  assert.ok(inventory.includes(formatProtocolAmount(stock, 'vials in stock', 'count') ?? 'Not recorded'), inventory)
  assert.match(inventory, /Illustrative · not a stock count/)
  assert.equal((html.match(/<dt>Inventory<\/dt>/g) ?? []).length, 1, 'One inventory fact; no duplicated quantity')
})

for (const route of ['SubQ', 'IM', 'Oral', '', undefined]) test(`administration preserves route ${String(route)} without inferring a delivery mode`, () => {
  const supplied = { ...phase, route }
  const html = detail({ phases: [supplied] }), copy = text(section(html, 'administration'))
  const expected = administrationDisplay(supplied)
  if (route) assert.ok(copy.includes(route))
  else assert.doesNotMatch(section(html, 'administration'), /<dt>Route<\/dt>/)
  assert.ok(copy.includes(expected.volume))
  assert.ok(copy.includes(expected.syringe))
  assert.match(copy, /Illustrative · not a dose guide/)
})

test('missing phase has unknown administration and no invented measurement', () => {
  const copy = text(section(detail({ phases: [] }), 'administration'))
  assert.match(copy, /Not recorded/)
  assert.doesNotMatch(copy, /mL|units|mg|IU|SubQ|Oral/)
})

for (const scale of ['40', '100']) test(`reviewed syringe semantics preserve U-${scale} as supplied by existing helper`, () => {
  const dosing_entry = entryFromForm({ input_mode: 'syringe', syringe_markings: '8', syringe_scale: scale, reviewed: true })
  const supplied = { ...phase, dosing_entry }, copy = text(section(detail({ phases: [supplied] }), 'administration'))
  assert.ok(copy.includes(administrationDisplay(supplied).syringe))
  assert.match(copy, new RegExp(`U-${scale}`))
})

test('existing warning, identity, notes and lifecycle actions survive presentation integration', () => {
  const dosing_entry = entryFromForm({ input_mode: 'unknown', dose: '1', dose_unit: 'mg', reviewed: false })
  const html = detail({ phases: [{ ...phase, dosing_entry }] }), copy = text(html)
  assert.match(html, /class="protocol-dose-issue" role="status"/)
  for (const existing of ['Fictional compound identity', 'Original notes retained', 'Pause protocol', 'Complete protocol', 'Delete protocol', 'Edit protocol']) assert.ok(copy.includes(existing), existing)
  assert.match(html, /class="protocol-plan|protocol-more-section protocol-plan/)
})

test('decorative artwork has no measurements or completed-action text and is excluded from focus', () => {
  for (const kind of ['administration', 'inventory']) {
    const html = render(Artwork, kind === 'administration' ? { kind, presentation: 'injection' } : { kind })
    assert.match(html, /<svg[^>]+aria-hidden="true"[^>]+focusable="false"/)
    assert.doesNotMatch(html, /<text|tabindex="0"|role="button"|data-detail="check"/)
    assert.doesNotMatch(text(html), /\d|completed|logged|taken|stock available/i)
    assert.match(html, new RegExp(`aria-label="Replay ${kind === 'administration' ? 'Administration' : 'Inventory'} illustration"`))
  }
})

test('multiple real compounds have independent SVG definitions and preserved stock facts', () => {
  const html = detail({ compounds: [
    { id: 'one', name: 'First synthetic compound', vials_in_stock: 0, phases: [phase] },
    { id: 'two', name: 'Second synthetic compound', vials_in_stock: null, phases: [] },
  ] })
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  assert.equal(new Set(ids).size, ids.length)
  const svgs = [...html.matchAll(/<svg[^>]*data-protocol-artwork-svg[^>]*>[\s\S]*?<\/svg>/g)].map(match => match[0])
  assert.equal(svgs.length, 3, 'Unknown administration has no artwork; both Inventory illustrations remain')
  for (const svg of svgs) {
    const local = [...svg.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
    for (const reference of svg.matchAll(/url\(#([^)]+)\)/g)) assert.ok(local.includes(reference[1]), 'Paint must resolve in the same artwork')
  }
  assert.match(text(html), /0 vials in stock/)
  assert.match(text(html), /Not recorded/)
})
// Route eligibility is decorative only; raw recorded facts and warnings stay authoritative.
const withoutInjection = { ...phase, route: undefined, injection_volume_ml: null, syringe_units: null, syringe_scale: null }
const hasSyringe = supplied => section(detail({ phases: supplied ? [supplied] : [] }), 'administration')
for (const route of ['SubQ', 'IM']) test(`route eligibility: ${route} supports syringe without an entered amount`, () => {
  assert.match(hasSyringe({ ...withoutInjection, route }), /data-motion="syringe"/)
})
for (const route of ['Oral', ' oral ', 'ORAL']) test(`route eligibility: ${route} keeps capsule and excludes syringe despite stale injection facts`, () => {
  const html = hasSyringe({ ...phase, route })
  assert.doesNotMatch(html, /data-motion="syringe"/)
  assert.match(html, /data-motion="capsule"/)
  assert.match(html, /data-administration-artwork="oral"/)
})
test('route eligibility: oral without injection facts uses the approved capsule', () => {
  const html = hasSyringe({ ...withoutInjection, route: 'Oral' })
  assert.doesNotMatch(html, /data-motion="syringe"/)
  assert.match(html, /data-motion="capsule"/)
})
for (const [label, supplied] of [
  ['missing phase', null],
  ['missing route and amounts', withoutInjection],
  ['blank route and scale only', { ...withoutInjection, route: ' ', syringe_scale: 100 }],
  ['Other route with stale amounts', { ...phase, route: 'Other' }],
  ['Topical route with stale amounts', { ...phase, route: 'Topical' }],
  ['derived volume only', { ...withoutInjection, dosing_entry: entryFromForm({ input_mode: 'medication', dose: '1', dose_unit: 'mg', concentration_value: '5', concentration_unit: 'mg/mL', syringe_scale: '100', reviewed: true }) }],
  ['versioned empty entry supersedes legacy amounts', { ...phase, route: null, dosing_entry: entryFromForm({ input_mode: 'unknown', reviewed: false }) }],
  ['syringe mode alone', { ...withoutInjection, dosing_entry: entryFromForm({ input_mode: 'syringe', syringe_scale: '100', reviewed: true }) }],
  ['invalid legacy amounts', { ...withoutInjection, injection_volume_ml: -1, syringe_units: Infinity }],
  ['blank versioned amounts', { ...withoutInjection, dosing_entry: entryFromForm({ injection_volume: ' ', syringe_markings: '', reviewed: false }) }],
]) test(`route eligibility: ${label} has compact data-only administration`, () => {
  const html = hasSyringe(supplied)
  assert.doesNotMatch(html, /data-protocol-artwork-svg="administration"|data-motion="syringe"|Replay Administration/)
})
for (const [label, recorded] of [
  ['legacy volume', { injection_volume_ml: .2 }],
  ['legacy markings', { syringe_units: 8 }],
  ['explicit zero volume', { injection_volume_ml: 0 }],
  ['versioned volume', { dosing_entry: entryFromForm({ input_mode: 'volume', injection_volume: '.2', reviewed: true }) }],
  ['versioned markings', { dosing_entry: entryFromForm({ input_mode: 'syringe', syringe_markings: '8', reviewed: true }) }],
]) test(`route eligibility: missing route with ${label} supports syringe`, () => {
  assert.match(hasSyringe({ ...withoutInjection, ...recorded }), /data-motion="syringe"/)
})