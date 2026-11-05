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
const { entryFromForm, interpretEntry, entryFormState } = load('../lib/health/dosingEntry.ts')
const { dosingIssue, phaseDosingIssue, isDosingReviewField } = load('../lib/health/dosingGuidance.ts')
const Summary = load('../components/protocols/DoseSummary.tsx').default
const Row = load('../components/protocols/ProtocolRow.tsx').default
const Detail = load('../components/protocols/ProtocolDetail.tsx').default
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
const entry = extra => entryFromForm({ input_mode: 'medication', dose: '2', dose_unit: 'mg', preparation: 'mixing', vial_strength: '10', vial_unit: 'mg', bac_water_ml: '2', reviewed: true, ...extra })

for (const [name, raw, code, field] of [
  ['medication and volume conflict', { injection_volume: '0.2' }, 'medication-volume-conflict', 'Injection volume (mL)'],
  ['markings and entered volume conflict', { syringe_markings: '20', syringe_scale: '100', injection_volume: '0.3' }, 'markings-volume-conflict', 'Injection volume (mL)'],
  ['medication and markings conflict', { syringe_markings: '20', syringe_scale: '100' }, 'medication-markings-conflict', 'Syringe markings'],
  ['missing scale', { input_mode: 'syringe', dose: '', syringe_markings: '20', syringe_scale: '' }, 'missing-scale', 'Syringe scale'],
  ['incomplete amount', { vial_strength: '' }, 'incomplete-mixing', 'Vial amount'],
  ['incomplete mixing unit', { vial_unit: '' }, 'incomplete-mixing', 'Vial unit'],
  ['incomplete liquid volume', { bac_water_ml: '' }, 'incomplete-mixing', 'BAC water in mL'],
  ['retained preparation sources', { concentration_value: '5', concentration_unit: 'mg/mL' }, 'preparation-source-conflict', 'Preparation source'],
  ['unconfirmed preparation', { preparation: 'unknown' }, 'unknown-preparation', 'Preparation source'],
  ['incompatible units', { dose_unit: 'IU' }, 'incompatible-units', 'Medication dose unit'],
  ['unknown dose semantics', { input_mode: 'unknown', reviewed: false }, 'unknown-semantics', 'How do you measure it?'],
]) {
  test(name + ' names the exact next field without changing any saved value', () => {
    const saved = Object.freeze(entry(raw)), before = JSON.stringify(saved), interpreted = interpretEntry(saved)
    const guidance = dosingIssue(saved)
    assert.equal(guidance.code, code); assert.equal(guidance.field, field)
    assert.ok(guidance.explanation.includes(field), guidance.explanation)
    assert.notEqual(guidance.title, 'Vial details need review')
    assert.equal(JSON.stringify(saved), before)
    assert.deepEqual(interpretEntry(saved), interpreted, 'Presentation must not change calculations or review status')
    assert.equal(isDosingReviewField(field), true)
  })
}
test('unsupported historical scale is retained and no scale is inferred', () => {
  const saved = Object.freeze({ ...entry({ input_mode: 'syringe', dose: '', syringe_markings: '18' }), syringe_scale: '50' })
  assert.equal(dosingIssue(saved).code, 'unsupported-scale')
  assert.equal(saved.syringe_scale, '50')
  assert.equal(interpretEntry(saved).volume, null)
  const blank = entry({ input_mode: 'syringe', dose: '', syringe_markings: '18', syringe_scale: '' })
  assert.equal(dosingIssue(blank).field, 'Syringe scale')
  assert.equal(blank.syringe_scale, '')
})
test('ready preparation distinguishes a missing concentration value from its unit', () => {
  for (const [value, unit, field] of [['', 'mg/mL', 'Concentration value'], ['5', '', 'Concentration unit']]) {
    const saved = entry({ input_mode: 'volume', dose: '', injection_volume: '.2', preparation: 'ready', vial_strength: '', vial_unit: '', bac_water_ml: '', concentration_value: value, concentration_unit: unit })
    assert.equal(dosingIssue(saved).field, field)
  }
})
test('legacy values and compound/phase disagreements remain untouched', () => {
  const phase = Object.freeze({ dose: '18.00', dose_unit: 'IU', dose_semantics_version: null })
  const before = JSON.stringify(phase)
  assert.equal(phaseDosingIssue(phase).code, 'legacy-semantics')
  assert.match(phaseDosingIssue(phase).explanation, /Historical values are preserved/)
  assert.equal(JSON.stringify(phase), before)
  const snapshot = Object.freeze({ dosing_entry: Object.freeze(entry({ bac_water_ml: '' })) })
  const hydrated = entryFormState(snapshot, { bac_water_ml: '4', vial_strength: '20' })
  assert.equal(hydrated.bac_water_ml, '')
  assert.equal(dosingIssue(snapshot.dosing_entry).field, 'BAC water in mL')
  assert.equal(snapshot.dosing_entry.bac_water_ml, '')
})
test('compact and full summaries retain explanations and invoke exact-field recovery', () => {
  for (const compact of [true, false]) {
    const phase = { dosing_entry: entry({ injection_volume: '.2' }) }, calls = []
    const html = render(Summary, { phase, compact, onReview: (...args) => calls.push(args) })
    assert.match(html, /Medication dose and volume disagree/)
    assert.match(html, /differs from the volume calculated/)
    assert.match(html, /Review injection volume/)
    const tree = Summary({ phase, compact, onReview: (...args) => calls.push(args) })
    function find(node) {
      if (Array.isArray(node)) return node.map(find).find(Boolean)
      if (!node || typeof node !== 'object') return null
      return node.type === 'button' ? node : find(node.props?.children)
    }
    find(tree).props.onClick()
    assert.deepEqual(calls, [['syringe', 'Injection volume (mL)']])
  }
})
test('normal confirmed medication-only records do not acquire a preparation warning', () => {
  for (const preparation of ['ready', 'mixing']) {
    const saved = entryFromForm({ input_mode: 'medication', dose: '5.25', dose_unit: 'mg', preparation, reviewed: true })
    assert.equal(dosingIssue(saved), null)
    assert.doesNotMatch(render(Summary, { phase: { dosing_entry: saved }, compact: true }), /dose-issue/)
  }
})
test('unverified review state stays unverified and is not clinical confirmation', () => {
  const saved = entry({ reviewed: false })
  assert.equal(dosingIssue(saved).code, 'unconfirmed-entry')
  assert.match(dosingIssue(saved).explanation, /does not clinically confirm/)
  assert.equal(saved.review_status, 'unverified')
})
test('invalid stored JSON receives recovery without rewriting its raw fields', () => {
  const saved = Object.freeze({ ...entry({}), syringe_scale: '0', dose: 'original invalid value' })
  const before = JSON.stringify(saved)
  assert.equal(phaseDosingIssue({ dosing_entry: saved }).code, 'invalid-entry')
  assert.match(render(Summary, { phase: { dosing_entry: saved } }), /Saved dose entry is invalid/)
  assert.equal(JSON.stringify(saved), before)
})
test('protocol rows link directly to the named recovery field', () => {
  const html = render(Row, { id: 'compound', name: 'Synthetic', week: 1, phase: { id: 'phase', dosing_entry: entry({ input_mode: 'syringe', dose: '', syringe_markings: '20', syringe_scale: '' }), start_week: 1, end_week: null, frequency: 'daily' }, protocolId: 'protocol', color: '#ffffff', selected: false, onSelect() {} })
  assert.match(html, /review=Syringe%20scale/)
  assert.match(html, /Syringe scale is missing/)
  assert.match(html, /their scale is missing/)
})
test('Protocol detail names phase provenance and does not manufacture a vial expiry', () => {
  const protocol = { id: 'protocol', name: 'Synthetic', status: 'active', start_date: '2026-11-01', compounds: [{ id: 'compound', name: 'Synthetic', reconstitution_date: '2026-11-01', vials_in_stock: 0, bac_water_ml: 4, vial_strength: 20, vial_unit: 'mg', phases: [{ id: 'phase', start_week: 1, end_week: null, frequency: 'daily', dosing_entry: entry({}) }] }] }
  const before = JSON.stringify(protocol)
  const html = render(Detail, { protocol, today: '2026-11-04', onBack(){}, onEdit(){}, onComplete(){}, onPause(){}, onResume(){}, onReactivate(){}, onDelete(){}, onReload(){} })
  assert.match(html, /Saved phase preparation/)
  assert.match(html, /do not confirm the current vial/)
  assert.match(html, /Recorded reconstitution date/)
  assert.match(html, /no recorded source linked to this vial/)
  assert.match(html, /0 vials in stock/)
  assert.equal(JSON.stringify(protocol), before)
})
const editor = readFileSync(new URL('../app/protocol/manage/page.tsx', import.meta.url), 'utf8')
function editorFunction(name) {
  const ast = ts.createSourceFile('page.tsx', editor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found
  function visit(n) { if (ts.isFunctionDeclaration(n) && n.name?.text === name) found = n.getText(ast); ts.forEachChild(n, visit) }
  visit(ast); assert.ok(found)
  return ts.transpileModule(found, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
}
test('retired New Vial URLs cannot prefill the editor or issue a mutation', async () => {
  for (const key of ['reconstitution_vial', 'reconstitution_water', 'reconstitution_date']) {
    const protocol = Object.freeze({ id: 'protocol', compounds: [Object.freeze({ id: 'compound', vial_strength: 10, bac_water_ml: 2, doses_taken_override: 3 })] })
    const calls = [], errors = []
    const query = { select(){ return query }, eq(){ return query }, order: async () => ({ data: [protocol], error: null }) }
    const context = { URLSearchParams, ownerId: {current:null}, createClient: () => ({ auth: {getUser:async()=>({data:{user:{id:'synthetic-owner'}}})}, from(table){ assert.equal(table, 'protocols'); return query } }),
      window: {location:{search:'?compound=compound&'+key+'=999'},history:{replaceState(...v){calls.push(['replace',...v])}}},
      setLoading(){}, setProtocols(){}, onboardingEligible:()=>false, setFirstProtocol(){},
      setVialHandoffBlocked(v){calls.push(['blocked',v])},setDetailId(v){calls.push(['detail',v])},
      startEdit(){throw Error('Retired URL must not edit')},startNew(){throw Error('Retired URL must not create')},
      setError(e){errors.push(e)} }
    const execute = new Function('context', 'with(context){'+editorFunction('load')+';return load}')(context)
    await execute()
    assert.deepEqual(errors, [])
    assert.deepEqual(calls.filter(c => c[0] !== 'replace'), [['blocked',true],['detail','protocol']])
    assert.equal(protocol.compounds[0].vial_strength,10);assert.equal(protocol.compounds[0].doses_taken_override,3)
  }
})
test('field recovery opens the correct panel without touching any dosing field', () => {
  for (const [field, mode, expectedPanel] of [['Syringe scale','syringe',null],['Syringe scale','medication','0:administration'],['Injection volume (mL)','medication','0:administration'],['BAC water in mL','medication','0:vial'],['Preparation source','volume','0:vial'],['How do you measure it?','unknown',null]]) {
    const calls=[], compounds=Object.freeze([Object.freeze({input_mode:mode,dose:'2.00',syringe_scale:''})])
    const context={compounds,setReviewFallback(){},setOpenMoreOptions(v){calls.push(['more',v])},setOpenEditorPanel(v){calls.push(['panel',v])},setReviewFocus(v){calls.push(['focus',v])}}
    const execute=new Function('context','with(context){'+editorFunction('requestDosingReview')+';return requestDosingReview}')(context)
    execute(0,field)
    assert.equal(calls.find(c=>c[0]==='panel')?.[1]??null,expectedPanel)
    assert.deepEqual(calls.at(-1),['focus',{index:0,field}])
    assert.equal(compounds[0].dose,'2.00');assert.equal(compounds[0].syringe_scale,'')
  }
  assert.equal(isDosingReviewField('input[onclick]'),false)
})


test('missing preparation does not assume ready-to-use or mixing', () => {
  const saved = entryFromForm({ input_mode: 'volume', injection_volume: '.2', reviewed: true })
  assert.equal(dosingIssue(saved).code, 'missing-preparation')
  assert.equal(dosingIssue(saved).field, 'Preparation source')
  assert.equal(saved.preparation, undefined)
})

function focusEffect() {
  const ast = ts.createSourceFile('page.tsx', editor, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let found
  function visit(n) {
    if (ts.isCallExpression(n) && n.expression.getText(ast) === 'useEffect' && n.arguments[0]?.getText(ast).includes('if (!reviewFocus')) found = n.arguments[0].getText(ast)
    ts.forEachChild(n, visit)
  }
  visit(ast); assert.ok(found)
  return ts.transpileModule('const effect = ' + found, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
}
test('external labelled-only legacy recovery retains hydration and explains the visible fallback', async () => {
  const saved = Object.freeze({ ...entry({ input_mode:'volume', dose:'', injection_volume:'.2', vial_strength:'', vial_unit:'', bac_water_ml:'', concentration_value:'5', concentration_unit:'' }), preparation:undefined })
  const phase = Object.freeze({ id:'phase',start_week:1,end_week:null,frequency:'daily',dosing_entry:saved })
  const protocol = Object.freeze({id:'protocol',status:'active',start_date:'2026-01-01',compounds:[Object.freeze({id:'compound',name:'Synthetic',phases:[phase]})]})
  const before = JSON.stringify(protocol), calls = [], errors = [], location={search:'?compound=compound&review=Concentration%20unit'}
  const context={URLSearchParams,ownerId:{current:null},savedProtocolId:{current:null},handoffInitialized:{current:false},showForm:false,
    window:{location,scrollTo(){},history:{replaceState(){location.search=''}}}, router:{push(){throw Error('Unexpected navigation')}},
    onboardingEligible:()=>false,onboardingSeen:()=>true,markOnboardingSeen(){},
    setLoading(){},setProtocols(){},setFirstProtocol(){},setFromInventory(){},setDetailId(){},setRemovedCompoundIds(){},setEditingId(){},setChangeHappenedEarlier(){},setEffectiveDate(){},setPlanned(){},setStartDate(){},
    setOpenMoreOptions(){},setOpenEditorPanel(){},setContinuedFromId(){},setShowForm(){},
    setError(e){if(e)errors.push(e)},setCompounds(v){context.compounds=v},
    setReviewFallback(v){context.reviewFallback=v},setReviewFocus(v){context.reviewFocus=v},
    currentPhase:load('../lib/health/dosing.ts').currentPhase,entryFormState,isDosingReviewField,
    captureHistoricalCompound:load('../lib/protocols/form.ts').captureHistoricalCompound,
    newCompound:load('../lib/protocols/form.ts').newCompound,newPhaseCompoundDraft:load('../lib/protocols/form.ts').newPhaseCompoundDraft}
  const query={select(){return query},eq(){return query},order:async()=>({data:[protocol],error:null})}
  context.createClient=()=>({auth:{getUser:async()=>({data:{user:{id:'synthetic-owner'}}})},from(table){assert.equal(table,'protocols');return query}})
  for(const name of ['requestDosingReview','startEdit','load'])context[name]=new Function('context','with(context){'+editorFunction(name)+';return '+name+'}')(context)
  await context.load()
  assert.deepEqual(errors,[])
  assert.equal(context.compounds[0].isPreMixed,false,'Historical hydration is not silently changed')
  assert.equal(context.compounds[0].preparation,undefined)
  assert.equal(context.compounds[0].concentration_value,'5');assert.equal(context.compounds[0].concentration_unit,'')
  assert.deepEqual(context.reviewFocus,{index:0,field:'Concentration unit'})
  const preparation={focus(){calls.push('Preparation source')},scrollIntoView(){}}
  context.mode='edit';context.showForm=true;context.requestAnimationFrame=fn=>{fn();return 1};context.cancelAnimationFrame=()=>{}
  context.document={querySelector(){return {querySelectorAll(){return []},querySelector(selector){return selector==='[aria-label="Preparation source"]'?preparation:null}}}}
  new Function('context','with(context){'+focusEffect()+';return effect}')(context)()
  assert.deepEqual(calls,['Preparation source'])
  assert.deepEqual(context.reviewFallback,{index:0,field:'Concentration unit',nextField:'Preparation source'})
  assert.match(editor,/is not shown by the current/)
  assert.match(editor,/No preparation, measurement mode or saved value has been changed/)
  assert.equal(JSON.stringify(protocol),before)
  assert.equal(context.compounds[0].concentration_value,'5');assert.equal(context.compounds[0].isPreMixed,false)
})
test('invalid historical mode recovery focuses a measurement option without selecting it', () => {
  const calls=[],first={focus(){calls.push('focus first')},scrollIntoView(){}}
  const context={reviewFocus:{index:0,field:'How do you measure it?'},showForm:true,mode:'edit',
    requestAnimationFrame(fn){fn();return 1},cancelAnimationFrame(){},setReviewFocus(){},setReviewFallback(){throw Error('Measurement fallback is available')},
    document:{querySelector(){return {querySelector(selector){return selector==='.dosing-methods button'?first:null}}}}}
  new Function('context','with(context){'+focusEffect()+';return effect}')(context)()
  assert.deepEqual(calls,['focus first'])
})

