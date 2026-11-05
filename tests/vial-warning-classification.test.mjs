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
const { entryFromForm, interpretEntry, entryFormState } = load('../lib/health/dosingEntry.ts')
const { dosingIssue, phaseDosingIssue, isDosingReviewField } = load('../lib/health/dosingGuidance.ts')
const Summary = load('../components/protocols/DoseSummary.tsx').default
const Row = load('../components/protocols/ProtocolRow.tsx').default
const Detail = load('../components/protocols/ProtocolDetail.tsx').default
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
const entry = extra => entryFromForm({ input_mode: 'medication', dose: '2', dose_unit: 'mg', preparation: 'mixing', vial_strength: '10', vial_unit: 'mg', bac_water_ml: '2', reviewed: true, ...extra })


for (const [name, raw] of [
 ['complete medication', {}], ['multiple independent measurements', {syringe_markings:'20',syringe_scale:'100',injection_volume:'.3'}],
 ['syringe only', {input_mode:'syringe',dose:'',dose_unit:'',syringe_markings:'20',syringe_scale:'100'}],
 ['volume only', {input_mode:'volume',dose:'',dose_unit:'',injection_volume:'.2'}],
]) test(name + ' has no warning or correction action',()=>{
 const saved=Object.freeze(entry(raw)),before=JSON.stringify(saved), guidance=dosingIssue(saved);
 assert.equal(guidance,null);
 assert.doesNotMatch(render(Summary,{phase:{dosing_entry:saved},onReview(){}}),/dose-issue|dose-review-link/);
 assert.equal(JSON.stringify(saved),before);
});
for(const [name,raw] of [
 ['two preparation records',{concentration_value:'5',concentration_unit:'mg/mL'}],
 ['unverified review',{reviewed:false}],['unknown meaning',{input_mode:'unknown'}],
 ['missing scale',{input_mode:'syringe',dose:'',syringe_markings:'20'}],
]) test(name+' is neutral and has no repair button',()=>{
 const saved=entry(raw),info=dosingIssue(saved);assert.equal(info.severity,'info');assert.equal(info.action,undefined);
 const html=render(Summary,{phase:{dosing_entry:saved},onReview(){}});assert.match(html,/dose-information/);assert.doesNotMatch(html,/dose-issue|dose-review-link/);
});
test('unsupported positive calibration is a neutral product limitation',()=>{
 const saved={...entry({}),syringe_scale:'50'};assert.equal(dosingIssue(saved).severity,'info');assert.equal(dosingIssue(saved).action,undefined);assert.equal(saved.syringe_scale,'50');
});
test('explicit invalid numeric value names an actual editable field',()=>{
 const saved={...entry({}),dose:'-2'};const issue=dosingIssue(saved);assert.equal(issue.severity,'warning');assert.equal(issue.field,'Medication dose');assert.equal(issue.action,'Review Medication dose');
});
test('legacy meaning has neutral status without an unsupported correction link',()=>{
 const info=phaseDosingIssue({dose:'1e-3',dose_unit:'IU'});assert.equal(info.severity,'info');assert.equal(info.action,undefined);
});

const form=load('../lib/protocols/form.ts');
for(const [key,field,value]of[
 ['dose','Saved amount','2e-3'],['syringe_markings','Syringe markings','1e1'],['syringe_scale','Syringe scale','100'],
 ['injection_volume','Injection volume (mL)','2e-1'],['vial_strength','Vial amount','1e1'],['bac_water_ml','BAC water in mL','2'],['concentration_value','Concentration value','5'],
]) test('actionable '+field+' can be resolved by the existing historical save contract',()=>{
 const raw={...entry({dose:'2e-3',input_mode:'volume',injection_volume:'.2',concentration_value:'5',concentration_unit:'mg/mL'}),[key]:'-2'};
 const phase={id:'phase',dosing_entry:raw,start_week:1,end_week:null,duration_weeks:null,frequency:'daily',days_of_week:[0,1,2,3,4,5,6],day_of_week:0,time_of_day:'morning',route:'SubQ'};
 const compound={id:'compound',name:'Synthetic',reconstitution_date:null,notes:'',vials_in_stock:null};const before=JSON.stringify({compound,phase});
 assert.equal(dosingIssue(raw).field,field);assert.equal(isDosingReviewField(field),true);
 const draft=form.captureHistoricalCompound({...form.newCompound(),...entryFormState(phase),id:compound.id,name:compound.name,phase_id:phase.id},compound,phase);
 const edited=form.updateCompoundDraft(draft,key,value),payload=form.protocolCompoundPayload([edited])[0];
 assert.notEqual(dosingIssue(payload.phase.dosing_entry)?.severity,'warning');assert.equal(payload.phase.dosing_entry[key],value);
 for(const [other,original]of Object.entries(raw))if(other!==key&&other!=='review_status')assert.deepEqual(payload.phase.dosing_entry[other],original,other+' retained');
 assert.deepEqual(Object.keys(payload).sort(),['id','name','phase']);assert.equal(JSON.stringify({compound,phase}),before);
});
test('unsupported metadata does not offer a correction the editor cannot save',()=>{
 const info=dosingIssue({...entry({}),version:99});assert.equal(info.severity,'warning');assert.equal(info.action,undefined);assert.match(info.explanation,/cannot repair/);
});
test('saved scientific notation and prior confirmation survive classification',()=>{
 const raw=Object.freeze(entry({dose:'2e-3',syringe_markings:'1E+1',syringe_scale:'100',injection_volume:'2e-1'}));
 assert.equal(dosingIssue(raw),null);assert.equal(raw.dose,'2e-3');assert.equal(raw.syringe_markings,'1E+1');assert.equal(raw.review_status,'confirmed');
});

for(const raw of[{dose:'-2',dose_unit:'mg',dose_semantics_version:1},{dose:'not-a-number',dose_unit:'IU'},{syringe_scale:0},{injection_volume_ml:'-1'}])test('invalid legacy '+JSON.stringify(raw)+' stays visible without a repair promise',()=>{
 const info=phaseDosingIssue(raw);assert.equal(info.severity,'warning');assert.equal(info.action,undefined);assert.match(info.explanation,/cannot correct/);
});
for(const value of[undefined,null,2])test('malformed V2 field '+value+' is not offered an unproven repair',()=>{
 const info=dosingIssue({...entry({input_mode:'syringe',dose:''}),dose:value});assert.equal(info.severity,'warning');assert.equal(info.action,undefined);
});
test('non-medication saved amount is labelled without promoting its meaning',()=>{
 const info=dosingIssue({...entry({input_mode:'volume'}),dose:'-2'});assert.equal(info.field,'Saved amount');assert.equal(info.title,'Saved amount is invalid');
 const source=readFileSync(new URL('../app/protocol/manage/page.tsx',import.meta.url),'utf8');assert.match(source,/Saved amount \(meaning unverified\)/);assert.match(source,/aria-label=\{c.input_mode === 'medication' \? 'Medication dose' : 'Saved amount'\}/);
});
