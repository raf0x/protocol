import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require=createRequire(import.meta.url),cache=new Map()
function load(path, hooks) {
  const url=new URL(path,import.meta.url)
  if(!hooks && cache.has(url.href))return cache.get(url.href)
  const out={exports:{}}
  const code=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  new Function('require','module','exports',code)(name=>{
    if(name==='react' && hooks)return {...React,...hooks}
    if(name.endsWith('.css'))return {}
    if(!name.startsWith('.'))return require(name)
    return load(new URL(name+(existsSync(new URL(name+'.tsx',url))?'.tsx':'.ts'),url).href,hooks)
  },out,out.exports)
  if(!hooks)cache.set(url.href,out.exports);return out.exports
}
const {protocolSaveDates,localCalendarDate,isCalendarDate}=load('../lib/health/protocolDates.ts')
const form=load('../lib/protocols/form.ts')
const today='2026-09-22',start='2026-09-01'
test('Active creation uses its single start date; Planned ignores all date state',()=>{
  for(const date of [start,today]) assert.deepEqual(protocolSaveDates({mode:'create',planned:false,startDate:date,today,effectiveDate:'garbage',useDifferentDate:true}),{startDate:date,effectiveDate:date})
  assert.equal(protocolSaveDates({mode:'create',planned:false,startDate:'2026-09-23',today}).effectiveDate,'2026-09-23')
  assert.throws(()=>protocolSaveDates({mode:'create',planned:false,startDate:'',today}),/Choose a valid start date/)
  assert.deepEqual(protocolSaveDates({mode:'create',planned:true,startDate:'',today,effectiveDate:'garbage'}),{startDate:null,effectiveDate:null})
  assert.equal(isCalendarDate('2026-02-29'),false);assert.equal(isCalendarDate('2028-02-29'),true)
})
test('edits default to today; hidden and blank overrides are ignored; inclusive boundaries have specific errors',()=>{
  const input={mode:'edit',planned:false,startDate:start,originalStartDate:start,today,useDifferentDate:false,effectiveDate:'1999-01-01'}
  assert.equal(protocolSaveDates(input).effectiveDate,null)
  assert.equal(protocolSaveDates({...input,useDifferentDate:true,effectiveDate:''}).effectiveDate,null)
  for(const date of [start,today])assert.equal(protocolSaveDates({...input,useDifferentDate:true,effectiveDate:date}).effectiveDate,date)
  assert.throws(()=>protocolSaveDates({...input,useDifferentDate:true,effectiveDate:'2026-08-31'}),/Effective date cannot be before the protocol start date\./)
  assert.throws(()=>protocolSaveDates({...input,useDifferentDate:true,effectiveDate:'2026-09-23'}),/Effective date cannot be in the future\./)
})
test('local calendar boundaries do not parse YYYY-MM-DD as UTC',()=>{
  const source=ts.transpileModule(readFileSync(new URL('../lib/health/protocolDates.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
  for(const [zone,instant,expected] of [['America/Los_Angeles','2026-09-22T01:00:00Z','2026-09-21'],['Pacific/Kiritimati','2026-09-22T12:00:00Z','2026-09-23'],['America/New_York','2026-03-08T06:59:00Z','2026-03-08']]) {
    const code=source+`;console.log(exports.localCalendarDate(new Date('${instant}')))`
    assert.equal(execFileSync(process.execPath,['-e',code],{env:{...process.env,TZ:zone},encoding:'utf8'}).trim(),expected)
  }
})

test('edit bounds use the submitted start, independent of old start or reconstitution',()=>{
  const input={mode:'edit',planned:false,startDate:today,today,useDifferentDate:true,effectiveDate:start,originalStartDate:start,reconstitution_date:'1900-01-01'}
  assert.throws(()=>protocolSaveDates(input),/Effective date cannot be before the protocol start date\./)
  assert.equal(protocolSaveDates({...input,effectiveDate:today}).effectiveDate,today)
  assert.equal(protocolSaveDates({...input,useDifferentDate:false}).effectiveDate,null)
  assert.equal(protocolSaveDates({...input,effectiveDate:''}).effectiveDate,null)
  assert.deepEqual(protocolSaveDates({...input,planned:true,startDate:''}),{startDate:null,effectiveDate:null})
})

test('canonical create payload preserves GHK-Cu-like, Tirzepatide-like and arbitrary raw dosing exactly',()=>{
 const base={...form.newCompound(),route:'SubQ',days_of_week:[1],name:'GHK-Cu',input_mode:'syringe',syringe_markings:'18.2500',syringe_scale:'100',vial_strength:'50',vial_unit:'mg',bac_water_ml:'3'}
 const ghk=form.protocolCompoundPayload([base])[0].phase.dosing_entry
 assert.equal(ghk.syringe_markings,'18.2500');assert.equal(ghk.syringe_scale,'100');assert.equal(ghk.dose,'')
 const tirzepatide=form.protocolCompoundPayload([{...base,name:'Tirzepatide',input_mode:'volume',injection_volume:'0.1250',isPreMixed:true,preparation:'ready',concentration_value:'20',concentration_unit:'mg/mL'}])[0].phase.dosing_entry
 assert.equal(tirzepatide.mode,'volume');assert.equal(tirzepatide.injection_volume,'0.1250')
 const arbitrary=form.protocolCompoundPayload([{...base,name:'Arbitrary compound',input_mode:'unknown',injection_volume:'0.2',vial_label:'Unknown vial'}])[0].phase.dosing_entry
 assert.equal(arbitrary.mode,'unknown');assert.equal(arbitrary.vial_label,'Unknown vial')
})

function harness(protocols=[],deleteResult={data:[{id:'existing-id'}],error:null},inventory=[]) {
  const states=[],refs=[],calls=[];let slot=0,refSlot=0
  const deletion={eq(){return this},select:async()=>{calls.push({name:'delete'});return deleteResult}}
  const client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},from:()=>({select:()=>({eq(){return this},order:async()=>({data:protocols})}),delete:()=>deletion}),rpc:async(name,args)=>{calls.push({name,args});return {data:'saved',error:null}}}
  const url=new URL('../app/protocol/manage/page.tsx',import.meta.url),out={exports:{}}
  const code=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText
  const mutations=load('../lib/health/protocolMutations.ts')
  new Function('require','module','exports',code)(name=>{
    if(name==='react')return {...React,useEffect(){},useRef(initial){return refs[refSlot++]??(refs[refSlot-1]={current:initial})},useState(initial){const i=slot++;if(!(i in states))states[i]=i===1?false:i===2?protocols:typeof initial==='function'?initial():initial;return [states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value}]}}
    if(name.endsWith('/useLocalCalendarDate'))return {useLocalCalendarDate:()=>new Date().toLocaleDateString('en-CA')}
    if(name==='next/navigation')return {useRouter:()=>({push(){}})}
    if(name.endsWith('/supabase'))return {createClient:()=>client}
    if(name.endsWith('/inventory/client'))return {loadInventory:async()=>inventory,loadInventoryItem:async id=>{const item=inventory.find(item=>item.id===id);if(!item)throw new Error('Unavailable inventory');return item}}
    if(name.endsWith('/protocolMutations'))return {...mutations,saveProtocolWithEvents:input=>mutations.saveProtocolWithEvents(input,client),transitionProtocol:input=>mutations.transitionProtocol(input,client),deleteOwnedProtocol:id=>mutations.deleteOwnedProtocol(id,client)}
    if(name.endsWith('.css'))return {}
    if(name.startsWith('.'))return load(new URL(name+(name.includes('/components/')?'.tsx':'.ts'),url).href, {useEffect(){},useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useRef:initial=>({current:initial})})
    return require(name)
  },out,out.exports)
  function render(){slot=0;refSlot=0;const nodes=[];function visit(node){if(Array.isArray(node))return node.forEach(visit);if(!React.isValidElement(node))return;nodes.push(node);if(['ProtocolQuickStart','QuickProtocolFields','CompoundPicker','ProtocolStartDate','Choices','QuickChoices','QuickAmountField','QuickStartReview','QuickAdditionalFields','QuickStartError'].includes(node.type?.name))visit(node.type(node.props));else visit(node.props.children)}visit(out.exports.default());return nodes}
  return {calls,render,field:label=>render().find(n=>n.props['aria-label']===label),button:label=>render().find(n=>n.type==='button'&&text(n.props.children)===label),input(label,value){this.field(label).props.onChange({target:{value}})}}
}
function text(node) { if(Array.isArray(node))return node.map(text).join('');return React.isValidElement(node)?text(node.props.children):typeof node==='string'||typeof node==='number'?String(node):'' }
function createView(h) { return h.render().find(n=>n.type?.name==='ProtocolQuickStart') }
function submit(h) { return createView(h).props.onSave() }
function reviewCheckbox(h) { return h.render().find(n=>n.props.className==='dosing-confirmation').props.children.find(n=>React.isValidElement(n)&&n.type==='input') }
function editMeasurementMode(h) { return h.render().find(n=>n.type?.name==='QuickChoices'&&n.props.label==='How do you measure it?').props.value }
function configure(h, compound, startDate) {
  const node=h.render().find(n=>n.type?.name==='ProtocolQuickStart'), value=node.props.value
  node.props.onChange({...value,startDate:startDate ?? value.startDate,compounds:[{...value.compounds[0],route:'SubQ',days_of_week:[0,1,2,3,4,5,6],...compound}]})
}
function protocolFromSave(call, template=saved) {
  const payload=call.args.p_compounds[0], phase=payload.phase
  return {...template,name:call.args.p_name,start_date:call.args.p_start_date||template.start_date,compounds:[{...template.compounds[0],...payload,id:payload.id||template.compounds[0].id,phases:[{...template.compounds[0].phases[0],...phase,id:phase.id||template.compounds[0].phases[0].id}]}]}
}
const saved={id:'existing-id',name:'Existing',status:'active',start_date:start,compounds:[{id:'compound-id',name:'Existing',vial_strength:10,vial_unit:'mg',bac_water_ml:2,phases:[{id:'phase-id',start_week:1,end_week:null,dose:2,dose_unit:'mg',dose_semantics_version:1,frequency:'daily',days_of_week:[0,1,2,3,4,5,6]}]}]}
test('Quick Start keeps preparation and stock in the shared draft and saves one canonical payload',async()=>{
  const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
  try {
    const h=harness();h.render().find(n=>n.props.onAdd).props.onAdd()
    assert.equal(h.button('Start tracking'),undefined);assert.equal(h.field('Effective date'),undefined)
    configure(h,{name:'Test',dose:'2',dose_unit:'mg',vial_strength:'10',vial_unit:'mg',bac_water_ml:'2',vials_in_stock:'3',duration_weeks:'8',days_of_week:[1,4]})
    await Promise.all([submit(h),submit(h)])
    assert.equal(h.calls.length,1)
    const args=h.calls[0].args;assert.equal(args.p_protocol_id,null);assert.equal(args.p_effective_date,args.p_start_date)
    const c=args.p_compounds[0];assert.equal(c.phase.dosing_entry.mode,'medication');assert.equal(c.phase.dosing_entry.dose,'2');assert.equal(c.phase.dosing_entry.dose_unit,'mg');assert.deepEqual(c.phase.days_of_week,[1,4]);assert.equal(c.vials_in_stock,3);assert.equal(c.phase.end_week,8)
  }finally{globalThis.window=previous}
})
test('edit UI defaults today, ignores closed overrides and resets edit identity when creating',async()=>{
  const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
  try {
    const h=harness([saved]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit()
    assert.ok(h.button('Save changes'));assert.equal(h.field('Effective date'),undefined)
    h.button('Use a different effective date').props.onClick();h.input('Effective date','2099-01-01')
    await h.button('Save changes').props.onClick();assert.equal(h.calls.length,0)
    assert.ok(h.render().some(n=>n.props.children==='Effective date cannot be in the future.'))
    h.button('Use a different effective date').props.onClick()
    await h.button('Save changes').props.onClick()
    assert.equal(h.calls[0].args.p_effective_date,null);assert.equal(h.calls[0].args.p_protocol_id,saved.id)
    assert.equal(h.calls[0].args.p_compounds[0].id,'compound-id');assert.equal(h.calls[0].args.p_compounds[0].phase.id,'phase-id')
    h.render().find(n=>n.props.onAdd).props.onAdd();configure(h,{name:'New',dose:'5',dose_unit:'mg'})
    assert.equal(h.button('Use a different effective date'),undefined)
    await submit(h);assert.equal(h.calls[1].args.p_protocol_id,null)
  }finally{globalThis.window=previous}
})
test('edit options start closed and reveal one mounted secondary panel at a time',()=>{
  const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
  try {
    const h=harness([saved]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit()
    const option=name=>h.render().find(n=>n.props.className==='dosing-option-card'&&n.props['aria-controls']===`dosing-panel-0-${name}`)
    const panel=name=>h.render().find(n=>n.props.id===`dosing-panel-0-${name}`)
    const more=()=>h.render().find(n=>n.type==='details'&&n.props.className==='dosing-more-options')
    assert.equal(more().props.open,false)
    assert.equal(h.render().filter(n=>n.props.className==='dosing-option-card').length,6)
    for(const name of ['administration','vial','schedule','inventory','phases','other'])assert.equal(panel(name).props.hidden,true)
    more().props.onToggle({currentTarget:{open:true}})
    option('vial').props.onClick()
    assert.equal(panel('vial').props.hidden,false)
    option('schedule').props.onClick()
    assert.equal(panel('vial').props.hidden,true)
    assert.equal(panel('schedule').props.hidden,false)
    assert.ok(h.button('Save changes'))
  }finally{globalThis.window=previous}
})
test('Vial panel keeps one human issue and closes calculation details initially',()=>{
  const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
  try {
    const entry=load('../lib/health/dosingEntry.ts').entryFromForm({input_mode:'medication',dose:'10',dose_unit:'mg',preparation:'ready',concentration_value:'10',concentration_unit:'mg/mL',injection_volume:'0.2'})
    const protocol={...saved,compounds:[{...saved.compounds[0],phases:[{...saved.compounds[0].phases[0],dosing_entry:entry}]}]}
    const h=harness([protocol]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit()
    h.render().find(n=>n.type==='details'&&n.props.className==='dosing-more-options').props.onToggle({currentTarget:{open:true}})
    h.render().find(n=>n.props.className==='dosing-option-card'&&n.props['aria-controls']==='dosing-panel-0-vial').props.onClick()
    const nodes=h.render(), review=nodes.find(n=>n.props['data-dose-review']!==undefined)
    assert.equal(nodes.filter(n=>n.props.className==='dosing-panel-issue').length,1)
    assert.equal(nodes.find(n=>n.type?.name==='DoseSummary'),undefined)
    assert.equal(review.props.open,undefined);assert.equal(review.props.hidden,false)
    assert.equal(text(review.props.children[0]),'Review calculation')
  }finally{globalThis.window=previous}
})
test('empty rings link directly to Quick Add without suggesting active treatment',()=>{
  const Empty=load('../components/protocols/EmptyProtocolRings.tsx').default
  const html=renderToStaticMarkup(React.createElement(Empty))
  assert.match(html,/href="\/protocol\/manage\?new=1"/);assert.equal((html.match(/protocol-ring-empty/g)||[]).length,5)
  assert.match(html,/Add your first protocol/);assert.doesNotMatch(html,/week|dose due/i)
})

test('completion submits no hidden override and uses the local-calendar RPC',async()=>{
  const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
  try {
    const h=harness([saved]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onComplete).props.onComplete()
    await h.button('Complete').props.onClick()
    assert.equal(h.calls[0].name,'transition_protocol_v2');assert.equal(h.calls[0].args.p_effective_date,null)
    assert.equal(h.calls[0].args.p_timezone,Intl.DateTimeFormat().resolvedOptions().timeZone)
  }finally{globalThis.window=previous}
})
for(const result of [{data:null,error:{message:'Linked record prevents deletion'}},{data:[],error:null},{data:[{id:'existing-id'}],error:null}]) test(`delete reports the actual outcome (${JSON.stringify(result)})`,async()=>{
  const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
  try {
    const h=harness([saved],result);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onDelete).props.onDelete()
    assert.equal(h.calls.length,0,'deletion requires dialog confirmation')
    await h.button('Delete').props.onClick()
    assert.equal(h.calls.length,1)
    if(result.error||!result.data.length) {
      assert.ok(h.render().some(n=>n.props.role==='alert'&&/delet/i.test(n.props.children)))
      assert.ok(h.button('Delete'),'failed deletion keeps the dialog open')
    }else assert.equal(h.button('Delete'),undefined)
  }finally{globalThis.window=previous}
})

for (const custom of ['disabled','blank','toggled-off']) test(`hotfix: moving start to today and changing reconstitution submits no override (${custom})`,async()=>{
  const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
  try {
    const h=harness([saved]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit()
    h.input('Reconstitution date','2026-09-02')
    h.input('Protocol start date',localCalendarDate())
    if(custom!=='disabled') {
      h.button('Use a different effective date').props.onClick()
      h.input('Effective date',custom==='blank'?'':start)
      if(custom==='toggled-off') {
        h.button('Use a different effective date').props.onClick()
        assert.equal(h.field('Effective date'),undefined)
        h.button('Use a different effective date').props.onClick()
        assert.equal(h.field('Effective date').props.value,'','reopening cannot resurrect a custom date')
        h.button('Use a different effective date').props.onClick()
      }
    }
    await h.button('Save changes').props.onClick()
    assert.equal(h.calls.length,1,'the reproduced edit must save')
    assert.equal(h.calls[0].args.p_start_date,localCalendarDate())
    assert.equal(h.calls[0].args.p_effective_date,null,'no custom override is submitted')
    assert.equal(h.calls[0].args.p_compounds[0].reconstitution_date,'2026-09-02')
    assert.equal(h.calls[0].args.p_protocol_id,saved.id)
  }finally{globalThis.window=previous}
})

test('explicit new entry resets edit identity and retains prefilled units',async()=>{
  const previous=globalThis.window
  globalThis.window={scrollTo(){},location:{search:'?new=1&protocol=existing-id&name=Prefilled&dose=200&dose_unit=mcg&vial=10&vial_unit=mg&water=2'},history:{replaceState(){globalThis.window.location.search=''}}}
  try {
    const h=harness([saved]);await h.render().find(n=>n.props.onReload).props.onReload()
    assert.ok(createView(h));assert.equal(h.button('Save changes'),undefined)
    assert.equal(h.render().find(n=>n.type?.name==='ProtocolQuickStart').props.value.compounds[0].name,'Prefilled')
    assert.equal(createView(h).props.value.compounds[0].dose,'200')
    assert.equal(createView(h).props.value.compounds[0].dose_unit,'mcg')
    assert.equal(createView(h).props.value.compounds[0].vial_unit,'mg')
    assert.equal(createView(h).props.value.compounds[0].bac_water_ml,'2');configure(h,{})
    await submit(h)
    assert.equal(h.calls[0].args.p_protocol_id,null)
  }finally{globalThis.window=previous}
})

test('inventory handoff initializes the shared draft once and saves through the same RPC without stock or dose inference',async()=>{
  const previous=globalThis.window
  const item={id:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',item_name:'Test C',form:'lyophilized vial',vial_strength:10,strength_unit:'mg',quantity:8,reconstitution_status:'reconstituted',reconstitution_date:'2026-09-01'}
  globalThis.window={scrollTo(){},location:{search:`?new=1&inventory=${item.id}&start_date=2026-09-01`},history:{replaceState(){globalThis.window.location.search=''}}}
  try {
    const h=harness([],undefined,[item]), reload=h.render().find(n=>n.props.onReload).props.onReload
    await Promise.all([reload(),reload()])
    const draft=h.render().find(n=>n.type?.name==='ProtocolQuickStart').props.value
    assert.equal(draft.startDate,'2026-09-01');assert.equal(draft.compounds[0].name,'Testosterone cypionate')
    assert.equal(draft.compounds[0].reconstitution_date,'2026-09-01')
    assert.equal(draft.compounds[0].dose,'');assert.equal(draft.compounds[0].vials_in_stock,'')
    configure(h,{})
    await submit(h)
    assert.equal(h.calls.length,1);assert.equal(h.calls[0].name,'save_protocol_with_events_v2')
    assert.equal(h.calls[0].args.p_start_date,'2026-09-01');assert.equal(h.calls[0].args.p_effective_date,'2026-09-01')
    assert.equal(h.calls[0].args.p_compounds[0].phase.frequency,'daily');assert.equal(item.quantity,8)
  }finally{globalThis.window=previous}
})

test('additional setup shares values; unknown date, unspecified time and oral route survive saving and editing',async()=>{
  const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
  try {
    const h=harness();h.render().find(n=>n.props.onAdd).props.onAdd();configure(h,{name:'Recorded tablet'})
    configure(h,{route:'Oral',dose:'4',dose_unit:'mg',notes:'Retain this note'},'')
    await submit(h)
    assert.equal(h.calls[0].args.p_start_date,null);assert.equal(h.calls[0].args.p_compounds[0].phase.time_of_day,'')
    assert.equal(h.calls[0].args.p_compounds[0].phase.route,'Oral');assert.equal(h.calls[0].args.p_compounds[0].notes,'Retain this note')
    const editing={...saved,compounds:[{...saved.compounds[0],phases:[{...saved.compounds[0].phases[0],route:'Oral',time_of_day:''}]}]}
    const edit=harness([editing]);edit.render().find(n=>n.props.onOpen).props.onOpen(saved.id);edit.render().find(n=>n.props.onEdit).props.onEdit()
    assert.equal(edit.field('Route').props.value,'Oral');await edit.button('Save changes').props.onClick()
    assert.equal(edit.calls[0].args.p_compounds[0].phase.time_of_day,'');assert.equal(edit.calls[0].args.p_compounds[0].phase.id,'phase-id')
  }finally{globalThis.window=previous}
})

test('Scheduled state, active counts, Today and history switch on the local start day without a mutation',()=>{
  const {protocolLifecycle}=load('../lib/health/protocolDates.ts')
  const {todayProtocols,recentChanges}=load('../lib/health/today.ts')
  const {deriveBaseline}=load('../lib/health/timeline.ts')
  const {compoundOverview}=load('../lib/health/protocolPresentation.ts')
  const {isDueToday}=load('../lib/utils.ts')
  const protocol={...saved,start_date:'2026-09-23'}
  const event={id:'start',protocol_id:protocol.id,date:protocol.start_date,event_type:'started',description:'Started Existing',protocols:protocol}
  assert.equal(protocolLifecycle(protocol,today),'scheduled')
  assert.equal(todayProtocols([protocol],today).length,0)
  assert.equal(deriveBaseline([protocol],[],[],today).activeProtocolCount,0)
  assert.equal(recentChanges([event],[protocol],today).length,0)
  assert.equal(compoundOverview(protocol,protocol.compounds[0],today).week,null)
  assert.equal(isDueToday('daily',protocol.start_date,null,today),false)
  const Library=load('../components/protocols/ProtocolLibrary.tsx').default
  const html=renderToStaticMarkup(React.createElement(Library,{protocols:[protocol],today,selected:new Set(),onOpen(){},onAdd(){},onSelect(){}}))
  assert.match(html,/Scheduled protocols/);assert.match(html,/Starts Sep 23, 2026/)
  assert.doesNotMatch(html.slice(html.indexOf('aria-label="Active protocols"'),html.indexOf('aria-label="Scheduled protocols"')),/View Existing/)
  assert.equal(protocolLifecycle(protocol,protocol.start_date),'active')
  assert.equal(todayProtocols([protocol],protocol.start_date).length,1)
  assert.equal(deriveBaseline([protocol],[],[],protocol.start_date).activeProtocolCount,1)
  assert.equal(recentChanges([event],[protocol],protocol.start_date).length,1)
  assert.equal(isDueToday('daily',protocol.start_date,null,protocol.start_date),true)
})

test('creation accepts a future start and preparation today without an effective-date override',async()=>{
  const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
  try {
    const h=harness();h.render().find(n=>n.props.onAdd).props.onAdd()
    configure(h,{name:'Scheduled medication',dose:'5',dose_unit:'mg'},'2099-01-01')
    configure(h,{preparation:'mixing',reconstitution_date:localCalendarDate()})
    assert.equal(h.field('Effective date'),undefined)
    await submit(h)
    assert.equal(h.calls.length,1)
    assert.equal(h.calls[0].args.p_protocol_id,null)
    assert.equal(h.calls[0].args.p_start_date,'2099-01-01')
    assert.equal(h.calls[0].args.p_effective_date,'2099-01-01')
    assert.equal(h.calls[0].args.p_compounds[0].reconstitution_date,localCalendarDate())
  }finally{globalThis.window=previous}
})

test('pre-start edit ignores edit-history overrides, including when rescheduling or preparing earlier',async()=>{
  const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
  try {
    const scheduled={...saved,start_date:'2099-01-01'}
    const h=harness([scheduled]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit()
    assert.equal(h.button('Use a different effective date'),undefined)
    h.input('Protocol start date','2099-02-01');h.input('Reconstitution date',localCalendarDate())
    await h.button('Save changes').props.onClick()
    assert.equal(h.calls.length,1);assert.equal(h.calls[0].args.p_protocol_id,saved.id)
    assert.equal(h.calls[0].args.p_effective_date,'2099-02-01')
    assert.equal(h.calls[0].args.p_compounds[0].reconstitution_date,localCalendarDate())
  }finally{globalThis.window=previous}
})

test('open pages refresh local calendar state at midnight and when returning to the foreground',()=>{
  const dates=ts.transpileModule(readFileSync(new URL('../lib/health/protocolDates.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
  const hook=ts.transpileModule(readFileSync(new URL('../lib/health/useLocalCalendarDate.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
  const script=`const RealDate=Date;let clock=RealDate.parse('2026-09-22T23:59:59-04:00');global.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[clock]))}};let timer,delay,focus,current;global.setTimeout=(fn,ms)=>{timer=fn;delay=ms;return 1};global.clearTimeout=()=>{};global.window={addEventListener:(name,fn)=>{focus=fn},removeEventListener(){}};const d={exports:{}};new Function('exports',${JSON.stringify(dates)})(d.exports);const h={exports:{}};new Function('require','exports',${JSON.stringify(hook)})(name=>name==='react'?{useState:initial=>{current=initial;return[current,value=>{current=value}]},useEffect:fn=>fn()}:d.exports,h.exports);h.exports.useLocalCalendarDate();if(current!=='2026-09-22'||delay>1100)throw Error('midnight not scheduled');clock+=2000;timer();if(current!=='2026-09-23')throw Error('no midnight refresh');clock+=86400000;focus();if(current!=='2026-09-24')throw Error('no foreground refresh');console.log('pass')`
  assert.equal(execFileSync(process.execPath,['-e',script],{env:{...process.env,TZ:'America/New_York'},encoding:'utf8'}).trim(),'pass')
})

test('the actual create handler saves incomplete and unknown dosing through the canonical payload',async()=>{
  const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
  try {
    const h=harness();h.render().find(n=>n.props.onAdd).props.onAdd();configure(h,{name:'Tirzepatide',dose:'5'})
    const entered=createView(h).props.value.compounds[0].dose
    await submit(h);assert.equal(h.calls.length,1)
    assert.equal(entered,'5')
    const c=h.calls[0].args.p_compounds[0], {compoundOverview}=load('../lib/health/protocolPresentation.ts')
    assert.match(compoundOverview({status:'active',start_date:localCalendarDate()},{...c,phases:[c.phase]},localCalendarDate()).dose,/Medication dose not calculated/)
  }finally{globalThis.window=previous}
})

test('actual create submission preserves all four dosing modes',async()=>{
 const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
 try {
  const cases=[
   ['medication',{dose:'2.500',dose_unit:'mg'},'dose','2.500'],
   ['syringe',{syringe_markings:'18.250',syringe_scale:'100'},'syringe_markings','18.250'],
   ['volume',{injection_volume:'0.1250'},'injection_volume','0.1250'],
   ['unknown',{injection_volume:'0.2',vial_label:'Unknown label'},'vial_label','Unknown label'],
  ]
  for(const [mode,fields,key,expected] of cases) {
   const h=harness();h.render().find(n=>n.props.onAdd).props.onAdd();configure(h,{name:`${mode} case`,input_mode:mode,...fields})
   await submit(h);assert.equal(h.calls.length,1);const entry=h.calls[0].args.p_compounds[0].phase.dosing_entry
   assert.equal(entry.mode,mode);assert.equal(entry[key],expected)
  }
 }finally{globalThis.window=previous}
})

test('edit submission and reopen preserve all four dosing modes',async()=>{
 const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
 const {entryFromForm}=load('../lib/health/dosingEntry.ts')
 try {
  const cases=[
   ['medication',{dose:'2.5',dose_unit:'mg'},'Medication dose','2.5'],
   ['syringe',{syringe_markings:'18',syringe_scale:'100'},'Syringe markings','18'],
   ['volume',{injection_volume:'0.125'},'Injection volume (mL)','0.125'],
   ['unknown',{injection_volume:'0.2',vial_label:'Unknown label'},'Injection volume (mL)','0.2'],
  ]
  for(const [mode,fields,label,expected] of cases) {
   const entry=entryFromForm({input_mode:mode,reviewed:mode==='unknown',...fields})
   const protocol={...saved,compounds:[{...saved.compounds[0],phases:[{...saved.compounds[0].phases[0],dosing_entry:entry}]}]}
   const h=harness([protocol]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit();await h.button('Save changes').props.onClick()
   assert.equal(h.calls[0].args.p_compounds[0].phase.dosing_entry.mode,mode)
   const reopened=protocolFromSave(h.calls[0],protocol), again=harness([reopened]);again.render().find(n=>n.props.onOpen).props.onOpen(saved.id);again.render().find(n=>n.props.onEdit).props.onEdit()
   assert.equal(editMeasurementMode(again),mode);assert.equal(again.field(label).props.value,expected)
  }
 }finally{globalThis.window=previous}
})

test('confirmed unknown edits use only the current checkbox and dose-defining changes reset it',async()=>{
 const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
 const {entryFromForm,interpretEntry}=load('../lib/health/dosingEntry.ts')
 try {
  const confirmed=entryFromForm({input_mode:'unknown',injection_volume:'0.2',concentration_value:'10',concentration_unit:'mg/mL',preparation:'ready',reviewed:true})
  const protocol={...saved,compounds:[{...saved.compounds[0],phases:[{...saved.compounds[0].phases[0],dosing_entry:confirmed}]}]}
  const h=harness([protocol]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit()
  assert.equal(reviewCheckbox(h).props.checked,true);reviewCheckbox(h).props.onChange({target:{checked:false}});await h.button('Save changes').props.onClick()
  assert.equal(h.calls[0].args.p_compounds[0].phase.dosing_entry.review_status,'unverified');assert.equal(interpretEntry(h.calls[0].args.p_compounds[0].phase.dosing_entry).medication,null)
  const reopened=harness([protocolFromSave(h.calls[0],protocol)]);reopened.render().find(n=>n.props.onOpen).props.onOpen(saved.id);reopened.render().find(n=>n.props.onEdit).props.onEdit();assert.equal(reviewCheckbox(reopened).props.checked,false)

  const changed=harness([protocol]);changed.render().find(n=>n.props.onOpen).props.onOpen(saved.id);changed.render().find(n=>n.props.onEdit).props.onEdit();changed.input('Injection volume (mL)','0.25')
  assert.equal(reviewCheckbox(changed).props.checked,false);await changed.button('Save changes').props.onClick();assert.equal(changed.calls[0].args.p_compounds[0].phase.dosing_entry.review_status,'unverified')

  const untouched=harness([protocol]);untouched.render().find(n=>n.props.onOpen).props.onOpen(saved.id);untouched.render().find(n=>n.props.onEdit).props.onEdit();await untouched.button('Save changes').props.onClick()
  assert.equal(untouched.calls[0].args.p_compounds[0].phase.dosing_entry.review_status,'confirmed');assert.deepEqual(interpretEntry(untouched.calls[0].args.p_compounds[0].phase.dosing_entry).medication,{value:2,unit:'mg'})
 }finally{globalThis.window=previous}
})

test('reconstitution handoff keeps authoritative phase units before narrow compound fallback',async()=>{
 const previous=globalThis.window,{entryFromForm,interpretEntry}=load('../lib/health/dosingEntry.ts')
 try {
  const cases=[
   ['ready','IU','mg','IU'],
   ['unknown','mg','','mg'],
   ['ready','','mg','mg'],
  ]
  for(const [preparation,phaseUnit,compoundUnit,expectedUnit] of cases) {
   const entry=entryFromForm({input_mode:'volume',injection_volume:'0.2',preparation,vial_unit:phaseUnit,concentration_value:'99',concentration_unit:'IU/mL',reviewed:true})
   const protocol={...saved,compounds:[{...saved.compounds[0],vial_unit:compoundUnit,phases:[{...saved.compounds[0].phases[0],dosing_entry:entry}]}]}
   globalThis.window={scrollTo(){},location:{search:'?protocol=existing-id&compound=compound-id&reconstitution_vial=10&reconstitution_water=2'},history:{replaceState(){globalThis.window.location.search=''}}}
   const h=harness([protocol]);await h.render().find(n=>n.props.onReload).props.onReload()
   assert.equal(h.field('Vial amount').props.value,'10');assert.equal(h.field('BAC water in mL').props.value,'2');assert.equal(reviewCheckbox(h).props.checked,false)
   await h.button('Save changes').props.onClick();const savedEntry=h.calls[0].args.p_compounds[0].phase.dosing_entry
   assert.equal(savedEntry.preparation,'mixing');assert.equal(savedEntry.is_premixed,false);assert.equal(savedEntry.vial_unit,expectedUnit);assert.equal(savedEntry.concentration_value,'');assert.deepEqual(interpretEntry(savedEntry).medication,{value:1,unit:expectedUnit})
  }
  globalThis.window={scrollTo(){},location:{search:'?protocol=existing-id&compound=compound-id&reconstitution_vial=10'},history:{replaceState(){globalThis.window.location.search=''}}}
  const incompleteEntry=entryFromForm({input_mode:'volume',injection_volume:'0.2',preparation:'ready',concentration_value:'20',concentration_unit:'mg/mL'})
  const incompleteProtocol={...saved,compounds:[{...saved.compounds[0],phases:[{...saved.compounds[0].phases[0],dosing_entry:incompleteEntry}]}]}
  const incomplete=harness([incompleteProtocol]);await incomplete.render().find(n=>n.props.onReload).props.onReload();await incomplete.button('Save changes').props.onClick()
  const raw=incomplete.calls[0].args.p_compounds[0].phase.dosing_entry,result=interpretEntry(raw)
  assert.equal(raw.preparation,'mixing');assert.equal(raw.vial_strength,'10');assert.equal(raw.bac_water_ml,'');assert.equal(result.medication,null);assert.match(result.warnings.join(' '),/reconstitution volume/i)
 }finally{globalThis.window=previous}
})

test('review calculation stays closed and shows compact facts without raw arithmetic',()=>{
 const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
 const {entryFromForm}=load('../lib/health/dosingEntry.ts')
 try {
  const renderReview=entry=>{
   const protocol={...saved,compounds:[{...saved.compounds[0],phases:[{...saved.compounds[0].phases[0],dosing_entry:entry}]}]}
   const h=harness([protocol]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit()
   const nodes=h.render(),review=nodes.find(n=>n.props['data-dose-review']!==undefined)
   return {all:nodes.map(text).join(' '),review,html:renderToStaticMarkup(React.createElement('div',null,review.props.children))}
  }
  const conflict=renderReview(entryFromForm({input_mode:'medication',dose:'10',dose_unit:'mg',reviewed:true,preparation:'ready',concentration_value:'10',concentration_unit:'mg/mL',injection_volume:'0.2'}))
  assert.match(conflict.html,/<dt>Medication amount<\/dt><dd>10 mg<\/dd>/);assert.match(conflict.html,/<dt>Injection volume<\/dt><dd>0\.2 mL<\/dd>/)
  assert.match(conflict.html,/different medication amount/);assert.doesNotMatch(conflict.html,/Calculation \(rounded\)|Unverified dose semantics|Saved mixing details conflict/)
  assert.equal(conflict.review.props.open,undefined);assert.equal(conflict.review.props.hidden,false);assert.doesNotMatch(conflict.all,/Unverified dose semantics|You can still save/)
  const valid=renderReview(entryFromForm({input_mode:'medication',dose:'2',dose_unit:'mg',reviewed:true,preparation:'ready',concentration_value:'10',concentration_unit:'mg/mL',injection_volume:'0.2'}))
  assert.match(valid.html,/<dt>Medication amount<\/dt><dd>2 mg<\/dd>/);assert.match(valid.html,/<dt>Injection volume<\/dt><dd>0\.2 mL<\/dd>/);assert.match(valid.html,/<dt>Concentration<\/dt><dd>10 mg\/mL<\/dd>/)
  assert.doesNotMatch(valid.html,/Calculation \(rounded\)|different medication amount/)
  for(const [scale,markings] of [['100','20'],['40','8']]) {
   const syringeEntry=entryFromForm({input_mode:'syringe',syringe_scale:scale,syringe_markings:markings,preparation:'ready',concentration_value:'10',concentration_unit:'mg/mL'})
   assert.match(renderReview(syringeEntry).html,new RegExp(`<dt>Syringe draw</dt><dd>${markings} U-${scale} units</dd>`))
   const entered=renderReview({...syringeEntry,injection_volume:'0.2'})
   assert.match(entered.html,/<dt>Injection volume<\/dt><dd>0\.2 mL<\/dd>/);assert.doesNotMatch(entered.html,/Calculation \(rounded\)/)
  }
 }finally{globalThis.window=previous}
})

test('review distinguishes ambiguous recorded values from confirmable calculated medication',()=>{
 const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
 const {entryFromForm}=load('../lib/health/dosingEntry.ts')
 try {
  const reviewFor=entry=>{
   const protocol={...saved,compounds:[{...saved.compounds[0],phases:[{...saved.compounds[0].phases[0],dosing_entry:entry}]}]}
   const h=harness([protocol]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit()
   const nodes=h.render(),review=nodes.find(n=>n.props['data-dose-review']!==undefined)
   return {review,html:renderToStaticMarkup(React.createElement('div',null,review.props.children)),confirmation:nodes.find(n=>n.props.className==='dosing-confirmation')}
  }
  const ambiguous=reviewFor(entryFromForm({input_mode:'unknown',dose:'50',dose_unit:'IU'}))
  assert.match(ambiguous.html,/<dt>Recorded value<\/dt><dd>50 IU<\/dd>/)
  assert.doesNotMatch(ambiguous.html,/<dt>Medication amount<\/dt>|<dt>Calculated medication amount<\/dt>/)
  assert.equal(ambiguous.confirmation.props.hidden,true)
  const candidate=reviewFor(entryFromForm({input_mode:'unknown',dose:'50',dose_unit:'IU',injection_volume:'0.2',preparation:'ready',concentration_value:'10',concentration_unit:'mg/mL'}))
  assert.match(candidate.html,/<dt>Recorded value<\/dt><dd>50 IU<\/dd>/)
  assert.match(candidate.html,/<dt>Calculated medication amount<\/dt><dd>2 mg<\/dd>/)
  assert.equal(candidate.review.props.open,undefined);assert.equal(candidate.review.props.hidden,false)
  assert.equal(candidate.confirmation.props.hidden,false)
 }finally{globalThis.window=previous}
})

test('medication confirmation remains reachable after editing and survives save and reopen',async()=>{
 const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
 const {entryFromForm}=load('../lib/health/dosingEntry.ts')
 try {
  const confirmed=entryFromForm({input_mode:'medication',dose:'2',dose_unit:'mg',reviewed:true})
  const protocol={...saved,compounds:[{...saved.compounds[0],phases:[{...saved.compounds[0].phases[0],dosing_entry:confirmed}]}]}
  const h=harness([protocol]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit()
  assert.equal(reviewCheckbox(h).props.checked,true)
  h.input('Medication dose','3')
  const review=h.render().find(n=>n.props['data-dose-review']!==undefined)
  const label=h.render().find(n=>n.props.className==='dosing-confirmation')
  assert.equal(review.props.hidden,false);assert.equal(review.props.open,undefined);assert.equal(label.props.hidden,false)
  assert.equal(reviewCheckbox(h).props.checked,false)
  assert.match(renderToStaticMarkup(React.createElement('div',null,review.props.children)),/<dt>Medication amount<\/dt><dd>3 mg<\/dd>/)
  reviewCheckbox(h).props.onChange({target:{checked:true}})
  assert.equal(reviewCheckbox(h).props.checked,true)
  await h.button('Save changes').props.onClick()
  const savedEntry=h.calls[0].args.p_compounds[0].phase.dosing_entry
  assert.equal(savedEntry.review_status,'confirmed');assert.equal(savedEntry.dose,'3')
  const reopenedProtocol=protocolFromSave(h.calls[0],protocol),reopened=harness([reopenedProtocol]);reopened.render().find(n=>n.props.onOpen).props.onOpen(saved.id);reopened.render().find(n=>n.props.onEdit).props.onEdit()
  assert.equal(reviewCheckbox(reopened).props.checked,true)
  const Detail=load('../components/protocols/ProtocolDetail.tsx').default
  const detail=renderToStaticMarkup(React.createElement(Detail,{protocol:reopenedProtocol,today,onBack(){},onEdit(){},onComplete(){},onPause(){},onResume(){},onReactivate(){},onDelete(){},onReload(){}}))
  assert.match(detail,/>Change dose<\/summary>/)
 }finally{globalThis.window=previous}
})

test('review vial action focuses the revealed calculation summary',()=>{
 const previousWindow=globalThis.window,previousDocument=globalThis.document,previousFrame=globalThis.requestAnimationFrame
 globalThis.window={scrollTo(){},location:{search:''}}
 const {entryFromForm}=load('../lib/health/dosingEntry.ts')
 let focused=false,scrolled=false
 globalThis.document={getElementById:id=>id==='dosing-panel-0-vial'?{scrollIntoView(){scrolled=true},querySelector:selector=>selector==='.dosing-review-panel > summary'?{focus(){focused=true}}:null}:null}
 globalThis.requestAnimationFrame=callback=>callback()
 try {
  const entry=entryFromForm({input_mode:'medication',dose:'10',dose_unit:'mg',preparation:'ready',concentration_value:'10',concentration_unit:'mg/mL',injection_volume:'0.2'})
  const protocol={...saved,compounds:[{...saved.compounds[0],phases:[{...saved.compounds[0].phases[0],dosing_entry:entry}]}]}
  const h=harness([protocol]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit()
  h.render().find(n=>n.type?.name==='DoseSummary').props.onReview('vial')
  assert.equal(h.render().find(n=>n.props.id==='dosing-panel-0-vial').props.hidden,false)
  assert.equal(scrolled,true);assert.equal(focused,true)
 }finally{globalThis.window=previousWindow;globalThis.document=previousDocument;globalThis.requestAnimationFrame=previousFrame}
})

test('review preserves historical U-50 facts without rendering unsupported syringe arithmetic',()=>{
 const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
 const {entryFromForm}=load('../lib/health/dosingEntry.ts')
 try {
  const entry={...entryFromForm({input_mode:'medication',dose:'2',dose_unit:'mg',reviewed:true,injection_volume:'0.2',syringe_markings:'18',syringe_scale:'100',preparation:'ready',concentration_value:'10',concentration_unit:'mg/mL'}),syringe_scale:'50'}
  const protocol={...saved,compounds:[{...saved.compounds[0],phases:[{...saved.compounds[0].phases[0],dosing_entry:entry}]}]}
  const h=harness([protocol]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit()
  const review=h.render().find(n=>n.props['data-dose-review']!==undefined)
  const html=renderToStaticMarkup(React.createElement('div',null,review.props.children))
  assert.doesNotMatch(html,/18 ÷ 50|÷/)
  assert.match(html,/<dt>Syringe draw<\/dt><dd>18 U-50 units<\/dd>/);assert.equal(h.field('Syringe scale').props.value,'50')
  assert.match(html,/<dt>Injection volume<\/dt><dd>0\.2 mL<\/dd>/);assert.match(html,/<dt>Medication amount<\/dt><dd>2 mg<\/dd>/);assert.match(html,/10 mg\/mL/)
  assert.doesNotMatch(html,/Unverified dose semantics|You can still save|Unsupported syringe scale U-50/);assert.match(html,/saved U-50 scale cannot be used to calculate volume/)
 }finally{globalThis.window=previous}
})

test('overflow submits, persists raw input and reopens unchanged',async()=>{
 const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
 try {
  const h=harness();h.render().find(n=>n.props.onAdd).props.onAdd();configure(h,{name:'Overflow',input_mode:'volume',injection_volume:'1e308',isPreMixed:true,preparation:'ready',concentration_value:'1e308',concentration_unit:'mg/mL'})
  await submit(h);assert.equal(h.calls.length,1);assert.equal(h.calls[0].args.p_compounds[0].phase.dosing_entry.injection_volume,'1e308')
  const protocol=protocolFromSave(h.calls[0]),reopened=harness([protocol]);reopened.render().find(n=>n.props.onOpen).props.onOpen(saved.id);reopened.render().find(n=>n.props.onEdit).props.onEdit()
  assert.equal(reopened.field('Injection volume (mL)').props.value,'1e308')
 }finally{globalThis.window=previous}
})

test('unsupported historical scale survives open, unchanged save and reopen without calculation',async()=>{
 const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
 const {entryFromForm,interpretEntry}=load('../lib/health/dosingEntry.ts')
 try {
  const stored={...entryFromForm({input_mode:'syringe',syringe_markings:'18',syringe_scale:'100'}),syringe_scale:'50'}
  const protocol={...saved,compounds:[{...saved.compounds[0],phases:[{...saved.compounds[0].phases[0],dosing_entry:stored}]}]}
  const h=harness([protocol]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit();assert.equal(h.field('Syringe scale').props.value,'50');await h.button('Save changes').props.onClick()
  const savedEntry=h.calls[0].args.p_compounds[0].phase.dosing_entry;assert.equal(savedEntry.syringe_scale,'50');assert.equal(interpretEntry(savedEntry).volume,null);assert.equal(interpretEntry(savedEntry).status,'unverified')
  const reopened=harness([protocolFromSave(h.calls[0],protocol)]);reopened.render().find(n=>n.props.onOpen).props.onOpen(saved.id);reopened.render().find(n=>n.props.onEdit).props.onEdit();assert.equal(reopened.field('Syringe scale').props.value,'50')
 }finally{globalThis.window=previous}
})

test('medication V2 save and reopen keeps administration visible without changing the primary dose',async()=>{
 const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
 const {entryFromForm,dosingDisplay,administrationDisplay}=load('../lib/health/dosingEntry.ts')
 try {
  const entry=entryFromForm({input_mode:'medication',dose:'3',dose_unit:'mg',reviewed:true,preparation:'mixing',vial_strength:'',vial_unit:'mg',bac_water_ml:'',injection_volume:'0.18',syringe_markings:'18',syringe_scale:'100'})
  const protocol={...saved,compounds:[{...saved.compounds[0],phases:[{...saved.compounds[0].phases[0],dosing_entry:entry}]}]}
  const h=harness([protocol]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit();await h.button('Save changes').props.onClick()
  const reopenedProtocol=protocolFromSave(h.calls[0],protocol),reopened=harness([reopenedProtocol]);reopened.render().find(n=>n.props.onOpen).props.onOpen(saved.id);reopened.render().find(n=>n.props.onEdit).props.onEdit()
  const phase=reopenedProtocol.compounds[0].phases[0]
  assert.match(dosingDisplay(phase).primary,/^3 mg/);assert.deepEqual(administrationDisplay(phase),{volume:'0.18 mL',syringe:'18 U-100 units'})
  const review=reopened.render().find(n=>n.props['data-dose-review']!==undefined)
  const html=renderToStaticMarkup(React.createElement('div',null,review.props.children))
  assert.match(html,/<dt>Injection volume<\/dt><dd>0\.18 mL<\/dd>/);assert.match(html,/<dt>Syringe draw<\/dt><dd>18 U-100 units<\/dd>/)
 }finally{globalThis.window=previous}
})

test('phase selection and new phase hydrate preparation and confirmation without bleed',async()=>{
 const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
 try {
  const first={...saved.compounds[0].phases[0],id:'phase-a',dosing_entry:load('../lib/health/dosingEntry.ts').entryFromForm({input_mode:'syringe',syringe_markings:'18',syringe_scale:'100',vial_strength:'10',vial_unit:'mg',bac_water_ml:'2',reviewed:true})}
  const second={...saved.compounds[0].phases[0],id:'phase-b',start_week:5,dosing_entry:load('../lib/health/dosingEntry.ts').entryFromForm({input_mode:'volume',injection_volume:'0.25',isPreMixed:true,concentration_value:'20',concentration_unit:'mg/mL',reviewed:false})}
  const legacy={...saved.compounds[0].phases[0],id:'phase-c',start_week:9,dose:18,dose_unit:'IU',dose_semantics_version:null,dosing_entry:null}
  const protocol={...saved,compounds:[{...saved.compounds[0],phases:[first,second,legacy]}]}
  const h=harness([protocol]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit()
  h.field('Select phase').props.onChange({target:{value:'phase-a'}});assert.equal(h.field('Vial amount').props.value,'10');assert.equal(reviewCheckbox(h).props.checked,true)
  h.field('Select phase').props.onChange({target:{value:'phase-b'}});assert.equal(h.field('Concentration value').props.value,'20');assert.equal(h.field('Injection volume (mL)').props.value,'0.25');assert.equal(reviewCheckbox(h).props.checked,false)
  h.field('Select phase').props.onChange({target:{value:'phase-c'}});assert.equal(editMeasurementMode(h),'unknown');assert.equal(reviewCheckbox(h).props.checked,false)
  h.button('Add phase').props.onClick();assert.equal(editMeasurementMode(h),'medication');assert.equal(reviewCheckbox(h).props.checked,false);assert.equal(h.field('Vial amount').props.value,'')
 }finally{globalThis.window=previous}
})
test('legacy editing still permits incomplete historical dosing',async()=>{
  const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
  try {
    const legacy={...saved,compounds:[{...saved.compounds[0],phases:[{...saved.compounds[0].phases[0],dose:null,dose_unit:null,dose_semantics_version:null}]}]}
    const h=harness([legacy]);h.render().find(n=>n.props.onOpen).props.onOpen(saved.id);h.render().find(n=>n.props.onEdit).props.onEdit()
    await h.button('Save changes').props.onClick();assert.equal(h.calls.length,1)
    assert.equal(h.calls[0].args.p_protocol_id,saved.id);assert.equal(h.calls[0].args.p_compounds[0].phase.dosing_entry.mode,'unknown')
  }finally{globalThis.window=previous}
})
