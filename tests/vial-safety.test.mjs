import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function loader(overrides = {}) {
  const cache = new Map()
  function load(file) {
    const url = file instanceof URL ? file : new URL(file, import.meta.url)
    if (cache.has(url.href)) return cache.get(url.href)
    const out = { exports: {} }
    const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    new Function('require', 'module', 'exports', code)(name => {
      if (Object.hasOwn(overrides, name)) return overrides[name]
      if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, k) => k === '__esModule' ? false : String(k) })
      if (name.endsWith('.css')) return {}
      if (name.endsWith('/supabase')) return { createClient() { throw Error('Real backend access forbidden') } }
      if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) }
      if (!name.startsWith('.')) return require(name)
      return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url))
    }, out, out.exports)
    cache.set(url.href, out.exports)
    return out.exports
  }
  return load
}
const load = loader()
const { currentVialSafety } = load('../lib/health/vialSafety.ts')
const { entryFromForm } = load('../lib/health/dosingEntry.ts')
const { previewInventory } = load('../lib/inventory/model.ts')
const Hero = load('../components/dashboard/HeroProtocolCard.tsx').default
const Vial = load('../components/dashboard/VialInventory.tsx').default
const render = (View, props) => renderToStaticMarkup(React.createElement(View, props))
const today = new Date().toLocaleDateString('en-CA')
const phase = { id: 'synthetic-phase', start_week: 1, end_week: null, dose: 1, dose_unit: 'mg', dose_semantics_version: 1, injection_volume_ml: .2, frequency: 'daily' }
const compound = extra => ({ id: 'synthetic-compound', name: 'Synthetic compound', reconstitution_date: today, vial_strength: 10, vial_unit: 'mg', bac_water_ml: 2, doses_taken_override: 0, vials_in_stock: null, phases: [phase], ...extra })
function hero(c, allLogs = []) {
  return render(Hero, { snapshot: true, activeProtocols: [{ id: 'synthetic-protocol', name: 'Synthetic protocol', status: 'active', start_date: today, compounds: [c] }], activeCompoundTab: c.id, compoundIndex: 0, logs: {}, allLogs, totalLost: null })
}
function freeze(value) { if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze) } return value }

for (const [stock, expected] of [[null, 'Not recorded'], [0, '0'], [3, '3']]) test('Hero preserves stock certainty: ' + stock, () => {
  const c = freeze(compound({ vials_in_stock: stock })), before = JSON.stringify(c), html = hero(c)
  assert.ok(html.includes('<dt>Vials in stock</dt><dd>' + expected + '</dd>'))
  assert.equal(JSON.stringify(c), before)
  assert.match(html, /data-premium-vial="true"/)
  assert.match(html, /data-inventory-state="unknown"/)
  assert.doesNotMatch(html, /data-vial-liquid|Estimated remaining/)
})

test('missing current-vial fields are explained without falling back to phase preparation', () => {
  const old = entryFromForm({ input_mode: 'medication', dose: '1', dose_unit: 'mg', preparation: 'mixing', vial_strength: '10', vial_unit: 'mg', bac_water_ml: '2', reviewed: true })
  const c = freeze(compound({ reconstitution_date: null, bac_water_ml: null, vial_strength: null, vial_unit: null, phases: [{ ...phase, dosing_entry: old }] }))
  const before = JSON.stringify(c), html = hero(c)
  assert.match(html, /reconstitution date is not recorded as a valid date/)
  assert.match(html, /no positive liquid volume/)
  assert.match(html, /saved phase mixing details do not confirm the current vial volume/)
  assert.match(html, /Strength not recorded/)
  assert.equal(JSON.stringify(c), before)
})

test('phase and compound disagreement is explicit and neither source is rewritten', () => {
  const old = entryFromForm({ input_mode: 'medication', dose: '1', dose_unit: 'mg', preparation: 'mixing', vial_strength: '20', vial_unit: 'IU', bac_water_ml: '4', reviewed: true })
  const c = freeze(compound({ phases: [{ ...phase, dosing_entry: old }] })), before = JSON.stringify(c), html = hero(c)
  assert.match(html, /compound vial amount 10 mg; saved phase vial amount 20 IU/)
  assert.match(html, /compound liquid added 2 mL; saved phase liquid added 4 mL/)
  assert.match(html, /Recorded compound amount/)
  assert.match(html, /neither source is automatically selected/)
  assert.equal(JSON.stringify(c), before)
})

for (const counter of [null, 0, 50]) test('unattributable historical doses never determine remaining even with counter ' + counter, () => {
  const logs = freeze([{ compound_id: 'synthetic-compound', taken: true, date: '2001-01-01' }])
  const c = freeze(compound({ doses_taken_override: counter })), before = JSON.stringify({ c, logs }), html = hero(c, logs)
  assert.match(html, /saved doses are not linked to an individual vial/)
  assert.match(html, /Remaining unknown/)
  assert.doesNotMatch(html, /Estimated remaining|0 mL|100%/)
  assert.equal(JSON.stringify({ c, logs }), before)
})

test('normal valid treatment stays visible while remaining and expiration are honestly unknown', () => {
  const html = hero(freeze(compound({})))
  assert.match(html, /1 mg/); assert.match(html, /0\.2 mL/)
  assert.match(html, /Vial expiration<\/dt><dd>Unknown/)
  assert.match(html, /Expiration unknown/)
  assert.doesNotMatch(html, /Expired|EXPIRED|days left|Day \d+ of 28/)
})

for (const date of [undefined, '', 'invalid', '2026-02-30', '2026-10-01']) test('reconstitution is not an expiry source: ' + date, () => {
  const html = render(Vial, { compoundId: 'synthetic', compoundName: 'Synthetic', reconstitutionDate: date, presentation: 'status' })
  assert.match(html, /Expiration unknown/)
  assert.doesNotMatch(html, /Expired|EXPIRED|days left|progressbar/)
  assert.match(html, date === '2026-10-01' ? /Reconstituted Oct 1, 2026/ : /Reconstitution date not recorded/)
})

test('recorded inventory expiration remains distinct and absent expiration is not generated', () => {
  const input = expiration_date => ({ rowNumber: 2, values: { item_name: 'Synthetic inventory', form: 'lyophilized vial', quantity: '2', vial_strength: '10', strength_unit: 'mg', reconstitution_status: 'reconstituted', reconstitution_date: '2026-10-01', expiration_date } })
  const recorded = previewInventory([input('2026-10-20')], [], '2026-11-04').rows[0]
  const unknown = previewInventory([input('')], [], '2026-11-04').rows[0]
  assert.equal(recorded.item.expiration_date, '2026-10-20')
  assert.deepEqual(recorded.warnings, ['The recorded expiration date has passed.'])
  assert.equal(unknown.item.expiration_date, null); assert.deepEqual(unknown.warnings, [])
  for (const item of [recorded.item, unknown.item]) {
    let slot = 0
    const hooks = { ...React, useEffect() {}, useRef: value => ({ current: value }), useState: initial => [++slot === 1 ? [{ ...item, id: 'synthetic-item' }] : slot === 2 ? true : initial, () => { throw Error('Unexpected write') }] }
    const Inventory = loader({ react: hooks })('../components/inventory/Inventory.tsx').default
    const html = render(Inventory, {})
    assert.ok(html.includes('<dt>Recorded expiration date</dt><dd>' + (item.expiration_date ?? 'Not recorded') + '</dd>'))
    assert.match(html, /Reconstitution date<\/dt><dd>2026-10-01/)
  }
})

test('rendering preserves historical phase order and exact observations', () => {
  const history = { ...phase, id: 'old-phase', start_week: 0, end_week: 0, dose: .125, dose_unit: 'IU' }
  const c = freeze(compound({ phases: [phase, history] })), before = JSON.stringify(c)
  hero(c)
  assert.equal(JSON.stringify(c), before)
})

test('scheduled notifications do not infer expiry or query compounds, but journal reminders remain', async t => {
  const messages = [], queries = []
  const client = { from(table) { queries.push(table); assert.equal(table, 'push_subscriptions'); const q = { select() { return q }, eq(key) { assert.equal(key, 'reminder_hour'); return Promise.resolve({ data: [{ subscription: { endpoint: 'https://synthetic.invalid' } }] }) } }; return q } }
  const cron = loader({ '@supabase/supabase-js': { createClient: () => client }, 'next/server': { NextResponse: { json: body => body } }, 'web-push': { sendNotification: async (_sub, payload) => messages.push(JSON.parse(payload)) }, '../../../lib/pushConfig': { configureWebPush: () => ({ ok: true }) }, '../../../lib/rateLimit': { rateLimit: () => true }, '../../../lib/monitoring': { captureOperationalError() { throw Error('Unexpected notification error') } } })('../app/api/cron/route.ts')
  const before = process.env.CRON_SECRET; process.env.CRON_SECRET = 'synthetic-cron-only'
  t.after(() => { if (before === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = before })
  const result = await cron.GET({ headers: new Headers({ authorization: 'Bearer synthetic-cron-only' }) })
  assert.equal(result.sent, 1)
  assert.deepEqual(queries, ['push_subscriptions'])
  assert.deepEqual(messages, [{ title: 'MyPepProtocol', body: 'Time to log your journal entry for today.', url: '/journal' }])
})


test('preparation comparison preserves small differences and recognizes equivalent mass units', () => {
  const raw = currentVialSafety({ reconstitution_date: today, vial_strength: '10.001', vial_unit: 'mg', bac_water_ml: '2.001' }, { vial_strength: '10.002', vial_unit: 'mg', bac_water_ml: '2.002' }).reasons.join(' ')
  assert.match(raw, /10\.001 mg; saved phase vial amount 10\.002 mg/)
  assert.match(raw, /2\.001 mL; saved phase liquid added 2\.002 mL/)
  const same = currentVialSafety({ reconstitution_date: today, vial_strength: 1000, vial_unit: 'mcg', bac_water_ml: 2 }, { vial_strength: 1, vial_unit: 'mg', bac_water_ml: 2 })
  assert.doesNotMatch(same.reasons.join(' '), /sources differ/)
  assert.equal(same.remainingMl, null)
  const iu = currentVialSafety({ reconstitution_date: today, vial_strength: 1, vial_unit: 'IU', bac_water_ml: 2 }, { vial_strength: 1, vial_unit: 'mg', bac_water_ml: 2 })
  assert.match(iu.reasons.join(' '), /sources differ/)
})

test('invalid calendar reconstitution date is not normalized into an observed date', () => {
  const html = hero(compound({ reconstitution_date: '2026-02-30' }))
  assert.match(html, /Vial reconstituted<\/dt><dd>Not recorded/)
  assert.match(html, /reconstitution date is not recorded as a valid date/)
  assert.doesNotMatch(html, /Mar 2, 2026/)
})
