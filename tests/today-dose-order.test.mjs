import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
const require=createRequire(import.meta.url)
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
function load(path, hooks) {
  const url=new URL(path,import.meta.url), compiled={exports:{}}
  const code=ts.transpileModule(read(url),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2021,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText
  new Function('require','module','exports',code)(name=>{
    if(name==='react' && hooks) return {...React,...hooks}
    if(name.startsWith('.')) {
      for(const ext of ['.ts','.tsx']) {const file=new URL(name+ext,url);try{read(file)}catch(error){if(error.code==='ENOENT')continue;throw error}return load(file,hooks)}
    }
    return require(name)
  },compiled,compiled.exports)
  return compiled.exports
}
const {orderTodayDoses,untakenTodayDoses,nextTodayDose,todayProtocols}=load('../lib/health/today.ts')
const dose=(id,time,name=id,protocol_name='Plan')=>({id,time_of_day:time,name,protocol_name,dose:'2',dose_unit:'mg'})
const ids=items=>items.map(item=>item.id)

test('time groups normalize case/whitespace, unknown and blank last, without mutating saved values',()=>{
  const due=Object.freeze([dose('n',' NIGHT '),dose('unknown','Breakfast'),dose('e','Evening'),dose('blank','  '),dose('a',' AFTERNOON'),dose('m','Morning '),dose('null',null),dose('odd','toString')].map(Object.freeze))
  const ordered=orderTodayDoses(due)
  assert.deepEqual(ids(ordered).slice(0,4),['m','a','e','n'])
  assert.deepEqual(new Set(ids(ordered).slice(4)),new Set(['unknown','blank','null','odd']))
  assert.equal(due[0].time_of_day,' NIGHT ')
  assert.deepEqual(ids(orderTodayDoses([...due].reverse())),ids(ordered))
})
test('ties use normalized compound name, protocol name and stable ID independent of input order',()=>{
  const due=[dose('z','morning',' beta '),dose('c','Morning','ALPHA','Plan B'),dose('b','morning',' alpha ','Plan A'),dose('a','morning','Alpha','Plan A')]
  assert.deepEqual(ids(orderTodayDoses(due)),['a','b','c','z'])
  assert.deepEqual(ids(orderTodayDoses([...due].reverse())),['a','b','c','z'])
})
test('next is earliest untaken, advances after logging, never selects completed doses',()=>{
  const due=[dose('n','night'),dose('m','morning'),dose('a','afternoon')],logs={}
  assert.equal(nextTodayDose(due,logs).id,'m')
  logs.m={taken:true}; assert.equal(nextTodayDose(due,logs).id,'a')
  logs.a={taken:true};assert.deepEqual(ids(untakenTodayDoses(due,logs)),['n'])
  logs.n={taken:true};assert.equal(nextTodayDose(due,logs),null)
})
function harness() {
  let selected=null
  const Focus=load('../components/today/TodaysFocusCard.tsx',{useState:()=>[selected,value=>{selected=value}]}).default
  const calls=[],props={activeCount:1,due:[dose('n','Night'),dose('m',' Morning '),dose('a','afternoon')],logs:{},saving:false,error:null,onTaken:id=>calls.push(id)}
  let tree
  const render=()=>{tree=Focus(props);return renderToStaticMarkup(tree)}
  const nodes=node=>!node||typeof node!=='object'?[]:[node,...React.Children.toArray(node.props?.children).flatMap(nodes)]
  const click=label=>{render();const button=nodes(tree).find(node=>node.type==='button'&&(node.props['aria-label']===label||node.props.children===label));assert.ok(button);assert.ok(!button.props.disabled);button.props.onClick()}
  return {props,calls,render,click}
}
test('navigation views every untaken dose and returns earlier without invoking logging',()=>{
  const h=harness()
  assert.match(h.render(),/<h3>m<\/h3>/);assert.match(h.render(),/1 of 3 remaining doses today/)
  h.click('View next dose today');assert.match(h.render(),/<h3>a<\/h3>/)
  assert.match(h.render(),/Scheduled dose today/);assert.doesNotMatch(h.render(),/Next scheduled dose today/)
  h.click('View next dose today');assert.match(h.render(),/<h3>n<\/h3>/)
  h.click('View previous dose today');h.click('View previous dose today');assert.match(h.render(),/<h3>m<\/h3>/)
  assert.deepEqual(h.calls,[]);assert.deepEqual(h.props.logs,{})
})
test('selection survives reordered refreshed rows by ID, clears after removal, and does not resurface',()=>{
  const h=harness();h.click('View next dose today')
  h.props.due=[...h.props.due].reverse().map(row=>({...row}));assert.match(h.render(),/<h3>a<\/h3>/)
  const original=h.props.due;h.props.due=original.filter(row=>row.id!=='a');assert.match(h.render(),/<h3>m<\/h3>/)
  h.props.due=original;assert.match(h.render(),/<h3>m<\/h3>/)
})
test('only Mark taken invokes canonical logging; successful logs advance and errors retain the dose',()=>{
  const h=harness();h.click('Mark taken');assert.deepEqual(h.calls,['m'])
  h.props.error='Write failed';assert.match(h.render(),/<h3>m<\/h3>/);assert.match(h.render(),/role="alert"/)
  h.props.logs={m:{taken:true}};assert.match(h.render(),/<h3>a<\/h3>/)
  h.click('View next dose today');h.click('Mark taken');assert.deepEqual(h.calls,['m','n'])
  h.props.logs.n={taken:true};assert.match(h.render(),/<h3>a<\/h3>/)
  h.props.logs.a={taken:true};assert.doesNotMatch(h.render(),/Mark taken|View next dose today/);assert.match(h.render(),/doses are logged/)
})
test('navigation is labeled, disabled at boundaries and while saving; whitespace is not a recorded time',()=>{
  const h=harness();assert.match(h.render(),/aria-label="View previous dose today" disabled/)
  h.props.saving=true;assert.match(h.render(),/aria-label="View next dose today" disabled/)
  h.props.due=[dose('blank','   ')];assert.match(h.render(),/Time not set/)
})
test('future protocols stay excluded on local calendar boundaries; date change resets selection',()=>{
  const {localCalendarDate}=load('../lib/health/protocolDates.ts'),prior=process.env.TZ
  try {
    process.env.TZ='America/Los_Angeles'
    const date=localCalendarDate(new Date('2026-09-22T00:30:00Z'));assert.equal(date,'2026-09-21')
    const protocol={id:'p',status:'active',start_date:'2026-09-22',compounds:[{id:'c',name:'Scheduled',phases:[]}]}
    assert.deepEqual(todayProtocols([protocol],date),[])
    assert.equal(todayProtocols([protocol],'2026-09-22').length,1)
  } finally {if(prior===undefined)delete process.env.TZ;else process.env.TZ=prior}
  assert.match(read('../components/today/TodayOverview.tsx'),/<TodaysFocusCard key=\{props.date\}/)
  assert.match(read('../app/protocol/page.tsx'),/setDueCompounds\(orderTodayDoses\(due\)\)/)
})
