import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const cache = new Map()
function load(path) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2021, esModuleInterop: true } }).outputText
  const compiled = { exports: {} }
  const resolve = name => {
    if (!name.startsWith('.')) return require(name)
    for (const extension of ['.ts', '.tsx']) {
      const file = new URL(name + extension, url)
      try { readFileSync(file) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
      return load(file.href)
    }
    throw new Error('Missing module: ' + name)
  }
  new Function('require', 'module', 'exports', code)(resolve, compiled, compiled.exports)
  cache.set(url.href, compiled.exports)
  return compiled.exports
}

const { compoundOverview } = load('../lib/health/protocolPresentation.ts')
const { todayProtocols } = load('../lib/health/today.ts')
const { deriveBaseline } = load('../lib/health/timeline.ts')
const { overlayMarkers } = load('../lib/health/protocolOverlay.ts')
const phase = { id: 'phase', start_week: 1, end_week: null, dose: 2, dose_unit: 'mg', dose_semantics_version: 1, frequency: 'daily' }
const planned = { id: 'planned', name: 'Saved plan', status: 'planned', start_date: null, compounds: [{ id: 'compound', name: 'Compound', phases: [phase] }] }
test('Planned has saved dosing but no current week, upcoming dose, Today entry or active baseline', () => {
  const overview = compoundOverview(planned, planned.compounds[0], '2026-09-20')
  assert.equal(overview.dose, '2 mg'); assert.equal(overview.week, null); assert.equal(overview.next, null)
  assert.deepEqual(todayProtocols([planned], '2026-09-20'), [])
  assert.equal(deriveBaseline([planned], [], [], '2026-09-20').activeProtocolCount, 0)
  assert.deepEqual(overlayMarkers([planned], []), [])
  const activated={...planned,status:'active',start_date:'2026-09-15'}
  const active=compoundOverview(activated,activated.compounds[0],'2026-09-20')
  assert.equal(active.week,1); assert.equal(active.next.date,'2026-09-20')
  assert.equal(todayProtocols([activated],'2026-09-20').length,1)
})
test('library and Today show a separate Planned section and Activate action', () => {
  const Library = load('../components/protocols/ProtocolLibrary.tsx').default
  const html = renderToStaticMarkup(React.createElement(Library, { protocols: [planned], today: '2026-09-20', selected: new Set(), selecting: false, onOpen() {}, onAdd() {}, onSelect() {}, onReload() {} }))
  const active = html.slice(html.indexOf('aria-label="Active protocols"'), html.indexOf('aria-label="Planned protocols"'))
  assert.ok(!active.includes('Saved plan'))
  assert.match(html, /Planned protocols/); assert.match(html, />Activate</)
  const Planned = load('../components/protocols/PlannedProtocols.tsx').default
  const today = renderToStaticMarkup(React.createElement(Planned, {protocols: [planned, {...planned, id:'active', name:'Active only', status:'active'}], onActivated() {}}))
  assert.match(today, /Saved plan/); assert.doesNotMatch(today, /Active only/); assert.match(today, />Activate</)
})

test('activation dialog requires a valid date and sends the chosen date with the existing ID', async () => {
  const states = []; let slot = 0, refreshed = 0
  const calls = []
  const mutations = load('../lib/health/protocolMutations.ts')
  const client = { async rpc(name, args) { calls.push({name,args}); return {error:null} } }
  const url = new URL('../components/protocols/ActivateProtocol.tsx', import.meta.url)
  const code = ts.transpileModule(readFileSync(url,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
  const compiled = {exports:{}}
  new Function('require','module','exports',code)(name => {
    if (name === 'react') return {...React,useState(initial) {
      const index=slot++; if (!(index in states)) states[index]=initial
      return [states[index],value => {states[index]=typeof value==='function' ? value(states[index]) : value}]
    }}
    if (name.endsWith('protocolMutations')) return {transitionProtocol: input => mutations.transitionProtocol(input,client)}
    if (name.endsWith('dosingEntry')) return load('../lib/health/dosingEntry.ts')
    if (name === './ProtocolDialog') return {default: ({children}) => children}
    return require(name)
  },compiled,compiled.exports)
  function render() {
    slot=0; const nodes=[]
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit)
      if (!React.isValidElement(node)) return
      nodes.push(node); visit(node.props.children)
    }
    visit(compiled.exports.default({protocol:planned,onActivated:()=>refreshed++}))
    return nodes
  }
  const button = label => render().find(node=>node.type==='button' && node.props.children===label)
  button('Activate').props.onClick()
  const input = () => render().find(node=>node.type==='input')
  input().props.onChange({target:{value:''}})
  await button('Confirm activation').props.onClick()
  assert.equal(calls.length,0)
  assert.ok(render().some(node=>node.props.role==='alert'))
  input().props.onChange({target:{value:'2026-09-15'}})
  await button('Confirm activation').props.onClick()
  assert.deepEqual(calls,[{name:'transition_protocol_v1',args:{p_protocol_id:'planned',p_action:'activate',p_effective_date:'2026-09-15'}}])
  assert.equal(refreshed,1)
})

test('Add Protocol saves Planned without requiring or submitting a start date', async () => {
  const states=[]; let slot=0
  const calls=[]
  const client={auth:{getUser:async()=>({data:{user:{id:'owner'}}})},
    from:()=>({select:()=>({order:async()=>({data:[]})})}),
    rpc:async(name,args)=>{calls.push({name,args});return {data:'saved-id',error:null}}
  }
  const mutations=load('../lib/health/protocolMutations.ts')
  const url=new URL('../app/protocol/manage/page.tsx',import.meta.url)
  const code=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText
  const compiled={exports:{}}
  new Function('require','module','exports',code)(name=>{
    if(name==='react')return {...React,useEffect:()=>{},useState(initial){
      const index=slot++;if(!(index in states))states[index]=initial===true ? false : initial
      return [states[index],value=>{states[index]=typeof value==='function'?value(states[index]):value}]
    }}
    if(name==='next/navigation')return {useRouter:()=>({push(){}})}
    if(name.endsWith('.css'))return {}
    if(name.endsWith('/supabase'))return {createClient:()=>client}
    if(name.endsWith('/protocolMutations'))return {...mutations,saveProtocolWithEvents:input=>mutations.saveProtocolWithEvents(input,client)}
    if(name.startsWith('.'))return load(new URL(name+(name.includes('/components/')?'.tsx':'.ts'),url).href)
    return require(name)
  },compiled,compiled.exports)
  const previous=globalThis.window
  globalThis.window={scrollTo(){},location:{search:''}}
  try{
    function render(){slot=0;const nodes=[];function visit(node){if(Array.isArray(node))return node.forEach(visit);if(!React.isValidElement(node))return;nodes.push(node);visit(node.props.children)}visit(compiled.exports.default());return nodes}
    render().find(node=>node.props.onAdd).props.onAdd()
    render().find(node=>node.props['aria-label']==='Protocol state').props.onChange({target:{value:'planned'}})
    render().find(node=>node.props['aria-label']==='Compound name').props.onChange({target:{value:'Saved compound'}})
    assert.ok(!render().some(node=>node.props['aria-label']==='Protocol start date'))
    await render().find(node=>node.type==='button'&&node.props.children==='Save Planned protocol').props.onClick()
    assert.equal(calls.length,1)
    assert.equal(calls[0].name,'save_protocol_with_events_v1')
    assert.equal(calls[0].args.p_start_date,null)
    assert.equal(calls[0].args.p_protocol_id,null)
    assert.equal(calls[0].args.p_compounds[0].name,'Saved compound')
  }finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous}
})
