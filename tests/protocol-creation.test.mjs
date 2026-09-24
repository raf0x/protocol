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
function configure(h, compound, startDate) {
  const node=h.render().find(n=>n.type?.name==='ProtocolQuickStart'), value=node.props.value
  node.props.onChange({...value,startDate:startDate ?? value.startDate,compounds:[{...value.compounds[0],route:'SubQ',days_of_week:[0,1,2,3,4,5,6],...compound}]})
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

test('explicit new/calculator entry resets edit identity and retains prefilled units',async()=>{
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
    await submit(h);assert.equal(h.calls.length,0,'Inventory facts cannot substitute for a dose')
    configure(h,{dose:'5',dose_unit:'mg'})
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

test('the actual create handler rejects incomplete doses, then saves a display-ready card',async()=>{
  const previous=globalThis.window;globalThis.window={scrollTo(){},location:{search:''}}
  try {
    const h=harness();h.render().find(n=>n.props.onAdd).props.onAdd();configure(h,{name:'Tirzepatide',dose:'5'})
    await submit(h);assert.equal(h.calls.length,0)
    assert.equal(createView(h).props.value.compounds[0].dose,'5')
    configure(h,{dose_unit:'mg'});await submit(h);assert.equal(h.calls.length,1)
    const c=h.calls[0].args.p_compounds[0], {compoundOverview}=load('../lib/health/protocolPresentation.ts')
    assert.equal(compoundOverview({status:'active',start_date:localCalendarDate()},{...c,phases:[c.phase]},localCalendarDate()).dose,'5 mg')
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
