import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function loadDosingEntry() {
  const code=ts.transpileModule(readFileSync(new URL('../lib/health/dosingEntry.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
  const module={exports:{}};new Function('require','module','exports',code)(()=>{throw new Error('Unexpected dependency')},module,module.exports);return module.exports
}

function loadHandler() {
  const calls=[],client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},rpc:async(name,args)=>{calls.push({name,args});return {data:'protocol-id',error:null}}}
  const code=ts.transpileModule(readFileSync(new URL('../app/api/create-protocol/route.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const module={exports:{}},dosing=loadDosingEntry()
  new Function('require','module','exports',code)(name=>{
    if(name==='@supabase/ssr')return {createServerClient:()=>client}
    if(name==='next/server')return {NextResponse:{json:(body,options={})=>({body,status:options.status??200})}}
    if(name==='next/headers')return {cookies:async()=>({getAll:()=>[],set(){}})}
    if(name.endsWith('/dosingEntry'))return dosing
    if(name.endsWith('/rateLimit'))return {rateLimit:()=>true}
    throw new Error(`Unexpected dependency: ${name}`)
  },module,module.exports)
  return {POST:module.exports.POST,calls}
}

test('POST handler accepts legacy medication and every explicit raw dosing mode',async()=>{
 const cases=[
  [{name:'Medication',date:'2026-09-29',dose:'2.500',dose_unit:'mg'},'medication','dose','2.500'],
  [{name:'Syringe',date:'2026-09-29',input_mode:'syringe',syringe_markings:'18'},'syringe','syringe_markings','18'],
  [{name:'Volume',date:'2026-09-29',input_mode:'volume',injection_volume:'0.125'},'volume','injection_volume','0.125'],
  [{name:'Unknown',date:'2026-09-29',input_mode:'unknown',injection_volume:'0.2',vial_label:'Unclear'},'unknown','vial_label','Unclear'],
 ]
 for(const [body,mode,key,expected] of cases) {
  const {POST,calls}=loadHandler(),response=await POST({headers:{get:()=>null},json:async()=>body})
  assert.equal(response.status,200);assert.deepEqual(response.body,{success:true,protocolId:'protocol-id'});assert.equal(calls.length,1);assert.equal(calls[0].name,'save_protocol_with_events_v2')
  const entry=calls[0].args.p_compounds[0].phase.dosing_entry;assert.equal(entry.mode,mode);assert.equal(entry[key],expected)
 }
})

test('POST handler requires current reviewed confirmation and ignores stale review_status',async()=>{
 const base={name:'Unknown',date:'2026-09-29',input_mode:'unknown',injection_volume:'0.2',preparation:'ready',concentration_value:'10',concentration_unit:'mg/mL'}
 const cases=[
  [{...base,reviewed:false,review_status:'confirmed'},'unverified',null],
  [{...base,reviewed:true,review_status:'unverified'},'confirmed',{value:2,unit:'mg'}],
  // API review_status is historical metadata only; without an explicit current reviewed=true it cannot confirm or promote a dose.
  [{...base,review_status:'confirmed'},'unverified',null],
 ]
 for(const [body,status,medication] of cases) {
  const {POST,calls}=loadHandler(),response=await POST({headers:{get:()=>null},json:async()=>body})
  assert.equal(response.status,200);const entry=calls[0].args.p_compounds[0].phase.dosing_entry
  assert.equal(entry.review_status,status);assert.deepEqual(loadDosingEntry().interpretEntry(entry).medication,medication)
 }
})
