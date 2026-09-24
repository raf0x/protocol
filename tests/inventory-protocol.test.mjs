import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
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
    return name.startsWith('.') ? load(new URL(name + (existsSync(new URL(name + '.tsx',url)) ? '.tsx' : '.ts'),url)) : require(name)
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
  const initial=load('../lib/protocols/form.ts').newCompound()
  const calls=[], errors=[], notices=[]
  const context={ savePending:{current:false},savedProtocolId:{current:null},retryBlocked:false,firstProtocol:true,
    compounds:[{...initial,...inventoryProtocolFields(item),dose:'5',dose_unit:'mg',route:'SubQ',days_of_week:[1]}],
    fromInventory:true,mode:'create',startDate:timing==='scheduled'?'2099-01-01':timing==='today'?localCalendarDate():'',planned:timing==='planned',editingId:null,
    continuedFromId:'',removedCompoundIds:[],localCalendarDate,...load('../lib/health/dosingEntry.ts'),...load('../lib/protocols/form.ts'),...load('../lib/protocols/quickStart.ts'),
    ProtocolSaveUncertainError:load('../lib/health/protocolMutations.ts').ProtocolSaveUncertainError,
    setRetryBlocked(value){context.retryBlocked=value},setSetupSuccess(value){notices.push(value)},
    setQuickValidationAttempts(){},setError(value){errors.push(value)},setSaving(){},setSavedNotice(value){notices.push(value)},setShowForm(){},setEditingId(){},load:async()=>{},
    saveProtocolWithEvents:async input=>{calls.push(input);return 'created-protocol-id'} }
  const save=new Function('context','with(context) {'+functionCode('save')+'; return save }')(context)
  return {save,context,calls,errors,notices}
}

test('real editor save sends only canonical protocol creation, with no dose inference or inventory mutation', async () => {
  for (const timing of ['today','scheduled','planned']) {
    const {save,context,calls,errors,notices}=saveHarness(timing)
    context.compounds[0].dose='';await save();assert.equal(calls.length,0,'Recorded inventory facts alone do not complete dosing')
    context.compounds[0].dose='5';errors.length=0
    await save()
    assert.deepEqual(errors,['']);assert.equal(calls.length,1)
    const payload=calls[0], compound=payload.compounds[0]
    assert.equal(payload.protocolId,null)
    assert.equal(payload.startDate,timing==='planned'?null:timing==='today'?localCalendarDate():'2099-01-01')
    assert.equal(compound.vials_in_stock,null);assert.equal(compound.bac_water_ml,null)
    assert.equal(compound.reconstitution_date,null);assert.equal(compound.phase.route,'SubQ')
    assert.equal(compound.phase.frequency,'1x/week');assert.equal(compound.phase.end_week,null)
    assert.equal(compound.phase.dosing_entry.dose,'5');assert.equal(compound.phase.dosing_entry.vial_strength,'10')
    assert.equal(notices[0].id,'created-protocol-id');assert.equal(notices[0].firstProtocol,true)
    assert.equal(notices[0].draft.compounds[0].dose,'5')
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
  const {save,context,calls}=saveHarness('scheduled')
  context.startDate='2026-02-30';await save();assert.equal(calls.length,0);assert.match(context.quickStartIssue({startDate:context.startDate,compounds:context.compounds}).message,/valid start date/)
  context.startDate='2099-01-01'
  const original=context.saveProtocolWithEvents
  context.saveProtocolWithEvents=async()=>{throw new Error('Rejected')}
  await save();assert.equal(context.savePending.current,false);assert.equal(context.savedProtocolId.current,null)
  context.saveProtocolWithEvents=original;await save();assert.equal(calls.length,1)
})

test('inventory action joins the shared creation surface with human timing and conditional fields', () => {
  const Timing=load('../components/protocols/ProtocolStartDate.tsx').default
  const html=renderToStaticMarkup(React.createElement(Timing,{value:localCalendarDate(),today:localCalendarDate(),onChange(){}}))
  for (const label of ['Start date','Today','Another date','I don’t know yet']) assert.ok(html.includes(label))
  assert.doesNotMatch(html,/Schedule for later|Save as Planned/)
  const Quick=load('../components/protocols/ProtocolQuickStart.tsx').default
  const fields={...saveHarness().context.compounds[0]}
  const quick=renderToStaticMarkup(React.createElement(Quick,{value:{startDate:localCalendarDate(),compounds:[{...fields,dose_unit:''}]},today:localCalendarDate(),onChange(){}}))
  assert.match(quick,/What are you tracking\?/)
  assert.doesNotMatch(quick,/Dose per injection|Vials in stock|Frequency|How long will you run/)
  assert.match(read('../components/inventory/Inventory.tsx'),/Use in a protocol<\/Link>/)
  assert.match(source,/Creating a protocol will not change your inventory quantity\./)
  assert.doesNotMatch(source,/Customize details/);assert.match(quick,/Continue/)
})
