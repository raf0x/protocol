import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
const source = readFileSync(new URL('../lib/health/dosing.ts', import.meta.url), 'utf8')
const code = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2021}}).outputText
const { calculateDosing, dosingFields, quickCreatePayload, currentPhase } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

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
