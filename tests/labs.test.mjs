import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
function load(path) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  const compiled = { exports: {} }
  const resolve = name => {
    if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) }
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
const { prepareLabDraft, resolveLabStatus, biomarkerHistories, trendPoints, panelSummary } = load('../lib/health/labs.ts')
const { readLabPanels, saveLabPanel } = load('../lib/health/loadLabs.ts')
const { normalizeLabTimeline } = load('../lib/health/labTimeline.ts')
const { normalizeTimeline, groupTimeline } = load('../lib/health/timeline.ts')
const Badge = load('../components/health/LabStatusBadge.tsx').default
const Trend = load('../components/health/BiomarkerTrend.tsx').default
const LabEvent = load('../components/timeline/LabTimelineEvent.tsx').default
const { activeTab } = load('../lib/tabs.ts')
const row = { biomarker_name: 'Example marker', entry: '12', unit: 'unit/mL', reference_low: '10', reference_high: '20', reference_text: '', status: '' }
const draft = { test_date: '2026-09-01', panel_name: 'Example panel', provider: '', notes: '', results: [row] }
function result(overrides = {}) { return { id: 'r1', lab_panel_id: 'p1', user_id: 'owner', canonical_name: null, category: null, ...prepareLabDraft(draft).results[0], ...overrides } }
function panel(id, date, results) { return { id, test_date: date, panel_name: 'Example panel', provider: null, user_id: 'owner', results } }
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props))

test('prepare a panel with multiple numeric/qualitative results and incomplete references', () => {
  const prepared = prepareLabDraft({ ...draft, results: [row, { ...row, entry: 'Not detected', reference_low: '', reference_high: '', reference_text: 'Negative', status: '' }] })
  assert.equal(prepared.results.length, 2)
  assert.equal(prepared.panel.provider, null)
  assert.equal(prepared.results[1].value, null)
  assert.equal(prepared.results[1].value_text, 'Not detected')
  assert.equal(prepared.results[1].status, 'unknown')
  assert.equal(prepareLabDraft({ ...draft, results: [{ ...row, entry: '<5' }] }).results[0].value, null)
})
test('inclusive numeric bounds derive normal/high/low and preserve explicit abnormal or unknown', () => {
  for (const value of [10, 12, 20]) assert.equal(resolveLabStatus(value, 10, 20).status, 'normal')
  assert.equal(resolveLabStatus(21, 10, 20).status, 'high')
  assert.equal(resolveLabStatus(9, 10, 20).status, 'low')
  assert.equal(resolveLabStatus(12, null, null).status, 'unknown')
  assert.equal(resolveLabStatus(null, 10, 20).status, 'unknown')
  assert.deepEqual(resolveLabStatus(12, 10, 20, 'abnormal'), { status: 'abnormal', status_source: 'reported' })
  assert.equal(resolveLabStatus(99, 10, 20, 'unknown').status, 'unknown')
})
test('reject invalid dates, nonfinite numeric results, inverted ranges and missing required entries', () => {
  assert.throws(() => prepareLabDraft({ ...draft, test_date: '2026-02-30' }))
  for (const entry of ['NaN', 'Infinity', '1e999', '']) assert.throws(() => prepareLabDraft({ ...draft, results: [{ ...row, entry }] }))
  assert.throws(() => prepareLabDraft({ ...draft, results: [{ ...row, reference_low: '30' }] }))
  assert.throws(() => prepareLabDraft({ ...draft, results: [] }))
  assert.equal(prepareLabDraft({ ...draft, results: Array(120).fill(row) }).results.length,120)
  assert.throws(() => prepareLabDraft({ ...draft, results: Array(501).fill(row) }))
})
test('same marker across panels groups exact names and keeps differing units separate', () => {
  const histories = biomarkerHistories([panel('p1','2026-08-01',[result()]), panel('p2','2026-09-01',[result({ id:'r2', value: 15 })]), panel('p3','2026-09-02',[result({ id:'r3', unit:'other-unit' })]), panel('p4','2026-09-03',[result({ id:'r4', biomarker_name:'Another marker' })])])
  const history = histories.find(item => item.name === row.biomarker_name)
  assert.equal(history.panelCount, 3)
  assert.equal(history.units.length, 2)
  assert.equal(history.units.find(item => item.unit === row.unit).observations[0].date, '2026-09-01')
  const html = render(Trend, { history })
  assert.ok(html.includes('Units differ'))
  assert.ok(html.includes('no conversion'))
})
test('chart compares only numeric same-unit unique-date readings and never mutates observations', () => {
  const observations = [{ date:'2026-09-01', result:result({value:15}) }, { date:'2026-08-01', result:result({value:12}) }]
  const before = JSON.stringify(observations)
  assert.equal(trendPoints(observations).length, 2)
  assert.equal(JSON.stringify(observations), before)
  for (const change of [{unit:'other'}, {unit:''}, {value:null}]) assert.deepEqual(trendPoints([observations[0], { ...observations[1], result:result(change) }]), [])
  assert.deepEqual(trendPoints([observations[0], observations[0]]), [])
})
test('lab normalization is panel-sized, chronological, identity-preserving and Labs-filterable', () => {
  const panels = [panel('old','2026-08-01',[result()]), panel('new','2026-09-01',Array.from({length:40},(_,i)=>result({id:`r${i}`,status:i<2?'high':'normal'})))]
  const labs = normalizeLabTimeline(panels)
  assert.deepEqual(labs.map(item => item.sourceId), ['new','old'])
  assert.equal(labs[0].description, '40 biomarkers measured · 2 high')
  assert.ok(JSON.stringify(labs[0]).length < 500)
  const events = [...normalizeTimeline([], [{ id:'j',date:'2026-08-15',weight:160,notes:null,mood:null,energy:null,hunger:null,sleep:null }]), ...labs]
  assert.equal(events.filter(item => item.category === 'Labs').length, 2)
  assert.equal(groupTimeline(events)[0].days[0].date, '2026-09-01')
  assert.ok(render(LabEvent,{event:labs[0]}).includes('/health?panel=new'))
  assert.ok(!render(LabEvent,{event:labs[0]}).includes(row.biomarker_name))
})
test('status badges carry text and icons; unknown is not an abnormal result', () => {
  for (const status of ['low','normal','high','abnormal','unknown']) assert.ok(render(Badge,{status}).includes(status[0].toUpperCase()+status.slice(1)))
  assert.equal(panelSummary([result({status:'unknown'})]), '1 biomarker measured')
  assert.equal(activeTab('/health'), 'Health')
  assert.equal(activeTab('/journal'), 'Health')
})
test('read path scopes both queries to owner and joins without N+1', async () => {
  const calls = []
  const client = { from(table) {
    const query = { select(){ return query }, eq(key,value){ calls.push([table,key,value]);return query }, order(){return query}, range(){return Promise.resolve({data:table==='lab_panels'?[panel('p1','2026-09-01',[])]:[result()],error:null})} }
    return query
  } }
  const panels = await readLabPanels(client,'owner')
  assert.deepEqual(calls, [['lab_panels','user_id','owner'],['lab_results','user_id','owner']])
  assert.equal(panels[0].results.length, 1)
})
test('save validates before a single atomic RPC, does not send owner IDs, and reports failures', async () => {
  const calls = []
  const client = { auth:{ getUser:async()=>({data:{user:{id:'owner'}},error:null}) }, rpc:async(name,payload)=>{calls.push({name,payload});return {data:'panel-id',error:null}} }
  assert.equal(await saveLabPanel({...draft,results:[row,row]},client), 'panel-id')
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'save_lab_panel_v1')
  assert.equal(calls[0].payload.p_results.length, 2)
  assert.ok(!JSON.stringify(calls).includes('user_id'))
  await assert.rejects(saveLabPanel({...draft,results:[]},client))
  assert.equal(calls.length,1)
  await assert.rejects(saveLabPanel(draft,{...client,rpc:async()=>({error:{message:'fail'},data:null})}),/could not confirm/)
  await assert.rejects(saveLabPanel(draft,{...client,auth:{getUser:async()=>({data:{user:null},error:null})}}),/sign in/)
})
