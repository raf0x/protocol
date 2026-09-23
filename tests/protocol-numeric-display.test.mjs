import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
function load(path) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const compiled = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name.endsWith('/supabase')) return { createClient() { throw new Error('Presentation tests must not access Supabase') } }
    if (!name.startsWith('.')) return require(name)
    return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url))
  }, compiled, compiled.exports)
  cache.set(url.href, compiled.exports)
  return compiled.exports
}
const { formatProtocolNumber: number, formatProtocolAmount: amount, formatProtocolPercent: percent, administrationDisplay, administrationForPhase, dosingDisplay, entryFromForm, interpretEntry } = load('../lib/health/dosingEntry.ts')
const { protocolCompoundPayload, newCompound } = load('../lib/protocols/form.ts')
const { todayProtocols } = load('../lib/health/today.ts')
const Hero = load('../components/dashboard/HeroProtocolCard.tsx').default
const Detail = load('../components/protocols/ProtocolDetail.tsx').default
const Card = load('../components/protocols/ProtocolCard.tsx').default
const today = new Date().toLocaleDateString('en-CA')
const phase = { id: 'phase', start_week: 1, end_week: null, dose: 5.25, dose_unit: 'mg', dose_semantics_version: 1, frequency: 'daily' }
const protocol = extra => ({ id: 'protocol', name: 'Example protocol', status: 'active', start_date: today, compounds: [{ id: 'compound', name: 'Example compound', phases: [{ ...phase, ...extra }] }] })
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
const hero = p => render(Hero, { activeProtocols: [p], activeCompoundTab: 'compound', compoundIndex: 0, logs: {}, allLogs: [], totalLost: null })
const detail = p => render(Detail, { protocol: p, today, onBack() {}, onEdit() {}, onComplete() {}, onPause() {}, onResume() {}, onReactivate() {}, onDelete() {}, onReload() {} })
const stat = (html, label) => html.match(new RegExp(`>${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</div><div[^>]*>(.*?)</div>`))?.[1]

test('volumes use magnitude-specific decimal limits and remove trailing zeroes', () => {
  for (const [value, expected] of [[0.168637, '0.17 mL'], [0.1 + 0.2, '0.3 mL'], ['0.500000', '0.5 mL'], [1.25, '1.3 mL'], ['1.00000', '1 mL'], [0.99999, '1 mL'], [0, '0 mL']]) assert.equal(amount(value, 'mL', 'volume'), expected)
})

test('dose and syringe amounts use at most one decimal with unambiguous units', () => {
  assert.equal(amount('5.000000', 'mg'), '5 mg')
  assert.equal(amount(5.25, 'mg'), '5.3 mg')
  assert.equal(amount(16.8637, 'syringe units', 'syringe'), '16.9 syringe units')
  assert.equal(amount(16.8637, 'U-100 units', 'syringe'), '16.9 U-100 units')
  assert.equal(amount(250.0000001, 'IU'), '250 IU')
  assert.equal(number(1000.25), '1000.3', 'Formatting is independent of device locale')
})

test('percentages and counts have deterministic precision without redundant zeroes', () => {
  assert.equal(percent('100.000'), '100%')
  assert.equal(percent(16.8637), '16.9%')
  assert.equal(number(3.0000001, 'count'), '3')
  assert.equal(number(3.6, 'count'), '4')
  assert.equal(number(3.25, 'fractionalCount'), '3.3')
  assert.equal(number(-0.00001), '0')
})

test('missing and invalid numbers never acquire a unit or become zero', () => {
  for (const value of [undefined, null, '', ' ', '--', '—', 'undefined', 'null', 'NaN', NaN, Infinity, -Infinity]) {
    assert.equal(number(value), null)
    assert.equal(amount(value, 'mg'), null)
    assert.equal(amount(value, 'mL', 'volume'), null)
    assert.equal(percent(value), null)
  }
  for (const unit of [undefined, null, '', ' ', '--', 'undefined', 'null', 'NaN']) assert.equal(amount(5, unit), null)
  for (const dose of [null, undefined, NaN, 'NaN']) assert.equal(dosingDisplay({ ...phase, dose }).primary, 'Dose not entered')
})

for (const [name, values, volume, syringe] of [
  ['volume without syringe markings', { injection_volume_ml: 0.168637, syringe_scale: 100 }, '0.17 mL', null],
  ['syringe draw without volume', { syringe_units: 16.8637, syringe_scale: 100 }, null, '16.9 U-100 units'],
  ['both measurements', { injection_volume_ml: 0.168637, syringe_units: 16.8637, syringe_scale: 100 }, '0.17 mL', '16.9 U-100 units'],
  ['neither measurement', {}, null, null],
  ['markings with no recorded scale', { syringe_units: 16.8637 }, null, null],
  ['a U-40 draw', { syringe_units: 6.74548, syringe_scale: 40 }, null, '6.7 U-40 units'],
]) test(`${name}: ring detail and protocol detail render separate, complete values`, () => {
  const p = protocol(values), actual = administrationDisplay(p.compounds[0].phases[0])
  assert.deepEqual(actual, { volume, syringe })
  const ringHtml = hero(p), detailHtml = detail(p)
  assert.equal(stat(ringHtml, 'INJECTION VOLUME'), volume ?? 'Not recorded')
  assert.equal(stat(ringHtml, 'SYRINGE DRAW'), syringe ?? undefined)
  assert.equal(detailHtml.includes('<dt>Injection volume</dt>'), Boolean(volume))
  assert.equal(detailHtml.includes('<dt>Syringe draw</dt>'), Boolean(syringe))
  if (volume) assert.ok(detailHtml.includes(`<dt>Injection volume</dt><dd>${volume}</dd>`))
  if (syringe) assert.ok(detailHtml.includes(`<dt>Syringe draw</dt><dd>${syringe}</dd>`))
  for (const html of [ringHtml, detailHtml]) {
    assert.match(html, /5\.3 mg/)
    assert.doesNotMatch(html, /--u|—u|-- mL|undefined|null|NaN|u \/|\/ mL|0\.168637|16\.8637/)
  }
  for (const value of Object.values(actual)) if (value) assert.doesNotMatch(value, /\//, 'Administration values do not use an ambiguous separator')
})

test('the derived V2 path preserves confirmed medication as the primary dose', () => {
  const entry = entryFromForm({ input_mode: 'medication', dose: '16.8637', dose_unit: 'mg', concentration_value: '100', concentration_unit: 'mg/mL', syringe_scale: '100' })
  const saved = { ...phase, dosing_entry: entry }, p = protocol(saved)
  assert.deepEqual(administrationDisplay(saved), { volume: '0.17 mL', syringe: '16.9 U-100 units' })
  assert.equal(dosingDisplay(saved).primary, '16.9 mg')
  assert.match(hero(p), /16\.9 mg/)
  assert.equal(stat(hero(p), 'INJECTION VOLUME'), '0.17 mL')
  assert.equal(stat(hero(p), 'SYRINGE DRAW'), '16.9 U-100 units')
  for (const dosing_entry of [entryFromForm({ input_mode: 'syringe', syringe_markings: '16.8637' }), entryFromForm({ input_mode: 'volume', injection_volume: '0.168637' })]) {
    const display = dosingDisplay({ dosing_entry })
    assert.equal(display.medication, null)
    assert.equal(display.primary, dosing_entry.mode === 'syringe' ? '16.9 syringe units' : '0.17 mL')
  }
})

test('active library cards and Today summaries share dose precision for V1 and V2 records', () => {
  for (const extra of [{}, { dosing_entry: entryFromForm({ input_mode: 'medication', dose: '5.25', dose_unit: 'mg' }) }]) {
    const p = protocol(extra)
    const html = render(Card, { protocol: p, today, index: 0, selecting: false, selected: false, onOpen() {}, onSelect() {} })
    assert.match(html, /5\.3 mg/)
    assert.equal(todayProtocols([p], today)[0].details, '5.3 mg · daily')
  }
})

test('vial estimates and preparation displays use shared formatting', () => {
  const p = protocol({ injection_volume_ml: 0.168637 })
  Object.assign(p.compounds[0], { bac_water_ml: 3, reconstitution_date: today, doses_taken_override: 1, vial_strength: 5.25, vial_unit: 'mg', vials_in_stock: 3 })
  const html = hero(p)
  assert.equal(stat(html, 'EST. REMAINING'), '2.8 mL')
  assert.equal(stat(html, 'DOSES TAKEN (VIAL)'), '1')
  assert.match(html, /94\.4%/)
  assert.match(html, /5\.3 mg/)
  assert.match(detail(p), /<dt>Liquid added<\/dt><dd>3 mL<\/dd>/)
  assert.doesNotMatch(html, /2\.831363|3\.00|5\.25/)
})

test('formatting never changes calculation results, saved entries, payloads, or legacy meaning', () => {
  const draft = { ...newCompound(), name: 'Example', dose: '16.8637', dose_unit: 'mg', concentration_value: '100', concentration_unit: 'mg/mL', syringe_scale: '100' }
  const entry = Object.freeze(entryFromForm(draft)), snapshot = JSON.stringify(entry), payload = protocolCompoundPayload([draft])
  const result = interpretEntry(entry), saved = { dosing_entry: entry }
  dosingDisplay(saved); administrationDisplay(saved)
  assert.equal(JSON.stringify(entry), snapshot)
  assert.deepEqual(protocolCompoundPayload([draft]), payload)
  assert.equal(result.medication.value, 16.8637)
  assert.equal(dosingDisplay(saved).medication.value, 16.8637)
  assert.equal(administrationForPhase(saved).volume, result.volume)
  assert.ok(Math.abs(result.volume - 0.168637) < 1e-12)
  assert.ok(Math.abs(result.markings - 16.8637) < 1e-12)
  assert.equal(payload[0].phase.dosing_entry.dose, '16.8637')
  assert.deepEqual(administrationDisplay({ ...phase, dose_semantics_version: null, injection_volume_ml: 0.168637, syringe_units: 16.8637, syringe_scale: 100 }), { volume: null, syringe: null })
  assert.equal(dosingDisplay({ dose: 50, dose_unit: 'IU' }).medication, null)
})
