import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { renderToStaticMarkup } from 'react-dom/server'
import React from 'react'
import ts from 'typescript'

const require=createRequire(import.meta.url)
function load(path, stubs={}) {
  const url=new URL(path,import.meta.url),out={exports:{}}
  const code=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  new Function('require','module','exports',code)(name=>{
    if(name in stubs)return stubs[name]
    if(name==='server-only'||name.endsWith('.css'))return {}
    if(!name.startsWith('.'))return require(name)
    const target=new URL(name,url)
    return load(target.href+(existsSync(target)?'':existsSync(new URL(target.href+'.ts'))?'.ts':'.tsx'),stubs)
  },out,out.exports)
  return out.exports
}
const today='2026-09-20',future='2026-09-21'
const protocol={id:'scheduled',name:'Future medication',status:'active',start_date:future,compounds:[{id:'compound',name:'Future medication',phases:[{id:'phase',start_week:1,end_week:null,dose:2,dose_unit:'mg',dose_semantics_version:1,frequency:'daily'}]}]}
const event={id:'start',protocol_id:protocol.id,date:future,event_type:'started',description:'Started Future medication',metadata:{version:1}}
const source={protocols:[protocol],protocolEvents:[event],journal:[],panels:[{id:'lab',test_date:today,panel_name:'Lab',results:[]}]}

test('server calendar respects both sides of midnight and safely handles old clients',()=>{
  const {requestCalendarDate}=load('../lib/health/protocolDates.ts'),now=new Date('2026-09-21T01:00:00Z')
  assert.equal(requestCalendarDate('America/Los_Angeles',now),'2026-09-20')
  assert.equal(requestCalendarDate('Pacific/Kiritimati',now),'2026-09-21')
  assert.equal(requestCalendarDate(null,now),'2026-09-20')
  assert.equal(requestCalendarDate('Invalid/Zone',now),'2026-09-20')
})

test('all three server history entry points pass the browser-local day to their model',async()=>{
  const stubs={
    'next/server':{NextResponse:{json:x=>x}},
    '../../../lib/serverSupabase':{createAuthenticatedServerClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'owner'}}})}})},
    '../../../lib/aiConsent':{hasCurrentAiConsent:async()=>true},
    '../../../lib/durableRateLimit':{checkDurableRateLimit:async()=>({allowed:true})},
    '../../../lib/health/analyst/service':{analyzeHealthContext:async context=>context},
    '../../../lib/health/analyst/monitoring':{},'../../../lib/monitoring':{},
    '../../../lib/health/analyst/provider':{AnalystConfigurationError:class extends Error{},AnalystProviderError:class extends Error{}},
  }
  const RealDate=Date
  globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-09-21T01:00:00Z']))}}
  try {
    for(const [path,method,module,fn] of [
      ['health-report','POST','../../../lib/health/report/service','createDoctorReport'],
      ['health-analyst','POST','../../../lib/health/analyst/context','loadHealthAnalystContext'],
      ['health-longitudinal','GET','../../../lib/health/longitudinal/load','loadLongitudinal'],
    ]) {
      let args
      const route=load(`../app/api/${path}/route.ts`,{...stubs,[module]:{[fn]:async(...input)=>{args=input;return {}}}})
      await route[method]({headers:{get:key=>key==='x-timezone'?'America/Los_Angeles':null},json:async()=>path==='health-report'?{range:'all',includeAi:false}:{action:'current_snapshot'}})
      assert.ok(args?.includes('2026-09-20'),`${path} must use the supplied local day`)
    }
  }finally{globalThis.Date=RealDate}
})

test('reports and analyst evidence exclude future stored events AND derived start/phase markers',()=>{
  const {buildDoctorReport}=load('../lib/health/report/model.ts')
  const report=buildDoctorReport(source,'all',today)
  assert.deepEqual(report.currentProtocols,[]);assert.deepEqual(report.protocolHistory,[]);assert.deepEqual(report.protocolLabContext,[])
  const {buildGuidedAnalystContext}=load('../lib/health/analyst/evidence.ts')
  for(const action of ['current_snapshot','protocol_context']) assert.doesNotMatch(JSON.stringify(buildGuidedAnalystContext(source,action,today)),/Future medication|Started Future/)
  const started=buildDoctorReport(source,'all',future)
  assert.equal(started.currentProtocols.length,1);assert.ok(started.protocolHistory.length)
})

test('historical CSV executes its real export loop without Planned or Scheduled rows',async()=>{
  const file=readFileSync(new URL('../app/protocol/page.tsx',import.meta.url),'utf8')
  const body=file.slice(file.indexOf('  async function exportToCSV()'),file.indexOf('  async function shareProtocol'))
  const code=ts.transpileModule(body+'\nexport {exportToCSV}',{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
  const rows=[protocol,{...protocol,id:'planned',status:'planned',start_date:null,name:'Later'},{...protocol,id:'active',name:'Started medication',start_date:today}]
  let blob
  const client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from:()=>({select:()=>({eq:async()=>({data:rows})})})}
  const out={};const dates=load('../lib/health/protocolDates.ts')
  new Function('exports','createClient','localCalendarDate','protocolLifecycle','dosingDisplay','window','document','alert',code)(out,()=>client,()=>today,dates.protocolLifecycle,()=>({}),
    {URL:{createObjectURL:value=>{blob=value;return 'blob:test'},revokeObjectURL(){}},setTimeout(){}},{createElement:()=>({style:{},click(){},remove(){}}),body:{appendChild(){}}},()=>{})
  await out.exportToCSV()
  const csv=await blob.text();assert.match(csv,/^"Started medication"/m);assert.doesNotMatch(csv,/^"(?:Future medication|Later)"/m)
})

test('shared configuration never claims a future start has already happened',async()=>{
  const client={from:table=>({select:()=>({eq:()=>({single:async()=>({data:table==='shared_protocols'?{protocol_id:protocol.id}:protocol})})})})}
  const Page=load('../app/share/[token]/page.tsx',{'@supabase/supabase-js':{createClient:()=>client},'next/navigation':{notFound(){throw Error('missing')}}}).default
  const html=renderToStaticMarkup(await Page({params:Promise.resolve({token:'share'})}))
  assert.match(html,/Start date: Sep 21, 2026/);assert.doesNotMatch(html,/Started|>Active</)
})

test('overlay history queries cap future lab windows at the local calendar date',async()=>{
  const cutoffs=[]
  const client={from:()=>{const q={select(){return q},eq(){return q},or(){return q},in(){return q},lte(key,value){cutoffs.push([key,value]);return q},order:async()=>({data:[protocol]})};return q}}
  const {readProtocolOverlay}=load('../lib/health/loadProtocolOverlay.ts',{'../supabase':{},'./protocolDates':{localCalendarDate:()=>today}})
  await readProtocolOverlay(client,'owner','2026-01-01','2099-01-01')
  assert.deepEqual(cutoffs,[['start_date',today],['date',today]])
})

test('the All overlay renders no future stored or derived phase markers',()=>{
  const p={...protocol,start_date:'2099-01-01'},e={...event,date:'2099-01-01'}
  const states=['mg/dL','all',{protocols:[p],events:[e]},new Set([p.id]),'ready'];let index=0,markers
  const View=load('../components/health/ProtocolOverlayView.tsx',{
    react:{...React,useState:()=>[states[index++],()=>{}]},
    '../../lib/health/loadProtocolOverlay':{},
    './ProtocolOverlayChart':{default:props=>{markers=props.markers;return null},__esModule:true},
    './TestDateProtocolContext':{default:()=>null,__esModule:true},
  }).default
  renderToStaticMarkup(React.createElement(View,{history:{name:'Lab',units:[{unit:'mg/dL',observations:[]}]}}))
  assert.deepEqual(markers,[])
})

test('cron excludes future-local starts even without subscription timezone data',async()=>{
  const RealDate=Date,secret=process.env.CRON_SECRET;process.env.CRON_SECRET='test'
  globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-09-20T09:00:00Z']))}getHours(){return 9}}
  try {
    const queries=[],sent=[]
    const compounds=[{id:'future',name:'Scheduled vial',user_id:'owner',reconstitution_date:'2026-08-25',protocols:{status:'active',start_date:'2026-09-20'}},
      {id:'old',name:'Active vial',user_id:'owner',reconstitution_date:'2026-08-25',protocols:{status:'active',start_date:'2026-09-18'}}]
    const client={from:table=>{
      const filters=[];const q={select(value){queries.push([table,'select',value]);return q},eq(key,value){filters.push([key,value]);return q},lte(key,value){queries.push([table,key,value]);filters.push([key,value]);return q},not(){return q},then(resolve){
        const data=table==='compounds'?compounds.filter(c=>filters.every(([key,value])=>key==='protocols.status'?c.protocols.status===value:c.protocols.start_date<=value)):
          filters.some(([key])=>key==='reminder_hour')?[]:[{subscription:{endpoint:'test'}}]
        return Promise.resolve({data}).then(resolve)
      }};return q
    }}
    const route=load('../app/api/cron/route.ts',{'@supabase/supabase-js':{createClient:()=>client},'next/server':{NextResponse:{json:x=>x}},'web-push':{sendNotification:async(_,message)=>sent.push(JSON.parse(message))},
      '../../../lib/pushConfig':{configureWebPush:()=>({ok:true})},'../../../lib/monitoring':{captureOperationalError(){}},'../../../lib/rateLimit':{rateLimit:()=>true}})
    await route.GET({headers:{get:key=>key==='authorization'?'Bearer test':'test'}})
    assert.ok(queries.some(([,key,value])=>key==='protocols.start_date'&&value==='2026-09-19'))
    assert.equal(sent.length,1);assert.match(sent[0].body,/Active vial/);assert.doesNotMatch(sent[0].body,/Scheduled vial/)
  }finally{globalThis.Date=RealDate;if(secret===undefined)delete process.env.CRON_SECRET;else process.env.CRON_SECRET=secret}
})
