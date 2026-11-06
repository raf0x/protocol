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
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
    if (name === 'react') return { ...React, ...renderer.hooks }
    if (!name.startsWith('.')) return require(name)
    return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url))
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}
const catalog = load('../lib/protocols/catalog.ts'), form = load('../lib/protocols/form.ts'), quick = load('../lib/protocols/quickStart.ts')
const { protocolLifecycle } = load('../lib/health/protocolDates.ts')
const { interpretEntry, entryFromForm, entryFormState, dosingDisplay } = load('../lib/health/dosingEntry.ts')
const { measurementPreview, updateCreation } = load('../lib/protocols/creationMeasurement.ts')
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

const mixed = (extra = {}) => entryFromForm({ isPreMixed: false, input_mode: 'syringe', syringe_markings: '20', syringe_scale: '100', preparation: 'mixing', vial_strength: '10', vial_unit: 'mg', bac_water_ml: '1.8', final_solution_volume_ml: '2', preparation_confirmed: true, reviewed: true, ...extra })
test('confirmed final volume, never liquid added, determines the display equivalent', () => {
  for (const unit of ['mg','mcg','IU']) for (const [scale, marking] of [['100','20'],['40','8']]) {
    const e = mixed({ vial_unit: unit, syringe_scale: scale, syringe_markings: marking }), before = JSON.stringify(e), r = measurementPreview(e)
    assert.deepEqual(r.medication, { value: 1, unit }); assert.equal(r.volume, .2); assert.equal(r.concentration.value, 5)
    assert.equal(JSON.stringify(e), before); assert.equal(e.concentration_value, ''); assert.equal(e.dose, '')
  }
})
test('missing, invalid and unsupported facts never produce a precise medication equivalent', () => {
  for (const patch of [{ final_solution_volume_ml: '' }, { final_solution_volume_ml: undefined }, { final_solution_volume_ml: '0' }, { final_solution_volume_ml: '-2' }, { final_solution_volume_ml: 'NaN' }, { vial_unit: '' }, { vial_unit: 'g' }, { syringe_scale: '' }, { syringe_scale: '50' }, { preparation_confirmed: false }, { preparation_confirmed: undefined }, { review_status: 'unverified' }, { preparation: 'unknown' }, { vial_strength: '' }, { mode: 'unknown' }]) assert.equal(measurementPreview({ ...mixed(), ...patch }).medication, null, JSON.stringify(patch))
  assert.throws(() => entryFromForm({ final_solution_volume_ml: '-1' }), /final_solution_volume/)
})
test('labeled concentration is confirmed independently; conflicts suppress calculation and preserve facts', () => {
  const e = mixed({ preparation: 'ready', vial_strength: '', vial_unit: '', final_solution_volume_ml: '', concentration_value: '5', concentration_unit: 'mg/mL' })
  assert.equal(measurementPreview(e).medication.value, 1)
  assert.equal(measurementPreview({ ...e, preparation_confirmed: undefined }).medication, null)
  const conflict = mixed({ concentration_value: '6', concentration_unit: 'mg/mL' }), before = structuredClone(conflict)
  assert.equal(measurementPreview(conflict).medication, null); assert.deepEqual(conflict, before)
  assert.equal(measurementPreview(mixed({ concentration_value: '5000', concentration_unit: 'mcg/mL' })).medication.value, 1)
  assert.equal(measurementPreview(mixed({ concentration_value: '5', concentration_unit: 'IU/mL' })).medication, null)
})
test('mass conversions are supported; IU never crosses the mass boundary; contradictions suppress all precision', () => {
  assert.equal(measurementPreview(mixed({ input_mode: 'medication', dose: '1000', dose_unit: 'mcg', syringe_markings: '' })).volume, .2)
  assert.equal(measurementPreview(mixed({ input_mode: 'medication', dose: '1', dose_unit: 'IU', syringe_markings: '' })).medication, null)
  for (const patch of [{ injection_volume: '0.3' }, { dose: '2', dose_unit: 'mg' }, { dose: '1', dose_unit: 'IU' }, { concentration_unit: 'mg/L', concentration_value: '5' }]) assert.equal(measurementPreview(mixed(patch)).medication, null)
})
test('legacy JSON remains unconfirmed and historical payload behavior is unchanged', () => {
  const legacy = mixed(); delete legacy.final_solution_volume_ml; delete legacy.preparation_confirmed
  const draft = entryFormState({ dosing_entry: legacy })
  assert.deepEqual(entryFromForm(draft), legacy); assert.equal(measurementPreview(legacy).medication, null)
  const historical = { id: 'phase', dosing_entry: { ...mixed(), custom: 'preserve' }, start_week: 1, end_week: null, duration_weeks: null, frequency: 'daily', days_of_week: [0,1,2,3,4,5,6], day_of_week: 0, time_of_day: '', route: 'SubQ' }
  let c = { ...form.newCompound(), ...entryFormState(historical), id: 'compound', phase_id: 'phase', name: 'Synthetic compound', days_of_week: historical.days_of_week, route: 'SubQ' }
  c = form.captureHistoricalCompound(c, { id: 'compound', name: c.name, notes: '', reconstitution_date: null, vials_in_stock: null }, historical)
  assert.deepEqual(form.protocolCompoundPayload([c])[0].phase.dosing_entry, historical.dosing_entry)
})
test('creation calibration is never defaulted and changing facts invalidates confirmation', () => {
  let c = { ...form.newCompound(), preparation_confirmed: true, final_solution_volume_ml: '2' }
  c = updateCreation(c, 'input_mode', 'syringe'); assert.equal(c.syringe_scale, '')
  c = updateCreation(c, 'final_solution_volume_ml', '3'); assert.equal(c.preparation_confirmed, false); assert.equal(c.reviewed, false)
  assert.equal(quick.applyDefaults(c, { preparation_confirmed: true }, 'previous').preparation_confirmed, false)
})
test('three-stage flow keeps facts separate from preview and saves only entered amounts', () => {
  hooks = []; let saved, value = { startDate: '2026-11-05', compounds: [{ ...form.newCompound(), name: 'Synthetic compound', ...entryFormState({ dosing_entry: mixed() }), route: 'SubQ' }] }
  const render = () => ui(View, { value, today: '2026-11-05', onChange: next => { value = next }, onSave: () => { saved = form.protocolCompoundPayload(value.compounds) } })
  assert.match(text(render()), /Preparation/); assert.equal(nodes(render(), n => n.type === 'progress')[0].props.max, 3)
  button(render(), 'Continue').props.onClick(); assert.match(text(render()), /Measurement/)
  assert.match(text(render()), /0.2 mL ≈ 1 mg/)
  button(render(), 'Continue').props.onClick(); assert.match(text(render()), /Schedule and review/)
  button(render(), 'Daily').props.onClick(); assert.match(text(render()), /Facts to save/)
  button(render(), 'Start tracking').props.onClick()
  assert.equal(saved[0].phase.dosing_entry.dose, ''); assert.equal(saved[0].phase.dosing_entry.concentration_value, '')
  assert.equal(saved[0].phase.dosing_entry.final_solution_volume_ml, '2'); assert.equal(saved[0].phase.frequency, 'daily')
})

test('invalid preparation stays on Preparation with an associated field error, then advances after correction', () => {
  hooks = []; let value = { startDate: '', compounds: [{ ...form.newCompound(), name: 'Synthetic', preparation: 'mixing', vial_strength: '-1', dose: '-1' }] }
  const render = () => ui(View, { value, today: '2026-11-05', onChange: next => { value = next } })
  button(render(), 'Continue').props.onClick()
  assert.equal(text(nodes(render(), n => n.type === 'h1')), 'Preparation')
  const input = field(render(), 'Amount in the vial')
  assert.equal(input.props['aria-invalid'], true)
  assert.ok(nodes(render(), n => n.props.id === input.props['aria-describedby']).length)
  input.props.onChange({ target: { value: '10' } })
  button(render(), 'Continue').props.onClick()
  assert.equal(text(nodes(render(), n => n.type === 'h1')), 'Measurement')
})

test('measurement errors identify amount, unit, markings, volume, calibration and final volume', () => {
  const { CreationMeasurement } = load('../components/protocols/CreationMeasurement.tsx')
  for (const [key, label, patch] of [
    ['dose', 'Your intended amount', {}], ['dose_unit', 'Medication unit', {}],
    ['syringe_markings', 'Syringe marking', { input_mode: 'syringe' }],
    ['injection_volume', 'Liquid volume', { input_mode: 'volume' }],
    ['final_solution_volume_ml', 'Final solution volume', { preparation: 'mixing' }],
  ]) {
    hooks = []; const view = ui(CreationMeasurement, { value: { ...form.newCompound(), ...patch }, idPrefix: 'test', onChange: () => {}, issue: { index: 0, field: key, message: 'Correct this amount' } })
    const control = field(view, label)
    assert.equal(control.props['aria-invalid'], true, key)
    assert.ok(control.props['aria-describedby'].split(' ').some(id => nodes(view, n => n.props.id === id && n.props.role === 'alert').length), key)
  }
  hooks = []; const view = ui(CreationMeasurement, { value: { ...form.newCompound(), input_mode: 'syringe' }, idPrefix: 'test', onChange: () => {}, issue: { index: 0, field: 'syringe_scale', message: 'Choose U-100 or U-40' } })
  const group = nodes(view, n => n.type === 'fieldset' && text(n).includes('Calibration on your syringe'))[0]
  assert.ok(nodes(view, n => n.props.id === group.props['aria-describedby'] && n.props.role === 'alert').length)
})

test('review uses plain preparation labels and only relevant syringe calibration', () => {
  const { CreationFacts } = load('../components/protocols/CreationMeasurement.tsx')
  for (const [preparation, label] of [['mixing', 'Preparing a vial'], ['ready', 'Ready to use'], ['unknown', 'Preparation not specified']]) {
    hooks = []; const view = ui(CreationFacts, { value: { ...form.newCompound(), preparation } })
    assert.match(text(view), new RegExp(label)); assert.doesNotMatch(text(view), /Syringe calibration/)
  }
  hooks = []; assert.match(text(ui(CreationFacts, { value: { ...form.newCompound(), input_mode: 'syringe' } })), /Syringe calibrationNot confirmed/)
})

test('unspecified route stays null in canonical payload and does not change schedule', () => {
  const c = { ...form.newCompound(), name: 'Synthetic', days_of_week: [1,4] }
  assert.equal(quick.quickStartIssue({ startDate: '', compounds: [c] }), null)
  const phase = form.protocolCompoundPayload([c])[0].phase
  assert.equal(phase.route, null); assert.equal(phase.frequency, '2x/week'); assert.deepEqual(phase.days_of_week, [1,4])
})


test('all invalid preparation amounts expose their own controls, including retained hidden facts', () => {
  for (const [key, label] of [['vial_strength', 'Amount in the vial'], ['bac_water_ml', 'Bacteriostatic water added'], ['concentration_value', 'Concentration on the label']]) {
    hooks = []; let value = { startDate: '', compounds: [{ ...form.newCompound(), name: 'Synthetic', preparation: 'unknown', [key]: '-1' }] }
    const render = () => ui(View, { value, today: '2026-11-05', onChange: next => { value = next } })
    button(render(), 'Continue').props.onClick()
    assert.equal(text(nodes(render(), n => n.type === 'h1')), 'Preparation')
    assert.equal(field(render(), label).props['aria-invalid'], true)
    assert.equal(quick.quickStartIssue(value).field, key)
    field(render(), label).props.onChange({ target: { value: '' } })
    button(render(), 'Continue').props.onClick()
    assert.equal(text(nodes(render(), n => n.type === 'h1')), 'Measurement')
  }
})

test('save returns an invalid preparation to its associated control instead of Measurement', () => {
  hooks = []; let saved = false, value = { startDate: '', compounds: [{ ...form.newCompound(), name: 'Synthetic', preparation: 'ready', days_of_week: [1] }] }
  const render = () => ui(View, { value, today: '2026-11-05', onChange: next => { value = next }, onSave: () => { saved = true } })
  button(render(), 'Continue').props.onClick(); button(render(), 'Continue').props.onClick()
  value = { ...value, compounds: [{ ...value.compounds[0], concentration_value: '-1' }] }
  button(render(), 'Save protocol').props.onClick()
  assert.equal(saved, false)
  assert.equal(text(nodes(render(), n => n.type === 'h1')), 'Preparation')
  assert.equal(field(render(), 'Concentration on the label').props['aria-invalid'], true)
})


test('every derived equivalent requires explicit compatible syringe calibration', () => {
  for (const mode of ['medication', 'volume', 'syringe']) {
    const entry = mixed({ input_mode: mode, dose: mode === 'medication' ? '1' : '', dose_unit: mode === 'medication' ? 'mg' : '', injection_volume: mode === 'volume' ? '0.2' : '', syringe_markings: mode === 'syringe' ? '20' : '' })
    for (const syringe_scale of ['', undefined, '50']) assert.equal(measurementPreview({ ...entry, syringe_scale }).medication, null)
    assert.ok(measurementPreview({ ...entry, syringe_scale: '100' }).medication)
  }
})

test('mixed preparation asks for water and date once, while unmixed and ready paths stay simple', () => {
  const { CreationPreparation } = load('../components/protocols/CreationMeasurement.tsx')
  hooks = []; let value = { ...form.newCompound(), name: 'Synthetic' }
  const render = () => ui(CreationPreparation, { value, idPrefix: 'prep', onChange: next => { value = next } })
  assert.equal(field(render(), 'Reconstitution date'), undefined)
  button(render(), 'Yes').props.onClick()
  assert.ok(field(render(), 'Bacteriostatic water added')); assert.ok(field(render(), 'Reconstitution date'))
  field(render(), 'Reconstitution date').props.onChange({ target: { value: '2026-11-01' } })
  assert.match(text(render()), /28-day check reminder: Nov 29/)
  assert.equal(nodes(render(), n => n.props?.['aria-label'] === 'Amount in the vial').length, 1)
  assert.equal(field(render(), 'Final solution volume'), undefined)
  assert.equal(form.protocolCompoundPayload([value])[0].phase.dosing_entry.mixingStatus, undefined)
  value = { ...form.newCompound(), name: 'Synthetic' }; button(render(), 'No').props.onClick()
  assert.equal(field(render(), 'Bacteriostatic water added'), undefined)
  button(render(), 'Ready to use').props.onClick()
  assert.ok(field(render(), 'Concentration on the label')); assert.equal(field(render(), 'Amount in the vial'), undefined)
})

test('ready-to-use reproduction retains 10 mg and uses confirmed 5 mg/mL for 1 mg at U-100', () => {
  hooks = []; let value = { ...form.newCompound(), name:'Synthetic', vial_strength:'10', vial_unit:'mg' }
  const { CreationPreparation, CreationMeasurement } = load('../components/protocols/CreationMeasurement.tsx')
  const props = () => ({ value, idPrefix:'repro', onChange:next=>{value=next} })
  button(ui(CreationPreparation, props()), 'Ready to use').props.onClick()
  field(ui(CreationPreparation, props()), 'Concentration on the label').props.onChange({target:{value:'5'}})
  field(ui(CreationPreparation, props()), 'Concentration on the label unit').props.onChange({target:{value:'mg/mL'}})
  value = updateCreation(value,'input_mode','medication'); value=updateCreation(value,'dose','1'); value=updateCreation(value,'dose_unit','mg')
  button(ui(CreationMeasurement,props()), 'U-100').props.onClick()
  for(let i=0;i<2;i++)nodes(ui(CreationMeasurement,props()),n=>n.type==='input'&&n.props.type==='checkbox')[i].props.onChange({target:{checked:true}})
  const before=JSON.stringify(value), entry=entryFromForm(value), result=measurementPreview(entry)
  assert.equal(result.markings,20,result.message);assert.equal(result.volume,.2)
  assert.match(text(ui(CreationMeasurement,props())),/20 markings on U-100/)
  assert.equal(field(ui(CreationMeasurement,props()),'Final solution volume'),undefined)
  assert.equal(JSON.stringify(value),before);assert.equal(entry.vial_strength,'10');assert.equal(entry.concentration_value,'5')
  const withoutAmount={...entry,vial_strength:'',vial_unit:''}
  assert.equal(measurementPreview(withoutAmount).markings,20)
})

test('ready labels do not infer concentration from retained vial or water facts; mixed inputs still need final volume', () => {
  const ready=mixed({preparation:'ready',input_mode:'medication',dose:'1',dose_unit:'mg',syringe_markings:'',final_solution_volume_ml:'',concentration_value:'5',concentration_unit:'mg/mL'})
  const before=structuredClone(ready)
  assert.equal(measurementPreview(ready).markings,20);assert.deepEqual(ready,before)
  assert.equal(measurementPreview({...ready,preparation:'mixing'}).medication,null)
  for(const patch of [{syringe_scale:''},{syringe_scale:'50'},{dose_unit:'IU'},{concentration_unit:'IU/mL'},{concentration_unit:'mg/L'},{preparation_confirmed:false},{review_status:'unverified'}])assert.equal(measurementPreview({...ready,...patch}).medication,null,JSON.stringify(patch))
  assert.equal(measurementPreview({...ready,syringe_scale:'40'}).markings,8)
})

test('complete conflicting active preparation stays blocked and can be corrected without deleting facts', () => {
  const {CreationMeasurement}=load('../components/protocols/CreationMeasurement.tsx')
  for(const preparation of ['ready','mixing']) {
    hooks=[];let value={...form.newCompound(),...entryFormState({dosing_entry:mixed({preparation,concentration_value:'6',concentration_unit:'mg/mL'})})}
    const render=()=>ui(CreationMeasurement,{value,idPrefix:'conflict',onChange:next=>{value=next}})
    const before=JSON.stringify(value), result=measurementPreview(entryFromForm(value))
    assert.equal(result.medication,null);assert.match(result.message,/Concentration on the label.*Amount in the vial.*Final solution volume/)
    for(const name of ['Amount in the vial','Amount in the vial unit','Concentration on the label','Concentration on the label unit','Final solution volume'])assert.ok(field(render(),name),name)
    assert.match(text(render()),/Review preparation facts/);assert.equal(JSON.stringify(value),before)
    field(render(),'Concentration on the label').props.onChange({target:{value:'5'}})
    assert.equal(value.preparation_confirmed,false)
    value=updateCreation(value,'preparation_confirmed',true);value=updateCreation(value,'reviewed',true)
    assert.equal(measurementPreview(entryFromForm(value)).markings,20)
    assert.equal(value.vial_strength,'10');assert.equal(value.bac_water_ml,'1.8');assert.equal(value.final_solution_volume_ml,'2');assert.equal(value.concentration_value,'5')
  }
})

test('ready preparation with explicit partial final-volume facts cannot evade consistency checks', () => {
  const entry=mixed({preparation:'ready',vial_strength:'',vial_unit:'',concentration_value:'5',concentration_unit:'mg/mL'})
  assert.equal(measurementPreview(entry).medication,null)
  const {CreationMeasurement}=load('../components/protocols/CreationMeasurement.tsx');hooks=[]
  const view=ui(CreationMeasurement,{value:{...form.newCompound(),...entryFormState({dosing_entry:entry})},idPrefix:'partial',onChange:()=>{}})
  assert.ok(field(view,'Amount in the vial'));assert.ok(field(view,'Final solution volume'))
})
