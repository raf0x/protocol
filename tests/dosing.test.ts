import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../lib/health/dosing.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2021}}).outputText
const { calculateDosing, dosingFields, quickCreatePayload, currentPhase, phaseDosingReview, chooseDoseMeaning, editorDosingInput } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

test('premixed mass medication preserves dose, concentration and phase volume', () => {
  const result = calculateDosing({dose:75,dose_unit:'mg',concentration_value:200,concentration_unit:'mg/mL'})
  assert.deepEqual(result.administeredDose,{value:75,unit:'mg'})
  assert.deepEqual(result.concentration,{value:200,unit:'mg/mL'})
  assert.deepEqual(result.injectionVolume,{value:0.375,unit:'mL'})
  assert.equal(result.syringeUnits,null)
})
test('medication IU is independent of explicitly selected U-100 markings', () => {
  const result = calculateDosing({dose:250,dose_unit:'IU',concentration_value:2500,concentration_unit:'IU/mL',syringe_scale:100})
  assert.deepEqual(result.administeredDose,{value:250,unit:'IU'})
  assert.deepEqual(result.injectionVolume,{value:0.1,unit:'mL'})
  assert.deepEqual(result.syringeUnits,{value:10,unit:'syringe units',scale:100})
})
test('reconstituted mg and mcg doses convert only compatible mass units', () => {
  assert.equal(calculateDosing({dose:3,dose_unit:'mg',vial_strength:30,vial_unit:'mg',bac_water_ml:2}).injectionVolume.value,0.2)
  assert.equal(calculateDosing({dose:250,dose_unit:'mcg',vial_strength:5,vial_unit:'mg',bac_water_ml:2}).injectionVolume.value,0.1)
  assert.equal(calculateDosing({dose:1,dose_unit:'mg',concentration_value:1000,concentration_unit:'mcg/mL'}).injectionVolume.value,1)
})
test('unknown concentrations preserve medication dose without manufacturing administration details', () => {
  const result=dosingFields({dose:3,dose_unit:'mg'})
  assert.equal(result.phase.dose,3)
  assert.equal(result.phase.injection_volume_ml,null)
  assert.equal(result.compound.concentration_value,null)
})
test('rejects volume/syringe as medication units, invalid values and IU/mass conversion', () => {
  for(const unit of ['mL','units','U-100']) assert.throws(()=>calculateDosing({dose:10,dose_unit:unit}))
  for(const dose of [0,-1,NaN,Infinity]) assert.throws(()=>calculateDosing({dose,dose_unit:'mg'}))
  assert.throws(()=>calculateDosing({dose:250,dose_unit:'IU',concentration_value:5,concentration_unit:'mg/mL'}))
  assert.throws(()=>calculateDosing({dose:3,dose_unit:'mg',syringe_scale:100}))
})
test('quick create validates explicit units and supports mg mcg IU without forcing mg', () => {
  for(const unit of ['mg','mcg','IU']) {
    const result=quickCreatePayload({name:'Example',dose:250,dose_unit:unit,vial:10000,vial_unit:unit,water:4})
    assert.equal(result.compounds[0].phase.dose_unit,unit)
    assert.equal(result.compounds[0].vial_unit,unit)
    assert.equal(result.compounds[0].phase.dose_semantics_version,1)
  }
  assert.throws(()=>quickCreatePayload({name:'Example',dose:5,vial:10,water:2}))
})
test('phase expiration and overlap never fall back to first/last phase', () => {
  const phases=[{start_week:1,end_week:4},{start_week:5,end_week:8}]
  assert.equal(currentPhase(phases,'2026-01-01','2026-03-01'),null)
  assert.equal(currentPhase(phases,'2026-01-01','2025-12-31'),null)
  assert.equal(currentPhase([phases[0],phases[0]],'2026-01-01','2026-01-02'),null)
  assert.equal(currentPhase(phases,'2026-01-01','2026-01-29'),phases[1])
})

test('explicit mass syringe entry derives medication dose without treating stale IU as medication', () => {
  const result = dosingFields({input_mode:'syringe',syringe_units:18,syringe_scale:100,dose:18,dose_unit:'IU',vial_strength:50,vial_unit:'mg',bac_water_ml:3})
  assert.equal(result.phase.dose,3)
  assert.equal(result.phase.dose_unit,'mg')
  assert.equal(result.phase.injection_volume_ml,0.18)
  assert.equal(result.phase.syringe_units,18)
})
test('explicit syringe entry preserves true medication IU', () => {
  const result = dosingFields({input_mode:'syringe',syringe_units:10,syringe_scale:100,dose:0,dose_unit:'',vial_strength:5000,vial_unit:'IU',bac_water_ml:2})
  assert.equal(result.phase.dose,250)
  assert.equal(result.phase.dose_unit,'IU')
  assert.equal(result.phase.injection_volume_ml,0.1)
  assert.equal(result.phase.syringe_units,10)
})
test('syringe entry requires explicit scale and concentration; medication mode still rejects mass/IU conversion', () => {
  const input={input_mode:'syringe',syringe_units:18,dose:18,dose_unit:'IU'}
  assert.throws(()=>calculateDosing(input),/scale/)
  assert.throws(()=>calculateDosing({...input,syringe_scale:100}),/required/)
  assert.throws(()=>calculateDosing({...input,input_mode:'medication',syringe_scale:100,vial_strength:50,vial_unit:'mg',bac_water_ml:3}),/IU cannot/)
  assert.equal(dosingFields({...input,syringe_scale:100,vial_strength:1000,vial_unit:'mcg',bac_water_ml:2}).phase.dose_unit,'mcg')
})

const preparation = {isPreMixed:false, vial_strength:'50',vial_unit:'mg',bac_water_ml:'3',concentration_value:'',concentration_unit:''}
test('existing legacy phase load, explicit meaning selection and editor save payload', () => {
  const legacy={dose:18,dose_unit:'IU',dose_semantics_version:null}
  const loaded={...preparation,...phaseDosingReview(legacy)}
  assert.equal(loaded.input_mode,'')
  assert.throws(()=>editorDosingInput(loaded),/Choose/)
  const selected=chooseDoseMeaning(loaded,'syringe')
  assert.equal(selected.syringe_markings,'18')
  assert.equal(selected.reviewed,false)
  assert.throws(()=>dosingFields(editorDosingInput(selected)),/scale/)
  const fields=dosingFields(editorDosingInput({...selected,syringe_scale:'100',reviewed:true}))
  assert.deepEqual(fields.phase,{dose:3,dose_unit:'mg',dose_semantics_version:1,injection_volume_ml:0.18,syringe_units:18,syringe_scale:100})
  assert.deepEqual(legacy,{dose:18,dose_unit:'IU',dose_semantics_version:null})
  assert.equal(phaseDosingReview(legacy).input_mode,'') // switching phases requires review again
})
test('editor new syringe input and true IU medication use the same payload adapter', () => {
  const fresh={...preparation,...phaseDosingReview()}
  const syringe=chooseDoseMeaning(fresh,'syringe')
  assert.equal(syringe.syringe_markings,'') // never guess from a new medication input
  assert.equal(dosingFields(editorDosingInput({...syringe,syringe_markings:'18',syringe_scale:'100'})).phase.dose,3)
  const iu={...preparation,vial_strength:'5000',vial_unit:'IU',bac_water_ml:'2',...phaseDosingReview({dose:250,dose_unit:'IU'})}
  const fields=dosingFields(editorDosingInput({...chooseDoseMeaning(iu,'medication'),syringe_scale:'100'}))
  assert.equal(fields.phase.dose,250)
  assert.equal(fields.phase.dose_unit,'IU')
  assert.equal(fields.phase.syringe_units,10)
})
test('explicit medication interpretation of legacy IU against mass still rejects', () => {
  const loaded={...preparation,...phaseDosingReview({dose:18,dose_unit:'IU'})}
  assert.throws(()=>dosingFields(editorDosingInput(chooseDoseMeaning(loaded,'medication'))),/Medication IU cannot/)
})

for (const sample of [
  {name:'Tirzepatide-like',markings:50,strength:10,water:1,expected:5},
  {name:'GHK-Cu-like',markings:18,strength:50,water:3,expected:3},
  {name:'Arbitrary future compound',markings:24,strength:20,water:2,expected:2.4},
]) test(`${sample.name}: legacy classification is independent of compound identity and selection order`,()=>{
  const loaded={...preparation,vial_strength:String(sample.strength),bac_water_ml:String(sample.water),
    ...phaseDosingReview({dose:sample.markings,dose_unit:'IU',dose_semantics_version:null})}
  assert.equal(loaded.input_mode,'')
  assert.throws(()=>editorDosingInput(loaded),/Choose/)
  const medication=chooseDoseMeaning(loaded,'medication')
  assert.throws(()=>dosingFields(editorDosingInput(medication)),/Medication IU cannot/)
  const syringe=chooseDoseMeaning(medication,'syringe')
  assert.equal(syringe.syringe_markings,String(sample.markings))
  const fields=dosingFields(editorDosingInput({...syringe,syringe_scale:'100'}))
  assert.ok(Math.abs(fields.phase.dose-sample.expected)<1e-10)
  assert.equal(fields.phase.dose_unit,'mg')
  assert.equal(fields.phase.dose_semantics_version,1)
  assert.equal(fields.phase.syringe_units,sample.markings)
  const edited={...syringe,syringe_markings:'12'}
  assert.equal(chooseDoseMeaning(chooseDoseMeaning(edited,'medication'),'syringe').syringe_markings,'12')
})
test('legacy mass medication choice and reviewed V1 phase remain medication doses',()=>{
  const legacy={...preparation,...phaseDosingReview({dose:3,dose_unit:'mg'})}
  assert.equal(dosingFields(editorDosingInput(chooseDoseMeaning(legacy,'medication'))).phase.dose,3)
  const reviewed={...preparation,...phaseDosingReview({dose:3,dose_unit:'mg',dose_semantics_version:1})}
  assert.equal(reviewed.input_mode,'medication')
  assert.equal(reviewed.reviewed,true)
  assert.equal(reviewed.legacy_value,'')
  assert.equal(dosingFields(editorDosingInput(reviewed)).phase.dose,3)
})
