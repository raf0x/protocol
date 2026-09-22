import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
const require=createRequire(import.meta.url)
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8')
function load(file, overrides={}) {
  const url=new URL(file,import.meta.url), compiled={exports:{}}
  const code=ts.transpileModule(read(url),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2021,esModuleInterop:true}}).outputText
  new Function('require','module','exports',code)(name=>{
    if(overrides[name]) return overrides[name]
    if(name.endsWith('/supabase'))return {createClient(){throw Error('No database access in render tests')}}
    if(name.startsWith('.'))for(const ext of ['.ts','.tsx']){const path=new URL(name+ext,url);try{read(path)}catch(error){if(error.code==='ENOENT')continue;throw error}return load(path,overrides)}
    return require(name)
  },compiled,compiled.exports)
  return compiled.exports
}
const {localCalendarDate,protocolLifecycle}=load('../lib/health/protocolDates.ts')
const {dateLabel}=load('../lib/health/protocolPresentation.ts')
const Detail=load('../components/protocols/ProtocolDetail.tsx').default
const protocol=(start,status='active')=>({id:'p',name:'Test protocol',start_date:start,status,compounds:[]})
const detail=(p,today)=>renderToStaticMarkup(React.createElement(Detail,{protocol:p,today,onBack(){},onEdit(){},onComplete(){},onPause(){},onResume(){},onReactivate(){},onDelete(){},onReload(){}}))

test('Scheduled detail replaces completion with the correctly formatted non-actionable start explanation',()=>{
  const html=detail(protocol('2026-09-22'),'2026-09-21')
  assert.match(html,/<p>Scheduled to begin Sep 22, 2026\.<\/p>/)
  assert.doesNotMatch(html,/>Complete protocol<|Mark as Complete/)
})
test('today and past Active protocols retain completion; Planned activation remains unchanged',()=>{
  for(const start of ['2026-09-21','2026-09-20'])assert.match(detail(protocol(start),'2026-09-21'),/>Complete protocol</)
  const planned=detail(protocol(null,'planned'),'2026-09-21')
  assert.match(planned,/>Activate</);assert.doesNotMatch(planned,/Complete protocol|Scheduled to begin/)
})
test('completion visibility follows local midnight, not the UTC calendar',()=>{
  const prior=process.env.TZ
  try {
    process.env.TZ='America/Los_Angeles'
    const p=protocol('2026-09-22')
    const before=localCalendarDate(new Date('2026-09-22T06:59:59Z'))
    const after=localCalendarDate(new Date('2026-09-22T07:00:00Z'))
    assert.equal(before,'2026-09-21');assert.equal(after,'2026-09-22')
    assert.doesNotMatch(detail(p,before),/>Complete protocol</)
    assert.match(detail(p,after),/>Complete protocol</)
    assert.doesNotMatch(hero(stocked(p.start_date),true,before),/>Complete<|Mark as Complete/)
    assert.match(hero(stocked(p.start_date),true,after),/>Complete</)
    assert.equal(protocolLifecycle(p,after),'active')
  }finally{if(prior===undefined)delete process.env.TZ;else process.env.TZ=prior}
})
function hero(p,confirm=false,today='2026-09-21') {
  let slot=0
  const hooks={...React,useEffect(){},useState:initial=>[slot++===3?confirm:initial,()=>{}]}
  const Hero=load('../components/dashboard/HeroProtocolCard.tsx',{
    react:hooks,'../../lib/health/useLocalCalendarDate':{useLocalCalendarDate:()=>today},
    './VialInventory':{__esModule:true,default:()=>null},
  }).default
  return renderToStaticMarkup(Hero({activeProtocols:[p],activeCompoundTab:'c',logs:{},allLogs:[],totalLost:null,compoundIndex:0}))
}
const stocked=start=>({...protocol(start),compounds:[{id:'c',name:'Medication',bac_water_ml:1,reconstitution_date:start,doses_taken_override:10,
  phases:[{id:'ph',start_week:1,end_week:52,dose:1,dose_unit:'mg',dose_semantics_version:1,injection_volume_ml:1,frequency:'daily'}]}]})
test('dashboard has no Scheduled completion even with a previously open confirmation; current completion survives',()=>{
  const future=stocked('2099-01-01')
  for(const confirm of [false,true]){
    const html=hero(future,confirm)
    assert.ok(html.includes(`Scheduled to begin ${dateLabel(future.start_date)}.`))
    assert.doesNotMatch(html,/>Complete<|Mark as Complete/)
  }
  for(const start of ['2026-09-21','2026-09-20']) {
    const active=hero(stocked(start),true)
    assert.match(active,/>Complete</);assert.match(active,/Mark as Complete/)
    assert.doesNotMatch(active,/Scheduled to begin/)
  }
})
test('both submission handlers reject Scheduled before invoking the unchanged completion RPC',async()=>{
  for(const [file,name,protocolKey] of [
    ['../components/dashboard/HeroProtocolCard.tsx','archiveProtocol','activeProtocol'],
    ['../app/protocol/manage/page.tsx','completeProtocol','confirmComplete'],
  ]){
    const source=read(file),ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
    let fn
    const visit=node=>{if(ts.isFunctionDeclaration(node)&&node.name?.text===name)fn=node.getText(ast);ts.forEachChild(node,visit)};visit(ast)
    assert.ok(fn)
    const code=ts.transpileModule(fn,{compilerOptions:{target:ts.ScriptTarget.ES2021}}).outputText
    let writes=0
    const context={[protocolKey]:protocol('2099-01-01'),savePending:{current:false},protocolLifecycle,localCalendarDate,
      transitionProtocol:async()=>{writes++}}
    await new Function('context',`with(context){${code};return ${name}}`)(context)()
    assert.equal(writes,0)
    for(const start of ['2026-09-21','2026-09-20']) {
      const calls=[]
      const allowed={...context,[protocolKey]:protocol(start),localCalendarDate:()=> '2026-09-21',
        transitionProtocol:async input=>calls.push(input),window:{location:{reload(){}}},
        completionHappenedEarlier:false,setError(){},setShowConfetti(){},setTimeout(){},setConfirmComplete(){},async load(){}}
      await new Function('context',`with(context){${code};return ${name}}`)(allowed)()
      assert.equal(calls.length,1)
      assert.equal(calls[0].action,'complete')
      assert.equal(calls[0].protocolId,'p')
      assert.equal(calls[0].effectiveDate,name==='archiveProtocol'?'2026-09-21':null)
    }
  }
  const manage=read('../app/protocol/manage/page.tsx')
  assert.match(manage,/confirmComplete && protocolLifecycle\(confirmComplete, today\) !== 'scheduled'/)
  assert.match(manage,/protocol=\{selected\} today=\{today\}/)
})
