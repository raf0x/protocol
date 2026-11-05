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
const { entryFromForm } = load('../lib/health/dosingEntry.ts')
const facts = load('../lib/health/recordedDose.ts')
const { healthStateAtDate, compareMedication } = load('../lib/health/longitudinal/history.ts')
const { overlayMarkers, contextAtDate } = load('../lib/health/protocolOverlay.ts')
const { buildDoctorReport } = load('../lib/health/report/model.ts')
const { buildReportAiContext } = load('../lib/health/report/ai.ts')
const { buildAnalystContext } = load('../lib/health/analyst/evidence.ts')
const Summary = load('../components/protocols/DoseSummary.tsx').default
const entry = (extra={}) => entryFromForm({ input_mode:'syringe',syringe_markings:'40',syringe_scale:'100',vial_strength:'20',vial_unit:'mg',bac_water_ml:'2',reviewed:true,...extra })
const phase = (e=entry(),extra={}) => ({id:'synthetic-phase',dosing_entry:e,start_week:1,end_week:null,frequency:'daily',route:null,...extra})
const source = p => ({protocols:[{id:'synthetic-protocol',name:'Synthetic plan',status:'active',start_date:'2026-01-01',compounds:[{id:'synthetic-compound',name:'Synthetic compound',phases:[p]}]}],protocolEvents:[],panels:[],journal:[]})
for (const [label, e] of [['syringe',entry()],['volume',entry({input_mode:'volume',injection_volume:'.4'})],['confirmed unknown',entry({input_mode:'unknown'})],['missing scale',entry({syringe_scale:''})],['U40',entry({syringe_scale:'40'})]]) test(`${label} cannot acquire medication through preparation or confirmation`,()=>{
  const p=phase(e), original=JSON.stringify(p), f=facts.recordedDose(p)
  assert.equal(f.medication,null)
  assert.equal(healthStateAtDate(source(p),'2026-01-02')[0].medication,null)
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(Summary,{phase:p})),/4 mg|10 mg|Calculated|≈/)
  const report=buildDoctorReport(source(p),'all','2026-01-02')
  assert.equal(report.currentProtocols[0].verified,false)
  assert.doesNotMatch(JSON.stringify(buildReportAiContext(report)),/4 mg|10 mg/)
  assert.doesNotMatch(JSON.stringify(buildAnalystContext(source(p),'protocol history','2026-01-02')),/4 mg|10 mg/)
  assert.equal(JSON.stringify(p),original)
})
for(const amount of ['4','4.000','4e0','4.50e-3','0','0.0'])test(`explicit medication retains raw ${amount} in UI, CSV, report and AI`,()=>{
  const p=phase(entry({input_mode:'medication',dose:amount,dose_unit:'mg',syringe_markings:'',syringe_scale:''}))
  assert.equal(facts.recordedDoseDisplay(p).primary,amount+' mg')
  const html=renderToStaticMarkup(React.createElement(Summary,{phase:p}));assert.ok(html.includes(amount+' mg'))
  const report=buildDoctorReport(source(p),'all','2026-01-02');assert.equal(report.currentProtocols[0].dose,amount+' mg')
  assert.ok(JSON.stringify(buildReportAiContext(report)).includes(amount+' mg'))
  const csv=facts.recordedDoseCsvFields(p).map(facts.csvRecordedCell).join(',');assert.ok(csv.includes(amount));assert.ok(csv.includes('explicit_medication_entry'))
})
test('review is distinct from original medication entry and retained through report JSON',()=>{
 const p=phase(entry({input_mode:'medication',dose:'4e0',dose_unit:'mg',reviewed:false})), report=buildDoctorReport(source(p),'all','2026-01-02')
 assert.equal(report.currentProtocols[0].dose,'4e0 mg');assert.equal(report.currentProtocols[0].verified,false)
 assert.equal(report.currentProtocols[0].recordedFacts.reviewStatus,'unverified');assert.equal(contextAtDate(source(p).protocols[0],'2026-01-02')[0].confirmed,false)
})
test('unknown legacy preserves raw amount without declaring medication; V1 medication retains semantics',()=>{
 const old=phase(null,{dose:'4e0',dose_unit:'mg',dose_semantics_version:null,syringe_units:40,injection_volume_ml:.4,syringe_scale:100})
 assert.equal(facts.recordedDose(old).medication,null);assert.equal(facts.recordedDose(old).ambiguousAmount.value,'4e0')
 assert.match(facts.recordedAdministrationDisplay(old).syringe,/origin unverified/)
 assert.equal(facts.recordedDose({...old,dose_semantics_version:1}).medication.value,'4e0')
 assert.equal(facts.recordedDose({...old,dose_semantics_version:1}).volume.origin,'saved_origin_unverified')
})
test('legacy hydration does not change origin through editor review',()=>{
 const old=phase(null,{dose:4,dose_unit:'mg',dose_semantics_version:1,syringe_units:40,injection_volume_ml:.4})
 const review=facts.recordedReviewPhase(entry({input_mode:'medication',dose:'4',dose_unit:'mg',injection_volume:'.4'}),{phase:old,touched:{reviewed:true},addingPhase:false})
 assert.equal(facts.recordedDose(review).volume.source,'legacy_phase')
 assert.equal(facts.recordedDose(review).volume.origin,'saved_origin_unverified')
})
test('supplemental V2 administration remains saved origin unverified',()=>assert.equal(facts.recordedDose(phase(entry({input_mode:'medication',dose:'4',dose_unit:'mg'}))).markings.origin,'saved_origin_unverified'))
test('missing and explicit zero are distinct; scale remains unknown without inference',()=>{
 assert.equal(facts.recordedDose(phase(entry({syringe_scale:''}))).scale,null)
 assert.equal(facts.recordedDose(phase(entry({syringe_markings:''}))).markings,null)
 assert.equal(facts.recordedDose(phase(entry({syringe_markings:'0'}))).markings.value,'0')
})
test('mixed units cause no automatic medication conversion',()=>assert.equal(compareMedication({value:1,unit:'mg'},{value:1000,unit:'mcg'}),null))
test('phase changes based on preparation alone do not become medication dose changes',()=>{
 const data=source(phase());data.protocols[0].compounds[0].phases.push(phase(entry({vial_strength:'40'}),{id:'second',start_week:2}))
 assert.ok(overlayMarkers(data.protocols,[]).every(m=>m.type!=='change'))
})
test('equivalent raw scientific notation does not invent a dose-change marker',()=>{
 const data=source(phase(entry({input_mode:'medication',dose:'1',dose_unit:'mg'})));data.protocols[0].compounds[0].phases.push(phase(entry({input_mode:'medication',dose:'1e0',dose_unit:'mg'}),{id:'second',start_week:2}))
 assert.ok(overlayMarkers(data.protocols,[]).every(m=>m.type!=='change'))
})
test('event scalar shortcuts cannot override a syringe-mode snapshot',()=>{
 const meta={version:1,newDose:4,newUnit:'mg',newState:{phaseId:'p',dosingEntry:entry(),doseConfirmed:true,medicationDose:4,medicationUnit:'mg'}}
 assert.equal(facts.recordedEventMedication(meta),null)
})

for(const [label,first,second,changed] of [
 ['identical V1',phase(null,{dose:5,dose_unit:'mg',dose_semantics_version:1}),phase(null,{dose:5,dose_unit:'mg',dose_semantics_version:1}),false],
 ['mixed V1/V2',phase(null,{dose:5,dose_unit:'mg',dose_semantics_version:1}),phase(entry({input_mode:'medication',dose:'6',dose_unit:'mg'})),true],
 ['mixed legacy units',phase(null,{dose:5,dose_unit:'mg',dose_semantics_version:1}),phase(null,{dose:5000,dose_unit:'mcg',dose_semantics_version:1}),false],
]) test(`phase markers: ${label}`,()=>{
 const data=source({...first,end_week:1});data.protocols[0].compounds[0].phases.push({...second,id:'second',start_week:2})
 assert.equal(overlayMarkers(data.protocols,[]).some(m=>m.type==='change'),changed)
})
test('partial legacy editor changes retain unchanged medication origin',()=>{
 const old=phase(null,{dose:'4e0',dose_unit:'mg',dose_semantics_version:1,syringe_units:40})
 const result=facts.recordedDose(facts.recordedReviewPhase(entry({input_mode:'medication',dose:'4e0',dose_unit:'mg',syringe_markings:'45'}),{phase:old,touched:{syringe_markings:true},addingPhase:false}))
 assert.equal(result.medication.source,'legacy_phase');assert.equal(result.medicationOrigin,'legacy_medication_semantics_v1')
})
test('structured syringe changes remain measurement changes rather than medication changes',()=>{
 const data=source(phase());data.protocolEvents=[{id:'synthetic-event',date:'2026-01-02',event_type:'dose_change',protocol_id:'synthetic-protocol',compound_id:'synthetic-compound',metadata:{version:1,previousState:{phaseId:'synthetic-phase',startWeek:1,endWeek:null,dosingEntry:entry()},newState:{phaseId:'synthetic-phase',startWeek:1,endWeek:null,dosingEntry:entry({syringe_markings:'50'})}}}]
 const {detectInterventions}=load('../lib/health/longitudinal/interventions.ts');const row=detectInterventions(data,'2026-01-03').find(x=>x.id==='event:synthetic-event')
 assert.equal(row.kind,'recorded_measurements_changed');assert.equal(row.before,null);assert.equal(row.after,null)
})

function loadIsolated(file, overrides) {
 const url=new URL(file,import.meta.url), out={exports:{}}
 const code=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
 new Function('require','module','exports',code)(name=>{
   if(name in overrides)return overrides[name]
   if(name.endsWith('.module.css'))return new Proxy({}, {get:(_,key)=>key==='__esModule'?false:String(key)})
   if(name.endsWith('.css'))return {}
   if(name==='server-only')return {}
   if(!name.startsWith('.'))return require(name)
   const suffix=existsSync(new URL(name+'.tsx',url))?'.tsx':'.ts';return load(new URL(name+suffix,url).href)
 },out,out.exports);return out.exports
}
for(const [name,e] of [['syringe',entry()],['scientific medication',entry({input_mode:'medication',dose:'4.50e-3',dose_unit:'mg'})]])test(`actual report and longitudinal route JSON: ${name}`,async()=>{
 const data=source(phase(e)), original=JSON.stringify(data), report=buildDoctorReport(data,'all','2026-01-02')
 const client={auth:{getUser:async()=>({data:{user:{id:'synthetic-owner'}},error:null})}}
 const common={'next/server':{NextResponse:{json:(body,options)=>Response.json(body,options)}},'../../../lib/serverSupabase':{createAuthenticatedServerClient:async()=>client},'../../../lib/health/protocolDates':{requestCalendarDate:()=> '2026-01-02'}}
 const route=loadIsolated('../app/api/health-report/route.ts',{...common,'../../../lib/aiConsent':{},'../../../lib/durableRateLimit':{checkDurableRateLimit:async()=>({allowed:true}),rateLimitHeaders:()=>({})},'../../../lib/health/analyst/monitoring':{},'../../../lib/monitoring':{},'../../../lib/health/report/service':{createDoctorReport:async(c,id,range,ai)=>{assert.equal(c,client);assert.equal(id,'synthetic-owner');assert.equal(ai,false);return {report:buildDoctorReport(data,range,'2026-01-02'),aiSummary:null,aiError:null}}}})
 const result=await route.POST(new Request('https://synthetic.invalid/api/health-report',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({range:'all',includeAi:false})}))
 assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'no-store')
 const json=await result.json();assert.deepEqual(json.report.currentProtocols,report.currentProtocols)
 const longitudinal=loadIsolated('../app/api/health-longitudinal/route.ts',{...common,'../../../lib/health/longitudinal/load':{loadLongitudinal:async()=>load('../lib/health/longitudinal/engine.ts').buildLongitudinal(data,'2026-01-02')}})
 const historyResponse=await longitudinal.GET(new Request('https://synthetic.invalid/api/health-longitudinal'));assert.equal(historyResponse.status,200)
 assert.doesNotMatch(JSON.stringify(await historyResponse.json()),/"rawValue":"4"|4 mg/)
 assert.equal(JSON.stringify(data),original)
})
test('rendered and printable Doctor Report retains scientific medication and review qualifier',()=>{
 const p=phase(entry({input_mode:'medication',dose:'4.50e-3',dose_unit:'mg',reviewed:false})), report=buildDoctorReport(source(p),'all','2026-01-02')
 let call=0;const Component=loadIsolated('../components/health/DoctorReport.tsx',{react:{...React,useState:initial=>[call++===3?{report,aiSummary:null,aiError:null}:initial,()=>{}]}}).default
 const html=renderToStaticMarkup(React.createElement(Component));assert.ok(html.includes('4.50e-3 mg'));assert.match(html,/unverified entry/);assert.doesNotMatch(html,/4 mg|Calculated medication/)
})
test('historical AI evidence carries review status and qualifies original description',()=>{
 const data=source(phase(entry({input_mode:'medication',dose:'4e0',dose_unit:'mg',reviewed:false})))
 data.protocolEvents=[{id:'synthetic-event',date:'2026-01-02',event_type:'dose_change',protocol_id:'synthetic-protocol',compound_id:'synthetic-compound',description:'Historical copied text',metadata:{version:1,newState:{phaseId:'synthetic-phase',startWeek:1,endWeek:null,dosingEntry:data.protocols[0].compounds[0].phases[0].dosing_entry}}}]
 const result=buildAnalystContext(data,'Show protocol history','2026-01-03');const events=result.evidence.filter(e=>e.type==='protocol_event');assert.ok(events.length)
 assert.ok(events.some(e=>e.confidence==='low'&&e.detail.includes('unverified')&&e.detail.includes('Historical event text')))
 const reportAI=buildReportAiContext(buildDoctorReport(data,'all','2026-01-03'));assert.ok(reportAI.evidence.some(e=>e.type==='protocol_event'&&e.detail.includes('unverified')&&e.confidence==='low'))
})
