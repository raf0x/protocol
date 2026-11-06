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
  const out = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
    if (name.endsWith('.css')) return {}
    if (name === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) }
    if (name.endsWith('/supabase')) return { createClient() { throw Error('Synthetic presentation tests cannot access Supabase') } }
    if (!name.startsWith('.')) return require(name)
    return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url))
  }, out, out.exports)
  cache.set(url.href, out.exports)
  return out.exports
}
const form = load('../lib/protocols/form.ts')
const { entryFormState } = load('../lib/health/dosingEntry.ts')
const Hero = load('../components/dashboard/HeroProtocolCard.tsx').default
const Detail = load('../components/protocols/ProtocolDetail.tsx').default
const Vial = load('../components/today/EnhancedVial.tsx').default
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
const noop = () => {}
function savedProtocol(amount = '10', unit = 'mg', legacy = {}) {
  const c = { ...form.newCompound(), name: 'Synthetic compound', preparation: 'mixing', vial_strength: amount, vial_unit: unit, bac_water_ml: '2', reconstitution_date: '2026-11-01', input_mode: 'syringe', syringe_markings: '20', syringe_scale: '100', days_of_week: [0,1,2,3,4,5,6] }
  const payload = form.protocolCompoundPayload([c])[0]
  const phase = JSON.parse(JSON.stringify({ ...payload.phase, id: 'phase', name: 'Phase 1', duration_weeks: null }))
  const compound = { ...payload, id: 'compound', vial_strength: null, vial_unit: null, bac_water_ml: null, ...legacy, phases: [phase] }
  delete compound.phase
  return { id: 'protocol', name: 'Synthetic compound', start_date: '2020-01-01', status: 'active', compounds: [compound] }
}
function hero(protocol, snapshot) { return render(Hero, { activeProtocols: [protocol], activeCompoundTab: 'compound', compoundIndex: 0, snapshot, logs: {}, allLogs: [], totalLost: null }) }
for (const snapshot of [false,true]) test(`creation payload -> reload -> Detail -> Hero ${snapshot ? 'snapshot' : 'full'} retains phase preparation`, () => {
  const p = savedProtocol(), before = JSON.stringify(p)
  const entry = p.compounds[0].phases[0].dosing_entry
  assert.equal(entryFormState(p.compounds[0].phases[0]).vial_strength, '10')
  const detail = render(Detail, { protocol: p, today: '2026-11-05', onBack: noop, onEdit: noop, onComplete: noop, onPause: noop, onResume: noop, onReactivate: noop, onDelete: noop, onReload: noop })
  assert.match(detail, /10 mg/)
  const html = hero(p, snapshot)
  assert.match(html, /Saved phase preparation/)
  assert.match(html, /10 mg/)
  assert.match(html, /Nov 1/)
  assert.match(html, /28-day check reminder/)
  assert.match(html, /Nov 29/)
  assert.match(html, /Remaining not tracked/)
  assert.equal(JSON.stringify(p), before)
})
for (const snapshot of [false,true]) test(`Hero ${snapshot} prefers phase 3000 IU over legacy 5000 IU`, () => {
  const html = hero(savedProtocol('3000','IU',{vial_strength:5000,vial_unit:'IU'}), snapshot)
  assert.match(html, /3,000 IU|3000 IU/); assert.doesNotMatch(html, /5,000 IU|5000 IU/)
})
test('unknown vial is visually distinct from known empty without a liquid level', () => {
  const unknown = render(Vial,{name:'Synthetic',remainingFraction:null,remainingMl:null})
  const empty = render(Vial,{name:'Synthetic',remainingFraction:0,remainingMl:0})
  assert.match(unknown, /data-vial-interior="untracked"/); assert.doesNotMatch(unknown, /data-vial-liquid|0%|0 mL/)
  assert.doesNotMatch(empty, /data-vial-interior="untracked"/)
})

const { reconstitutionCheckReminder } = load('../lib/health/preparationPresentation.ts')
test('reminder adds calendar days across months, leap years and DST; invalid dates remain unknown', () => {
  for (const [date, expected] of [['2026-11-01','2026-11-29'],['2028-02-01','2028-02-29'],['2027-02-01','2027-03-01'],['2026-12-20','2027-01-17'],['2026-03-01','2026-03-29']]) assert.equal(reconstitutionCheckReminder(date), expected)
  for (const invalid of [null,undefined,'','2026-02-30','not a date']) assert.equal(reconstitutionCheckReminder(invalid), null)
})
for (const snapshot of [false,true]) test('Hero '+snapshot+' never fills incomplete or malformed phase facts from legacy fields', () => {
  for (const entry of [{},{vial_strength:'10'},{vial_unit:'mg'},{vial_strength:'0',vial_unit:'mg'},{vial_strength:'ten',vial_unit:'mg'},{vial_strength:'10',vial_unit:'unsupported'},[], 'malformed',false]) {
    const p = savedProtocol('10','mg',{vial_strength:5000,vial_unit:'IU'});p.compounds[0].phases[0].dosing_entry=entry
    const before=JSON.stringify(p), html=hero(p,snapshot)
    assert.match(html,/Strength not recorded/);assert.doesNotMatch(html,/5000 IU|5,000 IU|10 IU/);assert.equal(JSON.stringify(p),before)
  }
})
for (const snapshot of [false,true]) test('Hero '+snapshot+' labels legacy-only preparation without claiming a current physical vial', () => {
  const p = savedProtocol('10','mg',{vial_strength:5000,vial_unit:'IU'});delete p.compounds[0].phases[0].dosing_entry
  const html=hero(p,snapshot)
  assert.match(html,/Saved legacy compound preparation/);assert.match(html,/5,000 IU|5000 IU/);assert.match(html,/current vial not confirmed/)
})
