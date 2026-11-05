import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { reactHarness } from './helpers/reactHarness.mjs'

const require = createRequire(import.meta.url), cache = new Map()
function load(file) {
  const url = new URL(file, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const output = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'react') return React
    if (name === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) }
    if (name.endsWith('/VialInventory')) return { __esModule: true, default: props => React.createElement('div', { 'data-inventory-compound': props.compoundId }, React.createElement('button', null, '+ New Vial')) }
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
    if (name.endsWith('/supabase')) return { createClient() { throw Error('Artwork presentation must not request a backend') } }
    if (!name.startsWith('.')) return require(name)
    return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url))
  }, output, output.exports)
  cache.set(url.href, output.exports)
  return output.exports
}
const vialModule = load('../components/today/EnhancedVial.tsx')
const scheduleModule = load('../components/today/EnhancedScheduleArtwork.tsx')
const Vial = vialModule.default ?? vialModule.EnhancedVial
const ScheduleArtwork = scheduleModule.default ?? scheduleModule.EnhancedScheduleArtwork
const Hero = load('../components/dashboard/HeroProtocolCard.tsx').default
const render = (Component, props = {}) => renderToStaticMarkup(React.createElement(Component, props))
const text = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const base = { name: 'Recorded compound', strength: 10, unit: 'mg', remainingFraction: .5, remainingMl: 1 }

test('known vial presents supplied strength and explicitly estimated liquid separately', () => {
  const html = render(Vial, base), copy = text(html)
  assert.match(html, /aria-label="Recorded compound vial"/)
  assert.match(copy, /10\s*mg/)
  assert.match(copy, /Estimated remaining/i)
  assert.match(copy, /50%/)
  assert.match(copy, /1(?:\.0+)?\s*mL/)
  assert.match(html, /data-vial-liquid/)
  assert.match(html, /<svg[^>]+aria-hidden="true"/)
  assert.doesNotMatch(html, /<svg[^>]+(?:tabindex="0"|role="button")/)
})
for (const [label, values] of [
  ['missing fraction', { remainingFraction: null }], ['missing volume', { remainingMl: null }],
  ['non-finite fraction', { remainingFraction: NaN }], ['non-finite volume', { remainingMl: Infinity }],
  ['negative fraction', { remainingFraction: -.1 }], ['negative volume', { remainingMl: -.1 }],
  ['fraction beyond full', { remainingFraction: 1.1 }],
]) test('unknown vial never depicts a known fill: ' + label, () => {
  const html = render(Vial, { ...base, ...values })
  assert.match(text(html), /Remaining unknown/i)
  assert.doesNotMatch(html, /data-vial-liquid/)
  assert.doesNotMatch(text(html), /\b100%|\bNaN|\bInfinity/)
})
test('recorded empty vial remains zero rather than unknown or full', () => {
  const html = render(Vial, { ...base, remainingFraction: 0, remainingMl: 0 })
  assert.match(text(html), /Estimated remaining/i)
  assert.match(text(html), /0%/)
  assert.match(text(html), /0(?:\.0+)?\s*mL/)
  assert.doesNotMatch(text(html), /Remaining unknown|100%/)
  assert.doesNotMatch(html, /data-vial-liquid/, 'An empty vial has no visible liquid geometry')
})
for (const [strength, unit] of [[250, 'mcg'], [20, 'IU'], [2.5, 'mg']]) test('vial preserves recorded ' + unit + ' identity without conversion', () => {
  const html = render(Vial, { ...base, strength, unit, name: 'A long compound / combination identity' })
  assert.match(html, /aria-label="A long compound \/ combination identity vial"/)
  assert.ok(text(html).includes(strength + ' ' + unit), text(html))
})
test('missing strength and name never fabricate a medication measurement', () => {
  const html = render(Vial, { name: '', remainingFraction: null, remainingMl: null })
  assert.doesNotMatch(text(html), /undefined|null|NaN|\b10 mg|\b100%/)
  assert.match(text(html), /Remaining unknown/i)
})
test('artwork SVG references resolve within each uniquely identified sibling', () => {
  const html = renderToStaticMarkup(React.createElement(React.Fragment, null,
    React.createElement(Vial, base), React.createElement(Vial, { ...base, name: 'Second compound' }),
    React.createElement(ScheduleArtwork), React.createElement(ScheduleArtwork)))
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  assert.ok(ids.length > 10)
  assert.equal(new Set(ids).size, ids.length, 'Sibling SVG paint definitions must never collide')
  for (const reference of html.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(reference[1]), reference[1])
})
test('schedule illustration is decorative and cannot show a fabricated check or selection', () => {
  const html = render(ScheduleArtwork)
  assert.match(html, /data-premium-schedule/)
  assert.match(html, /aria-hidden="true"/)
  assert.match(html, /focusable="false"/)
  assert.doesNotMatch(html, /dayCheck|dayHighlight|scheduledDot|aria-selected|aria-pressed|<button|<text/)
  assert.doesNotMatch(text(html), /✓|✔|Logged|Due/)
})
const today = new Date().toLocaleDateString('en-CA')
const phase = { dose: 1, dose_unit: 'mg', dose_semantics_version: 1, injection_volume_ml: .2, syringe_units: 20, syringe_scale: 100, frequency: 'daily', start_week: 1, end_week: null }
function hero(compound = {}, phases = [phase]) {
  return render(Hero, { activeProtocols: [{ id: 'protocol', name: 'Existing plan', status: 'active', start_date: today, compounds: [{ id: 'compound', name: 'Original compound identity', vial_strength: 10, vial_unit: 'mg', bac_water_ml: 2, reconstitution_date: today, doses_taken_override: 3, vials_in_stock: 4, ...compound, phases }] }], activeCompoundTab: 'compound', logs: {}, allLogs: [], totalLost: null, compoundIndex: 0, snapshot: true })
}
test('real Hero withholds unattributable remaining while preserving artwork, inventory actions and facts', () => {
  const html = hero()
  assert.match(text(html), /Remaining unknown/i)
  assert.match(text(html), /saved doses are not linked to an individual vial/)
  assert.doesNotMatch(html, /data-vial-liquid/)
  assert.match(text(html), /Vials in stock\s*4/)
  assert.match(html, /data-inventory-compound="compound"/)
  assert.match(text(html), /\+ New Vial/)
  assert.equal((html.match(/class="today-snapshot-fact"/g) ?? []).length, 9)
  assert.doesNotMatch(html, /class="today-snapshot-vial" aria-hidden="true"/, 'Visible measurement captions must remain accessible')
})
for (const [label, compound, phases] of [
  ['missing reconstitution', { reconstitution_date: null }, [phase]],
  ['missing water', { bac_water_ml: null }, [phase]],
  ['missing administration', {}, [{ ...phase, injection_volume_ml: null }]],
  ['missing phase', {}, []],
]) test('real Hero does not use its historical full-fill fallback for ' + label, () => {
  const html = hero(compound, phases)
  assert.match(text(html), /Remaining unknown/i)
  assert.doesNotMatch(html, /data-vial-liquid/)
  assert.doesNotMatch(text(html), /\b100%/)
  assert.match(text(html), /\+ New Vial/)
})
test('real Hero labels compound and phase preparation separately without using the phase as current vial confirmation', () => {
  const { entryFromForm } = load('../lib/health/dosingEntry.ts')
  const dosing_entry = entryFromForm({ input_mode: 'medication', dose: '2', dose_unit: 'IU', preparation: 'mixing', vial_strength: '20', vial_unit: 'IU', bac_water_ml: '2', reviewed: true })
  const html = hero({ vial_strength: 99, vial_unit: 'mg' }, [{ ...phase, dosing_entry }])
  const caption = html.split('<figcaption')[1]?.split('</figcaption>')[0]
  assert.ok(caption, 'The selected vial has a readable caption')
  assert.match(text(caption), /Recorded compound amount\s*99 mg/)
  assert.doesNotMatch(text(caption), /20 IU/)
  assert.match(text(caption), /Remaining unknown/)
  assert.match(text(html), /compound vial amount 99 mg; saved phase vial amount 20 IU/)
  assert.doesNotMatch(html, /data-vial-liquid/)
})

test('manual React harness gives useId stable instance slots and unique sibling IDs', () => {
  const harness = reactHarness()
  function Identity() { return React.createElement('span', { id: harness.hooks.useId(), 'data-second': harness.hooks.useId() }) }
  const tree = () => harness.render(React.createElement('div', null, React.createElement(Identity, { key: 'one' }), React.createElement(Identity, { key: 'two' })))
  const first = tree().props.children.map(node => [node.props.id, node.props['data-second']])
  assert.deepEqual(tree().props.children.map(node => [node.props.id, node.props['data-second']]), first)
  assert.equal(new Set(first.flat()).size, 4)
})

