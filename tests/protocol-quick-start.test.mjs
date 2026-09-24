import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import React from 'react'
import ts from 'typescript'
import { reactHarness } from './helpers/reactHarness.mjs'

const require = createRequire(import.meta.url), cache = new Map()
let hooks = [], lastHooks
const renderer = reactHarness()
function load(path) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }, code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'react') return { ...React, ...renderer.hooks }
    if (!name.startsWith('.')) return require(name)
    return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url))
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}
const catalog = load('../lib/protocols/catalog.ts'), form = load('../lib/protocols/form.ts'), quick = load('../lib/protocols/quickStart.ts')
const { protocolLifecycle } = load('../lib/health/protocolDates.ts')
const { interpretEntry, entryFromForm, dosingDisplay } = load('../lib/health/dosingEntry.ts')
const View = load('../components/protocols/ProtocolQuickStart.tsx').default
const Fields = load('../components/protocols/QuickProtocolFields.tsx').default
const Picker = load('../components/protocols/CompoundPicker.tsx').default
const Timing = load('../components/protocols/ProtocolStartDate.tsx').default
const item = Object.freeze({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', item_name: 'Test C', vial_strength: 200, strength_unit: 'mg', quantity: 8, form: 'lyophilized vial', reconstitution_status: 'unknown', reconstitution_date: null })
const previous = [{ start_date: '2026-08-01', compounds: [{ name: 'Test C', phases: [{ start_week: 1, dose: 5, dose_unit: 'mg', dose_semantics_version: 1, frequency: '1x/week', days_of_week: [0], route: 'SubQ', time_of_day: 'morning' }] }] }]
function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate))
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]
}
function text(node) { if (Array.isArray(node)) return node.map(text).join(''); return node && typeof node === 'object' ? text(node.props?.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '' }
function ui(Component, props) { if (lastHooks !== hooks) { renderer.reset(); lastHooks = hooks } return renderer.render(React.createElement(Component, props)) }
const button = (view, name) => nodes(view, n => n.type === 'button' && text(n) === name)[0]
const field = (view, name) => nodes(view, n => n.props?.['aria-label'] === name)[0]

test('catalog is complete, typed by category, and never supplies a dose or duplicate identity', () => {
  assert.equal(catalog.compoundCatalog.length, 30)
  assert.deepEqual(catalog.compoundCategories, ['Peptides', 'GLP-1 medications', 'Hormones and TRT', 'Anabolics', 'Other medications'])
  assert.equal(new Set(catalog.compoundCatalog.map(c => c.id)).size, 30)
  for (const c of catalog.compoundCatalog) {
    assert.ok(catalog.compoundCategories.includes(c.category))
    assert.deepEqual(Object.keys(c).filter(key => key !== 'shortName').sort(), ['aliases', 'category', 'id', 'name', 'units'])
    assert.equal(quick.selectCompound(form.newCompound(), c.name).dose, '')
  }
})
test('aliases, brands, punctuation, case and whitespace resolve to canonical identities', () => {
  for (const [alias, name] of [[' h.C.g ', 'Human chorionic gonadotropin'], ['TEST   C', 'Testosterone cypionate'], ['CJC IPA', 'CJC-1295 / Ipamorelin'], ['GHK CU', 'GHK-Cu'], ['Ozempic', 'Semaglutide'], ['Wegovy', 'Semaglutide'], ['Mounjaro', 'Tirzepatide'], ['Zepbound', 'Tirzepatide'], ['Anavar', 'Oxandrolone'], ['Deca', 'Nandrolone decanoate'], ['Primo', 'Methenolone enanthate']]) {
    assert.equal(catalog.resolveCompound(alias).name, name)
    assert.ok(catalog.searchCompounds(alias).some(c => c.name === name))
  }
  assert.equal(catalog.canonicalCompoundName('My unlisted compound'), 'My unlisted compound')
  assert.equal(catalog.resolveCompound(''), undefined)
})
test('one local start date maps past/today/future/unknown through the existing lifecycle without extra event state', () => {
  const today = '2026-09-22'
  assert.equal(quick.createQuickStart(undefined, undefined, today).startDate, today)
  for (const [date, lifecycle] of [['2026-09-01', 'active'], [today, 'active'], ['2026-09-23', 'scheduled'], ['', 'planned']]) {
    const dates = quick.quickStartDates(date, today)
    assert.deepEqual(dates, { startDate: date || null, effectiveDate: date || null })
    assert.equal(protocolLifecycle({ status: date ? 'active' : 'planned', start_date: dates.startDate }, today), lifecycle)
  }
  assert.throws(() => quick.quickStartDates('2026-02-30', today), /valid start date/)
  const source = ts.transpileModule(readFileSync(new URL('../lib/health/protocolDates.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  for (const [zone, expected] of [['America/Los_Angeles', '2026-09-21'], ['Pacific/Kiritimati', '2026-09-22']]) assert.equal(execFileSync(process.execPath, ['-e', source + ";console.log(exports.localCalendarDate(new Date('2026-09-22T01:00:00Z')))"], { env: { ...process.env, TZ: zone }, encoding: 'utf8' }).trim(), expected)
})
test('handoff precedence preserves timing and recorded facts without deriving dose, route, stock or schedule', () => {
  const fromInventory = quick.createQuickStart(undefined, item, '2026-09-22').compounds[0]
  assert.equal(fromInventory.name, 'Testosterone cypionate'); assert.equal(fromInventory.vial_strength, '200')
  for (const key of ['dose', 'dose_unit', 'route', 'vials_in_stock', 'reconstitution_date', 'cycle_days', 'time_of_day']) assert.equal(fromInventory[key], '')
  assert.deepEqual(fromInventory.days_of_week, [])
  const handoff = quick.createQuickStart(new URLSearchParams('dose=3&dose_unit=mg&vial=100&date=2026-10-01'), item)
  assert.equal(handoff.startDate, '2026-10-01'); assert.equal(handoff.compounds[0].vial_strength, '100'); assert.equal(handoff.compounds[0].dose, '3')
  assert.equal(quick.createQuickStart(new URLSearchParams('timing=planned'), item).startDate, '')
  assert.equal(item.quantity, 8)
  const otherIdentity = quick.createQuickStart(new URLSearchParams('name=Semaglutide'), item).compounds[0]
  assert.equal(otherIdentity.name, 'Semaglutide'); assert.equal(otherIdentity.vial_strength, '')
  assert.throws(() => quick.requireIdentifier('invalid'), /invalid identifier/)
  assert.equal(quick.requireIdentifier(item.id), item.id)
})
test('previous medical setup requires acceptance and cannot replace explicit current values or change identities', () => {
  const setups = quick.recentSetups(previous), selected = quick.selectCompound(form.newCompound(), 'Test C')
  assert.equal(selected.dose, '')
  const accepted = quick.acceptPreviousSetup(selected, setups[0])
  assert.equal(accepted.dose, '5'); assert.equal(accepted.route, 'SubQ'); assert.deepEqual(accepted.days_of_week, [0])
  const entered = form.updateCompoundDraft(selected, 'dose', '8')
  const retained = quick.acceptPreviousSetup(entered, setups[0])
  assert.equal(retained.dose, '8'); assert.equal(retained.dose_unit, '')
  assert.equal(form.updateCompoundDraft(accepted, 'dose', '9').dose, '9')
  assert.equal(quick.selectCompound(accepted, 'Semaglutide').dose, '')
  assert.equal(quick.selectCompound(accepted, 'TEST C').dose, '5')
  assert.equal(quick.acceptPreviousSetup(quick.selectCompound(form.newCompound(), 'Semaglutide'), setups[0]).dose, '')
  const inventory = quick.selectInventory(form.newCompound(), item)
  const oldPreparation = { ...setups[0], values: { ...setups[0].values, vial_strength: '50', vial_unit: 'mg', bac_water_ml: '2' } }
  const inventoryAccepted = quick.acceptPreviousSetup(inventory, oldPreparation)
  assert.equal(inventoryAccepted.vial_strength, '200'); assert.equal(inventoryAccepted.bac_water_ml, '')
  assert.equal(quick.setPreparation(inventory, 'ready').isPreMixed, true, 'User adjustments override a prefill')
})
test('accepted historical daily schedules retain all days; unverified old doses remain unverified', () => {
  const history = [{ ...previous[0], compounds: [{ name: 'Test C', phases: [{ ...previous[0].compounds[0].phases[0], frequency: 'daily', days_of_week: [], dose_unit: 'IU', dose_semantics_version: null }] }] }]
  const setup = quick.recentSetups(history)[0]
  const accepted = quick.acceptPreviousSetup(quick.selectCompound(form.newCompound(), 'Test C'), setup)
  assert.equal(form.compoundFrequency(accepted), 'daily')
  assert.equal(accepted.input_mode, 'unknown'); assert.equal(accepted.reviewed, false)
  assert.equal(interpretEntry(entryFromForm(accepted)).medication, null)
})

const Additional = load('../components/protocols/QuickProtocolFields.tsx').QuickAdditionalFields
const Review = load('../components/protocols/ProtocolQuickStart.tsx').QuickStartReview
const ready = overrides => ({ ...quick.selectCompound(form.newCompound(), 'Tirzepatide'), dose: '5', dose_unit: 'mg', route: 'SubQ', days_of_week: [0,1,2,3,4,5,6], ...overrides })
const draft = c => ({ startDate: '2026-09-22', compounds: [c] })

test('picker starts with search, exposes two categories and exactly five neutral quick picks', () => {
  hooks = []; let value = form.newCompound()
  const render = () => ui(Picker, { value, onChange: next => { value = next } })
  const initial = render()
  assert.equal(text(initial.props.children[0]).trim(), 'Search compounds')
  assert.doesNotMatch(text(initial), /Recently used|From your inventory|Use my last setup|Not listed|Popular|Recommended|Safe|GLP-1 medications|Hormones and TRT|Anabolics/)
  assert.deepEqual(nodes(field(initial, 'Peptides quick picks'), n => n.type === 'button').map(text), ['Tirzepatide', 'Semaglutide', 'Retatrutide', 'BPC-157', 'GHK-Cu'])
  button(render(), 'Other').props.onClick()
  assert.deepEqual(nodes(field(render(), 'Other quick picks'), n => n.type === 'button').map(text), ['Testosterone cypionate', 'HCG', 'Testosterone enanthate', 'Nandrolone decanoate', 'Oxandrolone'])
  button(render(), 'HCG').props.onClick()
  assert.equal(value.name, 'Human chorionic gonadotropin'); assert.equal(value.dose_unit, 'IU'); assert.equal(value.dose, '')
  assert.equal(render().props.className, 'quick-selected'); assert.ok(button(render(), 'Change')); assert.equal(field(render(), 'Search compounds'), undefined)
})

test('live search reaches every catalog identity and alias, caps results at five, and offers custom entry only on no match', () => {
  hooks = []; let value = form.newCompound()
  const render = () => ui(Picker, { value, onChange: next => { value = next } })
  const search = query => field(render(), 'Search compounds').props.onChange({ target: { value: query } })
  for (const c of catalog.compoundCatalog) for (const alias of [c.name, ...c.aliases]) {
    search(alias)
    assert.ok(button(render(), c.id === 'hcg' ? 'HCG' : c.name), alias)
    assert.equal(render().props.children[2].props['aria-label'], 'Matching compounds')
    assert.ok(nodes(field(render(), 'Matching compounds'), n => n.type === 'button').length <= 5)
    assert.doesNotMatch(text(render()), /as a custom compound/)
  }
  search('a'); let found = []
  do { found.push(...nodes(field(render(), 'Matching compounds'), n => n.type === 'button').map(text)); const more = button(render(), 'More results'); if (!more) break; more.props.onClick() } while (true)
  assert.equal(found.length, catalog.searchCompounds('a').length)
  search('Ozempic'); button(render(), 'Semaglutide').props.onClick(); assert.equal(value.name, 'Semaglutide')
  button(render(), 'Change').props.onClick(); search('My custom compound')
  assert.equal(field(render(), 'Matching compounds'), undefined, 'No empty results wrapper')
  const custom = nodes(render(), n => n.type === 'button' && /^Use /.test(text(n)))
  assert.equal(custom.length, 1); custom[0].props.onClick(); assert.equal(value.name, 'My custom compound')
  assert.equal(render().props.className, 'quick-selected')
})

test('start date initially renders only three choices; chosen date alone adds a field without empty wrappers', () => {
  hooks = []; let date = '2026-09-22'
  const render = () => ui(Timing, { value: date, today: '2026-09-22', onChange: next => { date = next } })
  assert.deepEqual(nodes(render(), n => n.type === 'button').map(text), ['Today', 'Another date', 'I don’t know yet'])
  assert.equal(nodes(render(), n => n.type === 'label').length, 0)
  assert.equal(nodes(render(), n => n.props.className === 'quick-date-entry').length, 0, 'No hidden date wrapper')
  button(render(), 'Another date').props.onClick(); assert.ok(field(render(), 'Protocol start date'))
  field(render(), 'Protocol start date').props.onChange({ target: { value: '2099-01-01' } }); assert.equal(date, '2099-01-01')
  button(render(), 'I don’t know yet').props.onClick(); assert.equal(date, ''); assert.equal(field(render(), 'Protocol start date'), undefined)
  button(render(), 'Today').props.onClick(); assert.equal(date, '2026-09-22'); assert.equal(nodes(render(), n => n.type === 'label').length, 0)
  hooks = []; assert.ok(field(ui(Timing, { value: '2026-09-01', today: date, onChange() {} }), 'Protocol start date'), 'Handoff retains chosen past date')
})

test('default dose is simple; alternatives reveal guided paths and preserve their raw meanings', () => {
  hooks = []; let value = ready()
  const render = () => ui(Fields, { value, onChange: next => { value = next } })
  assert.ok(field(render(), 'Dose per injection')); assert.equal(button(render(), 'Syringe markings'), undefined)
  assert.equal(field(render(), 'Syringe scale'), undefined)
  button(render(), 'I measure my dose another way').props.onClick()
  button(render(), 'Syringe markings').props.onClick()
  field(render(), 'Syringe markings').props.onChange({ target: { value: '20' } })
  field(render(), 'Syringe scale').props.onChange({ target: { value: '100' } })
  assert.equal(value.dose, '5', 'Switching methods preserves entered values')
  assert.equal(interpretEntry(entryFromForm(value)).medication, null); assert.equal(interpretEntry(entryFromForm(value)).volume, .2)
  button(render(), 'Injection volume').props.onClick(); assert.ok(field(render(), 'Injection volume (mL)'))
  button(render(), 'I\u2019m not sure').props.onClick(); assert.match(text(render()), /What measurement is on your instructions or syringe/)
  assert.equal(quick.quickStartIssue(draft(value)).field, 'input_mode')
  assert.doesNotMatch(text(render()), /save and add details later|can save/)
})

test('single reliable unit is preselected; multiple units and explicit handoff unit choices are preserved', () => {
  assert.equal(quick.selectCompound(form.newCompound(), 'HCG').dose_unit, 'IU')
  assert.equal(quick.createQuickStart(new URLSearchParams('name=HCG')).compounds[0].dose_unit, 'IU')
  assert.equal(quick.selectCompound(form.newCompound(), 'Tirzepatide').dose_unit, '')
  assert.equal(quick.createQuickStart(new URLSearchParams('name=HCG&dose_unit=mg')).compounds[0].dose_unit, 'mg')
  assert.equal(quick.selectCompound(form.updateCompoundDraft(ready(), 'dose_unit', 'mcg'), 'Tirzepatide').dose_unit, 'mcg')
})

test('creation completeness checks a single next fact and a missing medication unit has one inline message', () => {
  for (const dose of ['', '0', '-1', 'NaN', 'Infinity', '1e999']) assert.equal(quick.quickStartIssue(draft(ready({ dose }))).field, 'dose')
  for (const unit of ['', 'mL', 'units']) assert.equal(quick.quickStartIssue(draft(ready({ dose_unit: unit }))).message, 'Choose a unit to continue')
  hooks = []; const value = ready({ dose_unit: '' }), issue = quick.quickStartIssue(draft(value))
  const view = ui(Fields, { value, issue, onChange() {} })
  assert.equal(nodes(view, n => n.props.role === 'alert').length, 1)
  assert.equal(text(view).split('Choose a unit to continue').length - 1, 1)
  for (const scale of ['', '0', '20', 'Infinity']) assert.equal(quick.quickStartIssue(draft(ready({ input_mode: 'syringe', syringe_markings: '20', syringe_scale: scale }))).field, 'syringe_scale')
  assert.equal(quick.quickStartIssue(draft(ready({ input_mode: 'syringe', syringe_markings: '0', syringe_scale: '100' }))).field, 'syringe_markings')
  assert.equal(quick.quickStartIssue(draft(ready({ input_mode: 'volume', injection_volume: '0' }))).field, 'injection_volume')
  assert.ok(quick.quickStartIssue(draft(ready({ input_mode: 'unknown' }))))
})

test('accepted Quick Start drafts run through the canonical payload and real card presentation with a useful primary dose', () => {
  const { compoundOverview } = load('../lib/health/protocolPresentation.ts')
  for (const [overrides, primary] of [[{}, '5 mg'], [{ input_mode: 'syringe', syringe_markings: '20', syringe_scale: '100' }, '20 U-100 units'], [{ input_mode: 'syringe', syringe_markings: '8', syringe_scale: '40' }, '8 U-40 units'], [{ input_mode: 'volume', injection_volume: '0.2' }, '0.2 mL']]) {
    const value = ready(overrides)
    assert.equal(quick.quickStartIssue(draft(value)), null)
    const payload = form.protocolCompoundPayload([value])[0]
    assert.equal(dosingDisplay(payload.phase).primary, primary)
    for (const startDate of ['', '2026-09-22', '2099-01-01']) {
      const protocol = { status: startDate ? 'active' : 'planned', start_date: startDate || null }
      const card = compoundOverview(protocol, { ...payload, phases: [payload.phase] }, '2026-09-22')
      assert.equal(card.dose, primary)
      assert.doesNotMatch(JSON.stringify(card), /Dose not fully calculated yet/)
    }
  }
})

test('duration uses a human question, defaults ongoing, conditionally renders weeks and reviews the chosen length', () => {
  hooks = []; let value = ready()
  const render = () => ui(Fields, { value, onChange: next => { value = next } })
  assert.match(text(render()), /How long will you run this protocol\?/)
  assert.equal(button(render(), 'No end date recorded').props['aria-pressed'], true); assert.equal(field(render(), 'How many weeks?'), undefined)
  assert.match(text(ui(Review, { value: draft(value), today: '2026-09-22' })), /Starts today . No end date recorded/)
  button(render(), 'Set a length').props.onClick()
  assert.ok(field(render(), 'How many weeks?')); assert.equal(quick.quickStartIssue(draft(value)).field, 'duration_weeks')
  field(render(), 'How many weeks?').props.onChange({ target: { value: '12' } })
  assert.match(text(ui(Review, { value: draft(value), today: '2026-09-22' })), /Starts today . 12 weeks/)
  button(render(), 'No end date recorded').props.onClick(); assert.equal(field(render(), 'How many weeks?'), undefined)
})

test('preselection renders only the picker and no review; additional setup is a native state-preserving disclosure', () => {
  hooks = []; let value = quick.createQuickStart()
  const render = () => ui(View, { value, today: '2026-09-22', onChange: next => { value = next } })
  assert.equal(nodes(render(), n => n.type === 'input').length, 1)
  assert.equal(nodes(render(), n => n.type === 'details').length, 0)
  assert.equal(ui(Review, { value }), null)
  button(render(), 'Tirzepatide').props.onClick()
  assert.equal(ui(Review, { value }), null)
  button(render(), 'Continue').props.onClick()
  const disclosure = nodes(render(), n => n.type === 'details')[0]
  assert.match(text(disclosure), /^Preparation, inventory and notesOptional/)
  assert.equal(disclosure.props.open, undefined, 'Initially closed using native details')
  assert.equal(button(disclosure, 'Add another compound'), undefined)
  assert.equal(field(disclosure, 'Dose per injection'), undefined, 'Required dosing is outside optional setup')
  field(disclosure, 'Notes').props.onChange({ target: { value: 'Keep this note' } })
  const open = nodes(render(), n => n.type === 'details')[0]; open.props.open = true
  const closed = nodes(render(), n => n.type === 'details')[0]; closed.props.open = false
  assert.equal(value.compounds[0].notes, 'Keep this note'); assert.equal(field(closed, 'Notes').props.value, 'Keep this note')
  assert.equal(nodes(render(), n => n.type === 'summary').map(text)[0], 'Preparation, inventory and notesOptional')
  assert.doesNotMatch(text(render()), /Customize details|Ready to track|\bActive\b|\bScheduled\b|\bPlanned\b/)
})

test('optional preparation retains conditional inputs, preserves facts and never mutates inventory', () => {
  hooks = []; let value = quick.selectInventory(form.newCompound(), item)
  const render = () => ui(Additional, { value, today: '2026-09-22', onChange: next => { value = next } })
  assert.ok(field(render(), 'Vial strength')); assert.equal(field(render(), 'Reconstitution date'), undefined)
  button(render(), 'Mixed today').props.onClick(); assert.equal(value.reconstitution_date, '2026-09-22')
  button(render(), 'Ready to use').props.onClick(); assert.equal(field(render(), 'BAC water (mL)'), undefined)
  assert.ok(field(render(), 'Labeled concentration')); assert.equal(value.vial_strength, '200'); assert.equal(item.quantity, 8)
})

test('mobile structure connects value and unit and the focused flow stays in one column', () => {
  hooks = []; const view = ui(Fields, { value: ready(), section: 'dose', onChange() {} })
  assert.equal(nodes(view, n => n.props.className === 'quick-amount').length, 1)
  for (const amount of nodes(view, n => n.props.className === 'quick-amount')) {
    assert.equal(nodes(amount, n => n.type === 'input').length, 1)
    assert.ok(nodes(amount, n => n.type === 'select' || n.props.className === 'quick-unit').length <= 1)
  }
  const css = readFileSync(new URL('../app/protocol/manage/protocols.css', import.meta.url), 'utf8').split('/* Quick Start:')[1]
  assert.doesNotMatch(css, /quick-setup-grid|quick-date-row|quick-section/)
  assert.doesNotMatch(css, /quick-has-review/)
  assert.match(css, /guided-creation \{[^}]*flex-direction: column/)
  assert.match(css, /scroll-margin-block: 120px/)
  assert.match(css, /app shell already reserves the bottom navigation and safe area/)
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(css, /transition: none/)
  assert.match(css, /:focus-visible/)
})

test('legacy canonical adapter remains permissive while Quick Start rejects incomplete drafts', () => {
  const c = quick.selectInventory(form.newCompound(), item)
  const payload = form.protocolCompoundPayload([c])[0]
  assert.equal(payload.phase.dosing_entry.dose, ''); assert.equal(payload.vials_in_stock, null)
  assert.equal(interpretEntry(payload.phase.dosing_entry).medication, null)
  assert.ok(quick.quickStartIssue(draft(c)))
  for (const [key, value] of [['dose', '-1'], ['dose', 'no'], ['vials_in_stock', '-2'], ['vials_in_stock', '.5'], ['syringe_scale', '0'], ['reconstitution_date', '2026-02-30'], ['duration_weeks', '-1']]) assert.throws(() => form.protocolCompoundPayload([{ ...c, [key]: value }]))
})

test('new catalog identities and Greek, hyphen, abbreviation and whitespace aliases resolve exactly', () => {
  for (const alias of ['Thymosin Alpha-1', 'Thymosin alpha 1', 'Thymosin α1', 'Thymosin Α1', 'Thymosin‑α1', 'TA-1', 'TA1', '  TA — 1  ']) {
    const match = catalog.resolveCompound(alias)
    assert.equal(match.name, 'Thymosin Alpha-1', alias)
    assert.equal(catalog.compoundBrowseCategory(match), 'Peptides')
    assert.equal(catalog.compoundSearch(alias).customName, null)
    assert.equal(quick.selectCompound(form.newCompound(), alias).name, match.name)
  }
  for (const alias of ['5-Amino-1MQ', '5 amino 1mq', '5-amino-1mq', '5 Amino 1MQ', '5Amino1MQ', ' 5–AMINO–1MQ ']) {
    const match = catalog.resolveCompound(alias)
    assert.equal(match.name, '5-Amino-1MQ', alias)
    assert.equal(match.category, 'Other medications')
    assert.equal(catalog.compoundBrowseCategory(match), 'Other')
    assert.equal(catalog.compoundSearch(alias).customName, null)
  }
  for (const name of ['Thymosin Alpha-1', '5-Amino-1MQ']) {
    const selected = quick.selectCompound(form.newCompound(), name)
    assert.equal(selected.dose, ''); assert.equal(selected.route, ''); assert.equal(selected.dose_unit, '')
  }
})

test('custom identity remains available beside partial matches and normalizes only readable whitespace', () => {
  const partial = catalog.compoundSearch('Thymosin')
  assert.ok(partial.matches.some(c => c.name === 'Thymosin Alpha-1'))
  assert.equal(partial.customName, 'Thymosin')
  assert.equal(catalog.compoundSearch('TA1').customName, null)
  assert.equal(catalog.compoundSearch('  Thymosin   Beta\tBlend  ').customName, 'Thymosin Beta Blend')
  for (const empty of ['', ' ', '\t\n']) assert.equal(catalog.compoundSearch(empty).customName, null)
  for (const invalid of ['---', 'A'.repeat(101), 'Name\u200b', '<compound>']) {
    assert.ok(catalog.compoundSearch(invalid).error)
    assert.equal(catalog.compoundSearch(invalid).customName, null)
    const current = form.newCompound()
    assert.equal(quick.selectCompound(current, invalid), current)
  }
  assert.equal(catalog.compoundSearch('(R)-α-lipoic acid / [13C6] blend').customName, '(R)-α-lipoic acid / [13C6] blend')
  const custom = quick.selectCompound(ready({ route: 'SubQ', days_of_week: [1], concentration_value: '5', duration_weeks: '12' }), '  Thymosin  Beta  Blend ')
  assert.equal(custom.name, 'Thymosin Beta Blend')
  for (const key of ['dose', 'dose_unit', 'route', 'concentration_value', 'concentration_unit', 'vial_strength', 'bac_water_ml', 'duration_weeks', 'time_of_day']) assert.equal(custom[key], '', key)
  assert.deepEqual(custom.days_of_week, [])
})

test('search exposes a meaningful icon, conditional clear action, exact-match keyboard selection and custom editing', () => {
  hooks = []; let value = form.newCompound()
  const render = () => ui(Picker, { value, onChange: next => { value = next } })
  const input = () => field(render(), 'Search compounds')
  assert.equal(input().props.autoCapitalize, 'none'); assert.equal(input().props.spellCheck, false)
  assert.equal(input().props.enterKeyHint, 'search')
  assert.ok(nodes(render(), n => n.type === 'svg' && n.props['aria-hidden'] === 'true').length)
  assert.equal(field(render(), 'Clear compound search'), undefined)
  input().props.onChange({ target: { value: 'Thymosin' } })
  assert.ok(button(render(), 'Thymosin Alpha-1')); assert.ok(button(render(), 'Use “Thymosin”'))
  field(render(), 'Clear compound search').props.onClick(); assert.equal(input().props.value, '')
  input().props.onChange({ target: { value: '  My   custom compound  ' } })
  button(render(), 'Use “My custom compound”').props.onClick()
  assert.equal(value.name, 'My custom compound')
  button(render(), 'Change').props.onClick(); assert.equal(input().props.value, value.name)
  input().props.onChange({ target: { value: '  TA1  ' } })
  let prevented = false
  input().props.onKeyDown({ key: 'Enter', preventDefault() { prevented = true } })
  assert.ok(prevented); assert.equal(value.name, 'Thymosin Alpha-1')
})

test('a custom compound completes the same intake and canonical display without medical defaults', () => {
  hooks = []; let value = quick.createQuickStart(undefined, undefined, '2026-09-22')
  const render = () => ui(View, { value, today: '2026-09-22', onChange: next => { value = next } })
  field(render(), 'Search compounds').props.onChange({ target: { value: '  Thymosin Beta Blend  ' } })
  button(render(), 'Use “Thymosin Beta Blend”').props.onClick()
  button(render(), 'Continue').props.onClick()
  field(render(), 'How do you take it?').props.onChange({ target: { value: 'SubQ' } })
  assert.ok(field(render(), 'Dose per injection'))
  assert.equal(field(render(), 'Medication dose unit').props.value, '')
  field(render(), 'Dose per injection').props.onChange({ target: { value: '5' } })
  assert.equal(nodes(render(), n => n.props.role === 'alert').length, 1)
  assert.equal(text(nodes(render(), n => n.props.role === 'alert')[0]), 'Choose a unit to continue')
  const unit = field(render(), 'Medication dose unit')
  assert.equal(unit.props['aria-invalid'], true)
  assert.equal(nodes(render(), n => n.props.id === unit.props['aria-describedby']).length, 1)
  field(render(), 'Medication dose unit').props.onChange({ target: { value: 'mg' } })
  assert.equal(nodes(render(), n => n.props.role === 'alert').length, 0)
  button(render(), 'Continue').props.onClick(); button(render(), 'Weekly').props.onClick(); field(render(), 'Saturday').props.onClick()
  button(render(), 'Continue').props.onClick(); button(render(), 'I don’t know yet').props.onClick()
  assert.equal(quick.quickStartIssue(value), null)
  const payload = form.protocolCompoundPayload(value.compounds)[0]
  assert.equal(payload.name, 'Thymosin Beta Blend'); assert.equal(payload.phase.dosing_entry.dose_unit, 'mg')
  assert.deepEqual(payload.phase.days_of_week, [6]); assert.equal(payload.phase.time_of_day, '')
  assert.equal(dosingDisplay(payload.phase).primary, '5 mg')
  assert.equal(quick.quickStartDates(value.startDate).startDate, null)
  button(render(), 'Review protocol').props.onClick(); assert.ok(field(render(), 'Review protocol'))
})

test('frequency asks Which days and every day has a full accessible name, including weekends', () => {
  hooks = []; let value = ready()
  const render = () => ui(Fields, { value, onChange: next => { value = next } })
  button(render(), 'Custom').props.onClick()
  assert.doesNotMatch(text(render()), /On weekdays/)
  assert.match(text(render()), /Which days\?/)
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) assert.ok(field(render(), day))
  field(render(), 'Saturday').props.onClick(); field(render(), 'Sunday').props.onClick()
  assert.deepEqual(value.days_of_week, [6, 0])
  for (const day of ['Saturday', 'Sunday']) {
    assert.equal(field(render(), day).props['aria-pressed'], true)
    assert.equal(nodes(field(render(), day), n => n.type === 'svg').length, 1, 'Selected day has a non-color indicator')
  }
})

test('time questions follow route and compact choices preserve an explicit time or Not specified', () => {
  for (const [route, question] of [['SubQ', 'When do you inject this dose?'], ['IM', 'When do you inject this dose?'], ['Oral', 'When do you take this dose?'], ['Other', 'When do you use this dose?'], ['', 'When do you use this dose?']]) {
    hooks = []; let value = ready({ route })
    const render = () => ui(Additional, { value, today: '2026-09-22', onChange: next => { value = next } })
    assert.ok(text(render()).includes(question)); assert.doesNotMatch(text(render()), /Time of day/)
    assert.equal(button(render(), 'Not specified').props['aria-pressed'], true)
    button(render(), 'Evening').props.onClick(); assert.equal(value.time_of_day, 'Evening')
    button(render(), 'Not specified').props.onClick(); assert.equal(value.time_of_day, '')
  }
})

test('preparation distinguishes concentration from strength and switches BAC wording without hidden placeholders', () => {
  hooks = []; let value = ready()
  const render = () => ui(Additional, { value, today: '2026-09-22', onChange: next => { value = next } })
  assert.doesNotMatch(text(render()), /How is it supplied\?/)
  assert.match(text(render()), /Does the vial need mixing\?/)
  assert.equal(nodes(render(), n => n.props.className === 'quick-amount-field').length, 0)
  button(render(), 'Ready to use').props.onClick()
  assert.match(text(render()), /What concentration is printed on the label\?/)
  assert.match(text(render()), /Example: 5 mg\/mL/)
  assert.equal(field(render(), 'Vial strength'), undefined)
  field(render(), 'Labeled concentration').props.onChange({ target: { value: '5' } })
  button(render(), 'Needs mixing').props.onClick()
  assert.match(text(render()), /What is the vial strength\?/)
  assert.match(text(render()), /Has the vial already been mixed\?/)
  assert.match(text(render()), /How much BAC water will you add\?/)
  assert.doesNotMatch(text(render()), /How much BAC water did you add\?/)
  assert.equal(field(render(), 'Reconstitution date'), undefined)
  button(render(), 'Mixed today').props.onClick()
  assert.equal(value.reconstitution_date, '2026-09-22')
  assert.match(text(render()), /How much BAC water did you add\?/)
  assert.doesNotMatch(text(render()), /How much BAC water will you add\?/)
  assert.equal(field(render(), 'Reconstitution date'), undefined, 'Mixed today does not need a redundant date field')
  button(render(), 'Choose date').props.onClick(); assert.ok(field(render(), 'Reconstitution date'))
  button(render(), 'Not yet').props.onClick(); assert.equal(field(render(), 'Reconstitution date'), undefined)
  value = form.updateCompoundDraft(value, 'route', 'Oral')
  assert.equal(nodes(render(), n => n.props.className === 'quick-preparation').length, 0)
  assert.equal(field(render(), 'Vial strength'), undefined)
  assert.equal(value.concentration_value, '5', 'Hiding preparation preserves the entered facts')
})

test('segmented selection, disclosure, validation and amount groups have accessible structure', () => {
  hooks = []; let value = quick.createQuickStart()
  const render = () => ui(View, { value, today: '2026-09-22', onChange: next => { value = next } })
  const categories = field(render(), 'Compound category')
  assert.equal(categories.props.role, 'group')
  assert.equal(nodes(categories, n => n.type === 'button').length, 2)
  assert.equal(button(categories, 'Peptides').props['aria-pressed'], true)
  assert.equal(nodes(button(categories, 'Peptides'), n => n.type === 'svg').length, 1)
  button(render(), 'Tirzepatide').props.onClick(); button(render(), 'Continue').props.onClick()
  const toggle = button(render(), 'I measure my dose another way')
  assert.equal(toggle.props['aria-expanded'], false)
  assert.equal(nodes(render(), n => n.props.id === toggle.props['aria-controls']).length, 0)
  toggle.props.onClick()
  assert.equal(button(render(), 'I measure my dose another way').props['aria-expanded'], true)
  assert.equal(nodes(render(), n => n.props.id === toggle.props['aria-controls']).length, 1)
  const details = nodes(render(), n => n.type === 'details')[0]
  assert.equal(details.props.open, undefined)
  assert.equal(nodes(details, n => n.type === 'summary').length, 1)
  assert.equal(nodes(nodes(details, n => n.type === 'summary')[0], n => n.type === 'svg').length, 1)
})
