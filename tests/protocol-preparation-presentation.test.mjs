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
  assert.doesNotMatch(html, /Remaining not tracked/)
  assert.equal(JSON.stringify(p), before)
})
for (const snapshot of [false,true]) test(`Hero ${snapshot} prefers phase 3000 IU over legacy 5000 IU`, () => {
  const html = hero(savedProtocol('3000','IU',{vial_strength:5000,vial_unit:'IU'}), snapshot)
  assert.match(html, /3,000 IU|3000 IU/); assert.doesNotMatch(html, /5,000 IU|5000 IU/)
})
test('unknown vial is visually distinct from known empty without a liquid level', () => {
  const unknown = render(Vial,{name:'Synthetic',remainingFraction:null,remainingMl:null})
  const empty = render(Vial,{name:'Synthetic',remainingFraction:0,remainingMl:0})
  assert.match(unknown, /data-vial-interior="untracked"/); assert.doesNotMatch(unknown, /data-vial-liquid|0%|0 mL|>\?<\/text>/)
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

const { heroAdministration, heroDoseCount, heroNextDose } = load('../lib/health/heroPresentation.ts')
const { entryFromForm } = load('../lib/health/dosingEntry.ts')
const syringeEntry = extra => entryFromForm({ input_mode:'syringe', syringe_markings:'50', syringe_scale:'100', reviewed:true, ...extra })
test('Hero derives only liquid volume from confirmed markings, independently of preparation or IU', () => {
  for (const scale of ['100','40']) {
    const phase = { dosing_entry:syringeEntry({syringe_scale:scale,vial_strength:'30',vial_unit:'IU'}) }, before=JSON.stringify(phase)
    const result=heroAdministration(phase)
    assert.equal(result.syringe,'50 units \u00b7 U-'+scale)
    assert.deepEqual(result.volume,{label:'Calculated volume',value:scale==='100'?'0.5 mL':'1.25 mL'})
    assert.equal(result.issue,null);assert.equal(JSON.stringify(phase),before);assert.equal(result.medication,undefined)
  }
})
test('Hero suppresses volume for unconfirmed, unsupported, invalid or unproven markings', () => {
  const entry=syringeEntry()
  for(const changed of [{review_status:'unverified'},{version:1},{syringe_scale:''},{syringe_scale:'50'},{syringe_scale:'100/40'},{syringe_markings:'bad'},{syringe_markings:'-1'},{syringe_markings:'Infinity'},{syringe_markings:'0x32'},{mode:'unknown'}])assert.equal(heroAdministration({dosing_entry:{...entry,...changed}}).volume,null)
  assert.equal(heroAdministration({syringe_units:50,syringe_scale:100}).volume,null)
})
test('Hero preserves and blocks inconsistent recorded volume rather than selecting it', () => {
  for(const mode of ['syringe','volume','medication']) for(const volume of ['0.6','bad','-1']) {
    const phase={dosing_entry:{...syringeEntry(),mode,injection_volume:volume}},before=JSON.stringify(phase),result=heroAdministration(phase)
    assert.equal(result.volume,null);assert.match(result.issue,/saved volume and syringe markings disagree/);assert.equal(JSON.stringify(phase),before)
  }
  assert.equal(heroAdministration({dosing_entry:syringeEntry({injection_volume:'0.5'})}).volume.label,'Calculated volume')
  assert.deepEqual(heroAdministration({dosing_entry:entryFromForm({input_mode:'volume',injection_volume:'0.168637'})}).volume,{label:'Recorded volume',value:'0.168637 mL'})
})
test('Doses taken counts supported unique history without adding the saved counter or inventing zero', () => {
  const logs=[{compound_id:'c',taken:true,date:'2026-11-01'},{compound_id:'c',taken:true,date:'2026-11-01'},{compound_id:'c',taken:true,date:'2026-11-03'},{compound_id:'other',taken:true,date:'2026-11-02'},{compound_id:'c',taken:false,date:'2026-11-04'},{compound_id:'c',taken:true,date:'invalid'},{compound_id:'c',taken:true,date:'2026-12-01'}]
  assert.equal(heroDoseCount('c',50,logs,'2026-11-05').value,'2 logged')
  assert.match(heroDoseCount('c',50,logs,'2026-11-05').note,/Saved compound counter: 50/)
  for(const value of [null,undefined,'',-1,'bad',1.5])assert.equal(heroDoseCount('c',value,[],'2026-11-05').value,'Not established')
  assert.equal(heroDoseCount('c',0,[],'2026-11-05').value,'Not established');assert.equal(heroDoseCount('c',3,[],'2026-11-05').value,'Not established')
})
test('Next dose uses complete recorded calendar schedules and respects taken dates and phase boundaries', () => {
  const protocol={start_date:'2026-11-01',status:'active'},phase={id:'p',start_week:1,end_week:null,frequency:'daily'},compound={id:'c',phases:[phase]}
  const next=(extra,logs=[],p=protocol)=>heroNextDose(p,{...compound,phases:[{...phase,...extra}]},logs,'2026-11-05')
  assert.equal(next({}),'2026-11-05');assert.equal(next({},[{compound_id:'c',taken:true,date:'2026-11-05'}]),'2026-11-06')
  assert.equal(next({frequency:'1x/week',days_of_week:[0]}),'2026-11-08')
  assert.equal(next({frequency:'1x/week',day_of_week:0}),'2026-11-08')
  assert.equal(next({frequency:'2x/week',days_of_week:[1,5]}),'2026-11-06')
  assert.equal(next({frequency:'every3days'}),'2026-11-07')
  for(const extra of [{frequency:'1x/week'},{frequency:'2x/week'},{frequency:'bad'},{frequency:'1x/week',days_of_week:'Sunday'},{frequency:'1x/week',days_of_week:[8]},{frequency:'2x/week',days_of_week:[1]}])assert.equal(next(extra),null)
  assert.equal(next({},[],{...protocol,status:'paused'}),null)
  assert.equal(next({},[],{...protocol,start_date:'invalid'}),null)
  assert.equal(next({},[],{...protocol,start_date:'2026-11-10'}),'2026-11-10')
  assert.equal(heroNextDose(protocol,{id:'c',phases:[phase,{...phase,id:'overlap'}]},[],'2026-11-05'),null)
  assert.equal(next({frequency:'1x/week',days_of_week:[0],end_week:1}),null)
})
for(const snapshot of [false,true]) test('Owner screenshot facts are consistent in Hero '+snapshot,()=>{
 const p=savedProtocol('30','mg');p.compounds[0].phases[0].dosing_entry=syringeEntry({vial_strength:'30',vial_unit:'mg',bac_water_ml:'3'});p.compounds[0].phases[0].frequency='1x/week';p.compounds[0].phases[0].days_of_week=[];p.compounds[0].phases[0].day_of_week=null
 const before=JSON.stringify(p),html=render(Hero,{activeProtocols:[p],activeCompoundTab:'compound',compoundIndex:0,snapshot,logs:{},allLogs:[{compound_id:'compound',taken:true,date:'2026-11-01'}],totalLost:null})
 for(const expected of [/30 mg/,/Nov 1, 2026/,/Nov 29, 2026/,/50 units \u00b7 U-100/,/Syringe volume<\/dt><dd>0.5 mL<\/dd>/,/BAC water added<\/dt><dd>3 mL/,/Doses taken<\/dt><dd>1 logged/,/Schedule not set/])assert.match(html,expected)
 assert.doesNotMatch(html,/More protocol details|Vial expiration|Recorded compound dose count|Vials in stock|0.5 mg/)
 assert.equal(JSON.stringify(p),before)
})

const { preparationPresentation } = load('../lib/health/preparationPresentation.ts')
test('BAC water uses the same selected preparation source and preserves missing/invalid facts',()=>{
 const legacy={vial_strength:5000,vial_unit:'IU',bac_water_ml:9}
 for(const raw of [undefined,null,'','  ','bad','3 mL','0x03',false,-1,Infinity]) {
  const phase={dosing_entry:{vial_strength:'30',vial_unit:'mg',bac_water_ml:raw}},before=JSON.stringify({legacy,phase}),result=preparationPresentation(legacy,phase)
  assert.deepEqual(result.amount,{value:'30',unit:'mg'});assert.equal(result.waterAdded,null);assert.equal(result.source,'phase');assert.equal(JSON.stringify({legacy,phase}),before)
 }
 for(const entry of [{},false,[], 'malformed'])assert.equal(preparationPresentation(legacy,{dosing_entry:entry}).waterAdded,null)
 assert.deepEqual(preparationPresentation(legacy,{dosing_entry:{vial_strength:'30',vial_unit:'mg',bac_water_ml:'3'}}).waterAdded,{value:'3',unit:'mL'})
 assert.deepEqual(preparationPresentation(legacy,{dosing_entry:{vial_strength:'30',vial_unit:'mg',bac_water_ml:'0'}}).waterAdded,{value:'0',unit:'mL'})
 assert.deepEqual(preparationPresentation(legacy,{}).waterAdded,{value:9,unit:'mL'});assert.equal(preparationPresentation(legacy,{}).source,'legacy')
})
for(const snapshot of [false,true])test('Hero '+snapshot+' keeps phase water separate from historical phases and conflicting legacy units',()=>{
 const p=savedProtocol('30','IU',{vial_strength:100,vial_unit:'mg',bac_water_ml:9}),c=p.compounds[0],phase=c.phases[0]
 phase.start_week=2;phase.dosing_entry.bac_water_ml='3';c.phases.unshift({...phase,id:'past',start_week:1,end_week:1,dosing_entry:{...phase.dosing_entry,vial_strength:'50',vial_unit:'mcg',bac_water_ml:'8'}})
 let before=JSON.stringify(p),html=hero(p,snapshot)
 assert.match(html,/30 IU/);assert.match(html,/BAC water added<\/dt><dd>3 mL/);assert.doesNotMatch(html,/30 mg|50 mcg|BAC water added<\/dt><dd>[89] mL/);assert.equal(JSON.stringify(p),before)
 delete phase.dosing_entry.bac_water_ml;before=JSON.stringify(p);html=hero(p,snapshot);assert.doesNotMatch(html,/BAC water added/);assert.equal(JSON.stringify(p),before)
 phase.dosing_entry.vial_unit='unsupported';phase.dosing_entry.bac_water_ml='3';html=hero(p,snapshot);assert.match(html,/Strength not recorded/);assert.match(html,/BAC water added<\/dt><dd>3 mL/);assert.doesNotMatch(html,/100 mg/)
})
