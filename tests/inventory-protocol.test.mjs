import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
function load(path) {
  const url = new URL(path, import.meta.url), compiled = { exports: {} }
  const code = ts.transpileModule(read(url), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2021 } }).outputText
  new Function('require','module','exports',code)(name => {
    if (name.endsWith('/supabase')) return { createClient() { throw new Error('Tests must not connect to Supabase') } }
    return name.startsWith('.') ? load(new URL(name + '.ts',url)) : require(name)
  },compiled,compiled.exports)
  return compiled.exports
}
const { inventoryProtocolFields, inventoryProtocolDates } = load('../lib/inventory/protocol.ts')
const { localCalendarDate, protocolLifecycle } = load('../lib/health/protocolDates.ts')
const { loadInventoryItem } = load('../lib/inventory/client.ts')
const item = Object.freeze({ item_name:'Recorded medication', form:'lyophilized vial', vial_strength:10, strength_unit:'mg', quantity:8,
  reconstitution_status:'unknown', reconstitution_date:null, acquisition_date:'2026-09-01', expiration_date:null, lot_number:null, notes:'Do not interpret this as dosing' })

test('inventory maps recorded facts only, without inferring a dose, stock, schedule or preparation', () => {
  const fields = inventoryProtocolFields(item)
  assert.equal(fields.name,item.item_name); assert.equal(fields.vial_strength,'10'); assert.equal(fields.vial_unit,'mg')
  for (const key of ['dose','dose_unit','bac_water_ml','reconstitution_date','route','duration_weeks','injection_volume','syringe_markings','syringe_scale','vials_in_stock','cycle_days','time_of_day']) assert.equal(fields[key],'',key)
  assert.deepEqual(fields.days_of_week,[])
  assert.equal(item.quantity,8)
  assert.equal(inventoryProtocolFields({...item,vial_strength:null,strength_unit:null}).vial_unit,'')
  assert.equal(inventoryProtocolFields({...item,form:'pre-mixed vial'}).isPreMixed,true)
  assert.equal(inventoryProtocolFields({...item,reconstitution_status:'reconstituted',reconstitution_date:'2026-09-20'}).reconstitution_date,'2026-09-20')
  assert.equal(inventoryProtocolFields({...item,reconstitution_date:'2026-09-20'}).reconstitution_date,'')
})

test('three choices reuse Active, derived Scheduled and dateless Planned; invalid scheduled dates fail', () => {
  const today='2026-09-21'
  for (const [choice,date,expected,state] of [['today','1999-01-01',today,'active'],['scheduled','2026-09-22','2026-09-22','scheduled'],['planned','bad',null,'planned']]) {
    const result=inventoryProtocolDates(choice,date,today)
    assert.deepEqual(result,{startDate:expected,effectiveDate:expected})
    assert.equal(protocolLifecycle({status:choice==='planned'?'planned':'active',start_date:result.startDate},today),state)
  }
  for (const date of ['', 'invalid', '2026-02-30']) assert.throws(()=>inventoryProtocolDates('scheduled',date,today),/valid future start date/)
  for (const date of [today,'2026-09-20']) assert.throws(()=>inventoryProtocolDates('scheduled',date,today),/after today/)
  assert.equal(protocolLifecycle({status:'active',start_date:'2026-09-22'},'2026-09-22'),'active')
})

test('local calendar midnight is respected independently of the UTC date', () => {
  const prior=process.env.TZ
  try {
    process.env.TZ='America/Los_Angeles'
    const local=localCalendarDate(new Date('2026-09-22T00:30:00Z'))
    assert.equal(local,'2026-09-21')
    assert.equal(inventoryProtocolDates('today','',local).startDate,local)
    assert.equal(inventoryProtocolDates('scheduled','2026-09-22',local).startDate,'2026-09-22')
    process.env.TZ='Pacific/Kiritimati'
    assert.equal(localCalendarDate(new Date('2026-09-21T12:30:00Z')),'2026-09-22')
  } finally { if(prior===undefined) delete process.env.TZ; else process.env.TZ=prior }
})

test('inventory source is loaded read-only and scoped to the authenticated owner', async () => {
  const calls=[]
  const query={select(value){calls.push(['select',value]);return query},eq(key,value){calls.push(['eq',key,value]);return query},maybeSingle:async()=>({data:item,error:null})}
  const client={auth:{getUser:async()=>({data:{user:{id:'owner'}},error:null})},from(table){calls.push(['from',table]);return query}}
  assert.equal(await loadInventoryItem('item-id',client),item)
  assert.deepEqual(calls,[['from','inventory_items'],['select','*'],['eq','id','item-id'],['eq','user_id','owner']])
  query.maybeSingle=async()=>({data:null,error:null})
  await assert.rejects(loadInventoryItem('other-owner-item',client),/unavailable/)
  client.auth.getUser=async()=>({data:{user:null},error:null})
  await assert.rejects(loadInventoryItem('item-id',client),/Sign in/)
})

const source=read('../app/protocol/manage/page.tsx')
const ast=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
function functionCode(name) {
  let found
  function visit(node) { if(ts.isFunctionDeclaration(node)&&node.name?.text===name) found=node.getText(ast); ts.forEachChild(node,visit) }
  visit(ast);assert.ok(found)
  return ts.transpileModule(found,{compilerOptions:{target:ts.ScriptTarget.ES2021}}).outputText
}
function saveHarness(timing='today') {
  const initial=new Function(functionCode('newCompound')+'; return newCompound()')()
  const calls=[], errors=[], notices=[]
  const context={ savePending:{current:false},savedProtocolId:{current:null},compounds:[{...initial,...inventoryProtocolFields(item)}],
    fromInventory:true,mode:'create',inventoryTiming:timing,startDate:timing==='scheduled'?'2099-01-01':'',planned:timing==='planned',editingId:null,
    continuedFromId:'',removedCompoundIds:[],inventoryProtocolDates,localCalendarDate,...load('../lib/health/dosingEntry.ts'),...load('../lib/health/phaseLifecycle.ts'),
    setError(value){errors.push(value)},setSaving(){},setSavedNotice(value){notices.push(value)},setShowForm(){},setEditingId(){},load:async()=>{},
    saveProtocolWithEvents:async input=>{calls.push(input);return 'created-protocol-id'} }
  const save=new Function('context','with(context) {'+functionCode('save')+'; return save }')(context)
  return {save,context,calls,errors,notices}
}

test('real editor save sends only canonical protocol creation, with no dose inference or inventory mutation', async () => {
  for (const timing of ['today','scheduled','planned']) {
    const {save,calls,errors,notices}=saveHarness(timing)
    await save()
    assert.deepEqual(errors,['']);assert.equal(calls.length,1)
    const payload=calls[0], compound=payload.compounds[0]
    assert.equal(payload.protocolId,null)
    assert.equal(payload.startDate,timing==='planned'?null:timing==='today'?localCalendarDate():'2099-01-01')
    assert.equal(compound.vials_in_stock,null);assert.equal(compound.bac_water_ml,null)
    assert.equal(compound.reconstitution_date,null);assert.equal(compound.phase.route,null)
    assert.equal(compound.phase.frequency,'');assert.equal(compound.phase.end_week,null)
    assert.equal(compound.phase.dosing_entry.dose,'');assert.equal(compound.phase.dosing_entry.vial_strength,'10')
    assert.match(notices[0],/Protocol created\. Your inventory quantity is unchanged\./)
    assert.equal(item.quantity,8)
  }
})

test('real editor blocks concurrent and repeated successful submissions, including after a refresh failure', async () => {
  const {save,context,calls}=saveHarness()
  let release
  context.saveProtocolWithEvents=input=>{calls.push(input);return new Promise(resolve=>{release=resolve})}
  const first=save()
  await save();assert.equal(calls.length,1)
  context.load=async()=>{throw new Error('Refresh failed')}
  release('created-id');await first
  await save();assert.equal(calls.length,1)
  assert.equal(context.savedProtocolId.current,'created-id')
})

test('invalid dates never reach save; explicit save failures permit correction and retry', async () => {
  const {save,context,calls,errors}=saveHarness('scheduled')
  context.startDate='';await save();assert.equal(calls.length,0);assert.match(errors.at(-1),/valid future start date/)
  context.startDate='2099-01-01'
  const original=context.saveProtocolWithEvents
  context.saveProtocolWithEvents=async()=>{throw new Error('Rejected')}
  await save();assert.equal(context.savePending.current,false);assert.equal(context.savedProtocolId.current,null)
  context.saveProtocolWithEvents=original;await save();assert.equal(calls.length,1)
})

test('mobile action, accessible timing options, and existing Quick Add fields remain available', () => {
  const Timing=load('../components/inventory/InventoryProtocolTiming.tsx').default
  const html=renderToStaticMarkup(React.createElement(Timing,{value:'today',disabled:false,onChange(){}}))
  for (const label of ['Start today','Schedule for later','Save as Planned']) assert.ok(html.includes(label))
  assert.equal((html.match(/type="radio"/g)||[]).length,3)
  assert.match(html,/aria-describedby="inventory-scheduled-help"/)
  const Quick=load('../components/protocols/QuickProtocolFields.tsx').default
  const fields={...saveHarness().context.compounds[0]}
  const quick=renderToStaticMarkup(React.createElement(Quick,{value:fields,onChange(){}}))
  for (const label of ['Medication dose per injection','BAC water (mL)','Vials in stock','Frequency','Schedule','Duration']) assert.ok(quick.includes(label))
  assert.match(quick,/<option value="" selected="">Choose a unit/)
  assert.match(read('../components/inventory/Inventory.tsx'),/Use in a protocol<\/Link>/)
  assert.match(source,/Creating a protocol will not change your inventory quantity\./)
  assert.match(source,/Add more details/)
})
