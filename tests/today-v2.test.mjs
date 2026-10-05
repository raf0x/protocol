import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { reactHarness } from './helpers/reactHarness.mjs'

const require = createRequire(import.meta.url), renderer = reactHarness(), cache = new Map()
function load(file) {
  const url = new URL(file, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const output = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'react') return { ...React, ...renderer.hooks }
    if (name === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) }
    // Snapshot tests need lifecycle placement; New Vial internals have dedicated browser coverage.
    if (name.endsWith('/VialInventory')) return { __esModule: true, default: () => React.createElement('div', { className: 'vial-inventory' }) }
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
    if (name.endsWith('/supabase')) return { createClient() { throw Error('No backend in presentation tests') } }
    if (!name.startsWith('.')) return require(name)
    return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url))
  }, output, output.exports)
  cache.set(url.href, output.exports)
  return output.exports
}
const Overview = load('../components/today/TodayOverview.tsx').default
const StatusStrip = load('../components/today/TodayStatusStrip.tsx').default
const Focus = load('../components/today/TodaysFocusCard.tsx').default
const Rings = load('../components/dashboard/CompoundRings.tsx').default
const Row = load('../components/protocols/ProtocolRow.tsx').default
const Checkin = load('../components/today/DailyCheckIn.tsx').default
const Health = load('../components/today/HealthTrendsCard.tsx').default
const Trend = load('../components/today/WeightTrendChart.tsx').default
const Recent = load('../components/today/RecentChangesCard.tsx').default
const Hero = load('../components/dashboard/HeroProtocolCard.tsx').default
const Snapshot = load('../components/today/SelectedProtocolSnapshot.tsx').default
const { CompactDisclosure } = load('../components/app/DesignSystem.tsx')
const { entryFromForm } = load('../lib/health/dosingEntry.ts')
const { ringColors } = load('../lib/protocols/rings.ts')
const date = '2026-10-04'
const phase = { id: 'phase', dose: 5, dose_unit: 'mg', dose_semantics_version: 1, frequency: 'daily', start_week: 1, end_week: null }
const protocol = { id: 'p', name: 'Plan', status: 'active', start_date: '2026-09-01', compounds: [{ id: 'a', name: 'Alpha compound', phases: [phase] }, { id: 'b', name: 'Beta compound', phases: [] }] }
const props = { date, protocols: [protocol], events: [], entries: [], due: [{ id: 'a', name: 'Alpha compound', dose: '5 mg', dose_unit: '', time_of_day: 'Morning' }], logs: {}, saving: false, error: null, selected: 'a', onSelect() {}, onTaken() {}, weightUnit: 'lbs', onToggleUnit() {}, detail: React.createElement('button', null, 'Inventory action'), schedule: React.createElement('button', null, 'CSV action'), checkin: React.createElement('button', null, 'Check-in action') }
function nodes(tree, match) { return Array.isArray(tree) ? tree.flatMap(n => nodes(n, match)) : tree && typeof tree === 'object' ? [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)] : [] }
function text(tree) { return Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : typeof tree === 'boolean' ? '' : String(tree ?? '') }
const render = (Component, values) => { renderer.reset(); return renderer.render(React.createElement(Component, values)) }
const markup = tree => renderToStaticMarkup(toElement(tree))
const toElement = (tree, key = 0) => Array.isArray(tree) ? tree.map(toElement) : tree && typeof tree === 'object' ? React.createElement(tree.type, { ...tree.props, key, children: toElement(tree.props.children) }) : tree

test('Today pairs Health left and Focus right below the greeting, then rings, snapshot, check-in and schedule', () => {
  const tree = render(Overview, { ...props,
    rings: React.createElement(Rings, { activeProtocols: [protocol], activeCompoundTab: 'a', setActiveCompoundTab() {} }),
    detail: React.createElement('section', { 'aria-labelledby': 'selected-protocol-name' }, React.createElement('h3', { id: 'selected-protocol-name' }, 'Selected protocol'), props.detail),
    checkin: React.createElement('section', { 'aria-labelledby': 'daily-checkin-title' }, props.checkin),
  }), sections = nodes(tree, n => n.type === 'section')
  assert.deepEqual(sections.map(n => n.props['aria-labelledby']), ['health-title', 'focus-title', 'active-title', 'selected-protocol-name', 'daily-checkin-title'])
  const html = markup(tree)
  const order = ['your day', 'Current weight', 'id="health-title"', 'id="focus-title"', 'id="active-title"', 'protocol-ring-composition', 'id="selected-protocol-name"', 'Check-in action', 'CSV action'].map(label => html.indexOf(label))
  assert.ok(order.every((position, index) => position >= 0 && (!index || position > order[index - 1])))
  const hero = sections[2]
  const header = nodes(tree, n => n.type === 'header')[0]
  assert.equal(nodes(header, n => n.type === 'button' && n.props['aria-label']?.startsWith('Current weight')).length, 1)
  assert.equal(nodes(header, n => n.props['aria-labelledby'] === 'focus-title').length, 0)
  assert.equal(nodes(header, n => n.props.className === 'welcomeRow').length, 1)
  assert.equal(nodes(tree, n => n.props['aria-labelledby'] === 'focus-title').length, 1)
  const summary = nodes(tree, n => n.props.className === 'dailySummary')[0]
  assert.deepEqual(nodes(summary, n => n.type === 'section').map(n => n.props['aria-labelledby']), ['health-title', 'focus-title'])
  assert.equal(nodes(tree, n => n.props['aria-labelledby'] === 'health-title').length, 1)
  const focus = sections[1]
  assert.match(text(focus), /1 active protocol/)
  assert.equal(nodes(focus, n => n.type === 'a' && n.props.href === '/protocol/manage' && n.props['aria-label'] === 'Manage 1 active protocol').length, 1)
  assert.equal(nodes(focus, n => n.props.className === 'doseIcon').length, 1)
  assert.equal(nodes(focus, n => n.props.className === 'doseEyebrow' && text(n) === 'Next dose').length, 1)
  assert.equal(nodes(hero, n => n.type === 'ul').length, 0)
  const ringsContainer = nodes(hero, n => n.props.className === 'rings')[0]
  const snapshotContainer = nodes(hero, n => n.props.className === 'selectedSnapshot')[0]
  const contents = hero.props.children[1].props.children
  assert.equal(contents[0], ringsContainer); assert.equal(contents[1], snapshotContainer)
  assert.doesNotMatch(html, /StatsBoxes|statusStrip|WEIGHT CHANGE|Better Protocols|A Healthier You|A clearer picture|Rafael|\+\d+ more|Recent changes|Selected protocol tools|All doses today/)
  assert.equal(nodes(tree, n => n.type === 'button' && n.props.className?.includes('primaryAction')).length, 1)
})

test('rings select by compound ID, retain colors and management links, and have one fallback selection', () => {
  renderer.reset(); let selected = 'a'
  const onSelect = id => { selected = id }
  const draw = () => renderer.render(React.createElement(Overview, { ...props, selected, onSelect, rings: React.createElement(Rings, { activeProtocols: [protocol], activeCompoundTab: selected, setActiveCompoundTab: onSelect }) }))
  let tree = draw()
  const ring = nodes(tree, n => n.type === 'button' && n.props.className === 'protocol-ring protocol-ring-named')[1]
  ring.props.onClick(); tree = draw()
  assert.equal(selected, 'b')
  const selectedRings = nodes(tree, n => n.type === 'button' && n.props.className === 'protocol-ring protocol-ring-named' && n.props['aria-pressed'])
  assert.equal(selectedRings.length, 1); assert.match(selectedRings[0].props['aria-label'], /^Beta/)
  nodes(tree, n => n.type === 'button' && n.props.className === 'protocol-ring protocol-ring-named')[0].props.onClick()
  tree = draw(); assert.equal(selected, 'a')
  assert.equal(nodes(tree, n => n.type === 'a' && n.props.href === '/protocol/manage').length, 2)
  assert.equal(nodes(tree, n => n.type === 'a' && n.props['aria-label'] === 'Manage 1 active protocol').length, 1)
  assert.equal(nodes(tree, n => n.type === 'a' && n.props.href === '/protocol/manage?new=1').length, 1)
  assert.equal(nodes(tree, n => n.type === 'button' && n.props['aria-label']?.endsWith('. Select protocol')).length, 2)
  assert.ok(nodes(tree, n => n.type === 'button' && n.props['aria-label']?.endsWith('. Select protocol')).every(n => !n.props.href && n.props.type === 'button'))
  const rings = nodes(tree, n => n.type === 'button' && n.props.className === 'protocol-ring protocol-ring-named')
  assert.equal(nodes(tree, n => n.type === 'li' && n.props.className === 'protocolRow').length, 0)
  assert.deepEqual(rings.map(n => n.props.style['--ring-color']), ringColors.slice(0, 2))
  assert.ok(nodes(tree, n => n.type === 'details').every(n => n.props.open === undefined))
  selected = 'removed-compound'; tree = draw()
  assert.equal(nodes(tree, n => n.type === 'button' && n.props['aria-pressed'] && n.props.className === 'protocol-ring protocol-ring-named').length, 1)
  assert.match(nodes(tree, n => n.type === 'button' && n.props['aria-pressed'] && n.props.className === 'protocol-ring protocol-ring-named')[0].props['aria-label'], /^Alpha compound,/)
})

test('CSV uses its existing callback in the hero header and warning follows the paired cards', () => {
  let exports = 0
  const onExportCSV = () => exports++
  const warning = React.createElement('div', { className: 'warningNotice' }, 'You may have missed a dose today')
  const tree = render(Overview, { ...props, onExportCSV, warning })
  const hero = nodes(tree, n => n.props['aria-labelledby'] === 'active-title')[0]
  const actions = nodes(hero, n => n.props.className === 'heroActions')[0]
  const csv = nodes(actions, n => n.type === 'button' && text(n) === '↓ Export CSV')[0]
  assert.equal(nodes(tree, n => n.type === 'button' && text(n) === '↓ Export CSV').length, 1)
  assert.equal(csv.props.type, 'button'); assert.equal(csv.props.onClick, onExportCSV)
  csv.props.onClick(); assert.equal(exports, 1)
  const manage = nodes(hero, n => n.props.className?.includes('heroManage'))[0]
  assert.equal(manage.type, 'a'); assert.equal(manage.props.href, '/protocol/manage')
  assert.equal(nodes(actions, n => n.type === 'a').length, 0)
  assert.equal(nodes(hero, n => n.props.className === 'heroHeader')[0].props.children[1], manage)
  const html = markup(tree)
  assert.ok(html.indexOf('id="focus-title"') < html.indexOf('You may have missed a dose today'))
  assert.ok(html.indexOf('You may have missed a dose today') < html.indexOf('id="active-title"'))
  assert.equal(nodes(tree, n => n.props.className === 'warningNotice').length, 1)
  assert.equal(nodes(tree, n => n.props['aria-labelledby'] === 'focus-title').length, 1)
  const withoutProtocols = render(Overview, { ...props, protocols: [], onExportCSV })
  assert.equal(nodes(withoutProtocols, n => n.type === 'button' && text(n) === '↓ Export CSV').length, 0)
  const withoutCompounds = render(Overview, { ...props, protocols: [{ ...protocol, compounds: [] }], onExportCSV })
  assert.equal(nodes(withoutCompounds, n => n.type === 'button' && text(n) === '↓ Export CSV').length, 1)
})

test('rows retain precise medication amounts, frequency and real phase status', () => {
  const tree = render(Row, { id: 'a', name: 'Alpha', protocolId: 'p', week: 3, phase: { ...phase, dose: 5.25 }, color: ringColors[0], selected: true, onSelect() {} })
  assert.match(text(tree), /5.3 mg · dailyActive · Week 3/)
  assert.doesNotMatch(text(tree), /syringe|units|unknown/)
})

test('unknown and legacy syringe doses never become medication amounts', () => {
  for (const p of [null, { ...phase, dose_semantics_version: null, dose: 50, dose_unit: 'IU' }, { ...phase, dosing_entry: entryFromForm({ input_mode: 'syringe', syringe_markings: '20', syringe_scale: '100' }) }]) {
    const tree = render(Row, { id: 'a', name: 'Alpha', protocolId: 'p', week: 3, phase: p, color: ringColors[0], selected: false, onSelect() {} })
    assert.match(text(tree), /Medication amount unknown/)
    assert.doesNotMatch(text(tree), /50 IU|20 units|0.2 mL/)
    if (!p) assert.match(text(tree), /No current phase/)
  }
})

test('a conflicting or malformed dose shows one honest review issue', () => {
  const conflict = entryFromForm({ input_mode: 'syringe', syringe_markings: '20', syringe_scale: '100', injection_volume: '.5' })
  for (const entry of [conflict, { version: 2 }]) {
    const tree = render(Row, { id: 'a', name: 'Alpha', protocolId: 'p', week: 3, phase: { ...phase, dosing_entry: entry }, color: ringColors[0], selected: true, onSelect() {} })
    const issues = nodes(tree, n => n.type === 'span' && n.props.className?.includes('warning'))
    assert.equal(issues.length, 1); assert.match(text(issues[0]), /need review/)
    assert.doesNotMatch(text(issues[0]), /Active ·|Week 3/)
  }
})

test('native tools keep callbacks and the restored schedule is directly visible', () => {
  let count = 0
  const tree = render(CompactDisclosure, { title: 'Tools', children: React.createElement('button', { onClick: () => count++ }, 'Saved action') })
  assert.equal(tree.type, 'details'); assert.equal(tree.props.open, undefined)
  assert.equal(nodes(tree, n => n.type === 'summary').length, 1)
  nodes(tree, n => n.type === 'button')[0].props.onClick(); assert.equal(count, 1)
  const overview = render(Overview, props)
  assert.equal(nodes(overview, n => n.type === 'summary').length, 0)
  for (const action of ['Inventory action', 'CSV action', 'Check-in action']) assert.equal(nodes(overview, n => n.type === 'button' && text(n) === action).length, 1)
  assert.equal(nodes(overview, n => n.type === 'details').length, 0)
})

const today = new Date().toLocaleDateString('en-CA')
const snapshotProtocol = (compound = {}, extraPhase = {}) => ({ ...protocol, start_date: today, compounds: [{ id: 'a', name: 'Alpha compound', ...compound, phases: [{ ...phase, ...extraPhase }] }] })
const snapshotProps = p => ({ activeProtocols: [p], activeCompoundTab: 'a', logs: {}, allLogs: [], totalLost: null, compoundIndex: 0, snapshot: true })
function facts(tree) {
  const list = nodes(tree, n => n.type === 'dl' && n.props.className === 'today-snapshot-facts')[0]
  return Object.fromEntries(nodes(list, n => n.props.className === 'today-snapshot-fact').map(n => [text(nodes(n, child => child.type === 'dt')[0]), text(nodes(n, child => child.type === 'dd')[0])]))
}

test('selected snapshot exposes all nine facts and vial with existing values and precision', () => {
  const p = snapshotProtocol({ reconstitution_date: today, vial_strength: 20, vial_unit: 'mg', bac_water_ml: 2, vials_in_stock: 3, doses_taken_override: 1 }, { dose: 5.25, injection_volume_ml: 0.168637, syringe_units: 6.74548, syringe_scale: 40 })
  const tree = render(Hero, { ...snapshotProps(p), allLogs: [{ compound_id: 'a', date: today, taken: true }] })
  const actual = facts(tree)
  assert.deepEqual(Object.keys(actual), ['Protocol start', 'Current week', 'Vial reconstituted', 'Vial expiration', 'Injection volume', 'Syringe draw', 'Vials in stock', 'Doses taken (vial)', 'Next dose'])
  assert.equal(actual['Current week'], 'Week 1')
  assert.notEqual(actual['Protocol start'], 'Not recorded'); assert.notEqual(actual['Vial reconstituted'], 'Not recorded'); assert.notEqual(actual['Vial expiration'], 'Not recorded')
  assert.equal(actual['Injection volume'], '0.17 mL'); assert.equal(actual['Syringe draw'], '6.7 U-40 units')
  assert.equal(actual['Vials in stock'], '3'); assert.equal(actual['Doses taken (vial)'], '1'); assert.equal(actual['Next dose'], 'Tomorrow')
  assert.match(text(tree), /ACTIVE COMPOUNDAlpha compoundPlanWeek 1Started /)
  assert.match(text(tree), /5.3 mg\/dosedaily/)
  const snapshot = nodes(tree, n => n.props.className === 'today-protocol-snapshot')[0]
  assert.equal(snapshot.props.style['--compound-color'], '#39ff14')
  assert.equal(nodes(tree, n => n.type === 'strong' && n.props['data-known'] === true).length, 1)
  assert.equal(nodes(tree, n => n.type === 'div' && n.props.className === 'today-snapshot-vial').length, 1)
  assert.ok(nodes(tree, n => n.type === 'svg').length)
  assert.equal(nodes(tree, n => n.props.className === 'today-snapshot-lifecycle').length, 1)
  assert.equal(nodes(tree, n => n.props.className === 'vial-inventory').length, 1)
  assert.equal(nodes(tree, n => n.type === 'a' && n.props.href === '/protocol/manage?protocol=p').length, 1)
  assert.equal(nodes(tree, n => n.type === 'a' && n.props.href === '/protocol/inventory').length, 1)
  assert.doesNotMatch(text(tree), /0.168637|6.74548|Selected protocol tools/)
})

test('snapshot keeps missing facts distinct from zero and never converts legacy markings to medication', () => {
  const p = snapshotProtocol({}, { dose: 50, dose_unit: 'IU', dose_semantics_version: null, syringe_units: 16.8637 })
  const tree = render(Hero, snapshotProps(p)), actual = facts(tree)
  assert.equal(nodes(tree, n => n.props.className === 'today-snapshot-lifecycle').length, 0)
  for (const key of ['Vial reconstituted', 'Vial expiration', 'Injection volume', 'Vials in stock', 'Doses taken (vial)', 'Next dose']) assert.equal(actual[key], 'Not recorded')
  assert.equal(actual['Syringe draw'], '16.9 syringe units')
  assert.match(text(tree), /Medication amount unknown/); assert.doesNotMatch(text(tree), /50 IU|unknown\/dose/)
  assert.equal(nodes(tree, n => n.type === 'strong' && n.props['data-known'] === false).length, 1)
  const zero = facts(render(Hero, snapshotProps(snapshotProtocol({ vials_in_stock: 0, doses_taken_override: 0 }))))
  assert.equal(zero['Vials in stock'], '0'); assert.equal(zero['Doses taken (vial)'], '0')
})

test('snapshot places the supplied lifecycle after Next dose once and preserves its action', () => {
  let opens = 0
  const tree = render(Snapshot, { name: 'Sample', protocolName: 'Plan', medication: '5 mg', medicationKnown: true, week: 1, started: 'Oct 4', color: '#6c63ff', visual: null,
    facts: [{ label: 'Vials in stock', value: 0 }, { label: 'Next dose', value: 'Due today' }],
    lifecycle: React.createElement('button', { onClick: () => opens++ }, '+ New Vial'),
    actions: React.createElement('a', { href: '/protocol/inventory' }, 'Inventory'),
  })
  const list = nodes(tree, n => n.props.className === 'today-snapshot-facts')[0]
  assert.deepEqual(nodes(list, n => n.type === 'dt').map(text), ['Vials in stock', 'Next dose', 'Vial lifecycle'])
  assert.deepEqual(facts(tree), { 'Vials in stock': '0', 'Next dose': 'Due today' })
  const lifecycle = nodes(list, n => n.props.className === 'today-snapshot-lifecycle')[0]
  const button = nodes(lifecycle, n => n.type === 'button')[0]
  assert.equal(nodes(tree, n => n.type === 'button').length, 1)
  button.props.onClick(); assert.equal(opens, 1)
  assert.equal(nodes(tree, n => n.type === 'a' && n.props.href === '/protocol/inventory').length, 1)
})

test('ring selection updates the directly connected snapshot as well as pressed state', () => {
  renderer.reset(); let selected = 'a'
  const p = snapshotProtocol(); p.compounds.push({ id: 'b', name: 'Beta compound', phases: [{ ...phase, dose: 2 }] })
  const onSelect = id => { selected = id }
  const draw = () => renderer.render(React.createElement(Overview, { ...props, protocols: [p], date: today, selected, onSelect,
    rings: React.createElement(Rings, { activeProtocols: [p], activeCompoundTab: selected, setActiveCompoundTab: onSelect }),
    detail: React.createElement(Hero, { ...snapshotProps(p), activeCompoundTab: selected }),
  }))
  let tree = draw()
  nodes(tree, n => n.type === 'button' && n.props.className === 'protocol-ring protocol-ring-named')[1].props.onClick()
  tree = draw(); assert.equal(text(nodes(tree, n => n.props.id === 'selected-protocol-name')[0]), 'Beta compound')
  assert.equal(text(nodes(tree, n => n.props.className === 'today-snapshot-medication')[0]), '2 mg/dosedaily')
  assert.match(nodes(tree, n => n.type === 'button' && n.props.className === 'protocol-ring protocol-ring-named' && n.props['aria-pressed'])[0].props['aria-label'], /^Beta/)
  nodes(tree, n => n.type === 'button' && n.props.className === 'protocol-ring protocol-ring-named')[0].props.onClick()
  tree = draw(); assert.equal(text(nodes(tree, n => n.props.id === 'selected-protocol-name')[0]), 'Alpha compound')
})

test('snapshot completion still opens the existing confirmation before any mutation', () => {
  renderer.reset()
  const p = snapshotProtocol({ reconstitution_date: today, bac_water_ml: 1, doses_taken_override: 2 }, { injection_volume_ml: 0.5 })
  const draw = () => renderer.render(React.createElement(Hero, snapshotProps(p)))
  let tree = draw()
  const complete = nodes(tree, n => n.type === 'button' && text(n) === 'Complete')[0]
  assert.ok(complete); complete.props.onClick()
  tree = draw(); assert.match(text(tree), /Mark as Complete\?/)
  const cancel = nodes(tree, n => n.type === 'button' && text(n) === 'Cancel')[0]
  assert.ok(cancel); cancel.props.onClick()
  assert.doesNotMatch(text(draw()), /Mark as Complete\?/)
})

test('check-in scores, inputs, notes and save still call their supplied handlers', () => {
  const calls = []
  const tree = render(Checkin, { today: date, entries: [], mood: null, energy: null, hunger: null, sleep: '', weight: '', notes: '', weightUnit: 'lbs', saving: false, saved: false, scoreError: {}, onScoreTap: (...args) => calls.push(args), onSleepChange: v => calls.push(['sleep', v]), onWeightChange: v => calls.push(['weight', v]), onNotesChange: v => calls.push(['notes', v]), onSave: () => calls.push(['save']) })
  nodes(tree, n => n.props?.['aria-label'] === 'Mood 4 of 5')[0].props.onClick()
  const inputs = nodes(tree, n => n.type === 'input')
  inputs[0].props.onChange({ target: { value: '7.5' } }); inputs[1].props.onChange({ target: { value: '180' } })
  nodes(tree, n => n.type === 'textarea')[0].props.onChange({ target: { value: 'Note' } })
  nodes(tree, n => n.type === 'button' && text(n) === 'Save')[0].props.onClick()
  assert.deepEqual(calls, [['mood', 4], ['sleep', '7.5'], ['weight', '180'], ['notes', 'Note'], ['save']])
})

test('check-in completion dismisses only after acknowledged save; failed writes retain inputs and error', async () => {
  renderer.reset();let completions=0,resolveSave
  const values={today:date,entries:[],mood:3,energy:4,hunger:2,sleep:'7',weight:'171',notes:'Keep this note',weightUnit:'lbs',saving:false,saved:true,scoreError:{},onScoreTap(){},onSleepChange(){},onWeightChange(){},onNotesChange(){},onSaved:()=>completions++,onSave:()=>new Promise(resolve=>{resolveSave=resolve})}
  const draw=()=>renderer.render(React.createElement(Checkin,values))
  const update=()=>nodes(draw(),n=>n.type==='button'&&text(n)==='Update')[0].props.onClick()
  let pending=update();assert.equal(completions,0);resolveSave(false);await pending
  let tree=draw();assert.equal(completions,0);assert.match(text(nodes(tree,n=>n.props.role==='alert')[0]),/wasn’t saved/)
  assert.equal(nodes(tree,n=>n.type==='textarea')[0].props.value,'Keep this note')
  assert.equal(nodes(tree,n=>n.type==='input')[1].props.value,'171')
  values.onSave=async()=>{throw Error('Disconnected')};await update();assert.equal(completions,0);assert.equal(nodes(draw(),n=>n.props.role==='alert').length,1)
  values.onSave=async()=>true;await update();tree=draw();assert.equal(completions,1);assert.equal(nodes(tree,n=>n.props.role==='alert').length,0)
})

test('health values keep their own dates, signed difference and zero sleep; missing is not zero', () => {
  const entry = { id: 'j', date, weight: 182, mood: null, energy: 3, sleep: 0 }
  const tree = render(Health, { entries: [entry, { ...entry, id: 'old', date: '2026-09-01', weight: 180, mood: 4 }], unit: 'lbs', onToggleUnit() {} })
  assert.match(text(tree), /Latest weight \| Oct 4/); assert.match(text(tree), /\+2 lbs since Sep 1/)
  assert.match(tree.props.className, /today-card/)
  assert.equal(nodes(tree, n => n.props.className === 'today-health-metrics')[0].props.children.length, 3)
  const weightRow = nodes(tree, n => n.props.className?.includes('healthWeightRow'))[0]
  const row = weightRow.props.children.filter(n => n && typeof n === 'object')
  assert.deepEqual(row.map(n => n.props.className), ['healthWeight', 'today-secondary healthChange', 'today-secondary healthLatest', 'healthBars'])
  assert.equal(text(row[0]), '182 lbs'); assert.equal(text(row[1]), '+2 lbs since Sep 1'); assert.equal(text(row[2]), 'Latest weight | Oct 4')
  const bars = nodes(row[3], n => n.type === 'svg')[0]
  assert.equal(bars.props.width, 32); assert.equal(bars.props['aria-hidden'], 'true')
  assert.equal(nodes(bars, n => n.type === 'path')[0].props.d, 'M4 20v-7m5 7V8m6 12V4m5 16v-9')
  assert.equal(nodes(tree, n => n.type === 'polyline').length, 0)
  assert.equal(nodes(tree, n => n.type === 'button' && n.props.className === 'today-unit').length, 1)
  assert.match(text(tree), /Sleep0 hOct 4/); assert.match(text(tree), /Mood4 \/5Sep 1/)
  assert.ok(nodes(tree, n => n.type === 'time').every(n => [date, '2026-09-01'].includes(n.props.dateTime)))
  const empty = render(Health, { entries: [], unit: 'lbs', onToggleUnit() {} })
  assert.match(text(empty), /Add a weight entry to start seeing your progress over time/)
  assert.match(text(empty), /EnergyNot loggedNot loggedSleepNot loggedNot loggedMoodNot loggedNot logged/)
  assert.doesNotMatch(text(empty), /0 h|0 \/5|NaN|undefined|readiness|adherence/i)
})

test('weight sparkline uses actual weights and elapsed dates without mutating records', () => {
  const entries = Object.freeze([
    Object.freeze({ id: 'last', date: '2026-10-11', weight: 171 }),
    Object.freeze({ id: 'first', date: '2026-10-01', weight: 182 }),
    Object.freeze({ id: 'middle', date: '2026-10-02', weight: 180 }),
  ])
  const tree = render(Trend, { entries, unit: 'lbs' })
  const circles = nodes(tree, n => n.type === 'circle')
  assert.equal(circles.length, 3)
  assert.equal(circles[0].props.cx, 4); assert.equal(circles[2].props.cx, 96)
  assert.ok(Math.abs(circles[1].props.cx - 13.2) < 1e-10)
  assert.deepEqual(circles.map(n => text(n)), ['2026-10-01: 182 lbs', '2026-10-02: 180 lbs', '2026-10-11: 171 lbs'])
  assert.equal(circles[0].props.cy, 4); assert.equal(circles[2].props.cy, 44)
  assert.ok(Math.abs(circles[1].props.cy - (44 - 9 / 11 * 40)) < 1e-10)
  assert.equal(nodes(tree, n => n.type === 'polyline')[0].props.points, circles.map(n => `${n.props.cx},${n.props.cy}`).join(' '))
  assert.deepEqual(entries.map(n => n.id), ['last', 'first', 'middle'])
  assert.equal(nodes(tree, n => n.type === 'figcaption' || n.type === 'path' || n.type === 'span').length, 0)
  assert.match(nodes(tree, n => n.type === 'svg')[0].props['aria-label'], /Recorded range 171–182 lbs/)
})

test('weight sparkline converts labels through the shared formatter and retains the recorded shape', () => {
  const entries = [{ id: 'a', date: '2026-09-01', weight: 198 }, { id: 'b', date, weight: 183 }]
  const tree = render(Trend, { entries, unit: 'kg' })
  assert.match(nodes(tree, n => n.type === 'svg')[0].props['aria-label'], /89\.8 to 83\.0 kg\. Recorded range 83\.0–89\.8 kg/)
  assert.deepEqual(nodes(tree, n => n.type === 'circle').map(n => text(n)), ['2026-09-01: 89.8 kg', `${date}: 83.0 kg`])
  assert.equal(nodes(tree, n => n.type === 'polyline')[0].props.points, '4,4 96,44')
})

test('weight sparkline filters invalid observations, keeps flat histories flat and never invents a trend', () => {
  const first = { id: 'a', date: '2026-09-01', weight: 180 }, last = { id: 'b', date, weight: 180 }
  const invalid = [null, NaN, Infinity, 0, -1].map((weight, i) => ({ id: `bad-${i}`, date, weight }))
  invalid.push({ id: 'bad-date', date: 'not-a-date', weight: 180 }, { id: 'rollover', date: '2026-02-30', weight: 182 })
  const flat = render(Trend, { entries: [last, ...invalid, first], unit: 'lbs' })
  assert.equal(nodes(flat, n => n.type === 'polyline')[0].props.points, '4,24 96,24')
  assert.match(nodes(flat, n => n.type === 'svg')[0].props['aria-label'], /2 recorded weights.*Recorded range 180 lbs/)
  for (const entries of [[], invalid, [first], [first, { ...first, id: 'same-day', weight: 182 }]]) {
    const tree = render(Trend, { entries, unit: 'lbs' })
    assert.match(text(tree), /Add another weight entry for a trend/)
    assert.equal(tree.props.className, 'visuallyHidden')
    assert.equal(nodes(tree, n => n.type === 'svg').length, 0)
    assert.doesNotMatch(text(tree), /NaN|undefined|0 lbs/)
  }
})

test('header weight and Health Trends retain recorded weight, signed change, start date and unit actions', () => {
  const entry = { id: 'j', date, weight: 183 }, first = { id: 'old', date: '2026-04-04', weight: 198 }
  let toggles = 0
  const values = { entries: [entry, first], unit: 'lbs', onToggleUnit: () => toggles++ }
  const tree = render(StatusStrip, values), cards = nodes(tree, n => n.type === 'button')
  assert.equal(cards.length, 1)
  assert.equal(text(nodes(tree, n => n.props.className === 'statusNumber')[0]), '183lbs')
  assert.match(text(cards[0]), /Current weight183lbstap to switch to kg/)
  const health = render(Health, values)
  assert.match(text(health), /-15 lbs since Apr 4/)
  assert.equal(nodes(nodes(health, n => n.props.className?.includes('healthChange'))[0], n => n.type === 'time')[0].props.dateTime, first.date)
  assert.equal(nodes(nodes(health, n => n.props.className?.includes('healthLatest'))[0], n => n.type === 'time')[0].props.dateTime, entry.date)
  cards[0].props.onClick(); nodes(health, n => n.type === 'button' && n.props.className === 'today-unit')[0].props.onClick(); assert.equal(toggles, 2)
  const converted = render(StatusStrip, { ...values, unit: 'kg' })
  assert.equal(text(nodes(converted, n => n.props.className === 'statusNumber')[0]), '83.0kg')
  assert.match(text(converted), /tap to switch to lbs/)
  assert.match(converted.props['aria-label'], /Switch to lbs/)
  assert.match(text(render(Health, { ...values, unit: 'kg' })), /-6\.8 kg since Apr 4/)
  for (const [weight, sign] of [[200, '+2'], [198, '0']]) {
    const change = render(Health, { ...values, entries: [{ ...entry, weight }, first] })
    assert.match(text(change), new RegExp(`${sign.replace('+', '\\+')} lbs since Apr 4`))
  }
})

test('header weight and Health Trends never fabricate values or changes from missing or single entries', () => {
  for (const entries of [[], [{ id: 'one', date, weight: 183 }], [{ id: 'missing', date, weight: null }]]) {
    const tree = render(StatusStrip, { entries, unit: 'lbs', onToggleUnit() {} }), cards = nodes(tree, n => n.type === 'button')
    assert.equal(cards.length, 1)
    assert.equal(text(nodes(tree, n => n.props.className === 'statusNumber')[0]), entries[0]?.weight ? '183lbs' : '—lbs')
    if (!entries[0]?.weight) assert.match(text(cards[0]), /Not logged$/)
    const health = render(Health, { entries, unit: 'lbs', onToggleUnit() {} })
    assert.doesNotMatch(text(health), /since |NaN|undefined|0 lbs/)
    assert.equal(nodes(tree, n => n.type === 'time').length, 0)
    assert.doesNotMatch(text(tree), /NaN|undefined|0lbs|since /)
  }
})

test('compact Focus separates confirmed medication from secondary review and keeps logging callback', () => {
  const conflict = entryFromForm({ input_mode: 'medication', dose: '5', dose_unit: 'mg', injection_volume: '.5', preparation: 'ready', concentration_value: '20', concentration_unit: 'mg/mL', reviewed: true })
  const unverified = entryFromForm({ input_mode: 'medication', dose: '5', dose_unit: 'mg' })
  for (const candidate of [phase, { ...phase, dose: 1, dose_unit: 'IU', dose_semantics_version: null }, { ...phase, dosing_entry: conflict }, { ...phase, dosing_entry: unverified }, { ...phase, dosing_entry: { version: 2 } }]) {
    const p = { ...protocol, compounds: [{ id: 'a', name: 'Alpha compound', phases: [candidate] }] }, calls = []
    const tree = render(Focus, { ...props, activeCount: 1, protocols: [p], onTaken: id => calls.push(id) })
    const amount = nodes(tree, n => n.props.className === 'doseAmount')[0]
    assert.doesNotMatch(text(amount), /Unverified|semantics|Medication dose not calculated|syringe/)
    assert.match(text(amount), candidate === phase || [conflict, unverified].includes(candidate.dosing_entry) ? /^5 mg$/ : /^Medication amount unknown$/)
    const review = nodes(tree, n => n.props.className === 'focusReview')
    assert.equal(review.length, candidate === phase ? 0 : 1)
    if (review.length) assert.match(text(review[0]), /need review/)
    assert.equal(nodes(tree, n => n.type === 'p' && n.props['aria-live'] === 'polite')[0].props.className, 'visuallyHidden')
    nodes(tree, n => n.type === 'button' && text(n) === 'Mark taken')[0].props.onClick()
    assert.deepEqual(calls, ['a'])
  }
})

test('recent changes use at most three supplied normalized events without reinterpreting them', () => {
  const tree = render(Recent, { events: Array.from({ length: 4 }, (_, i) => ({ id: String(i), title: `Event ${i}`, description: 'Recorded change', date: '2026-10-0' + (4 - i) })) })
  assert.equal(nodes(tree, n => n.type === 'li').length, 3)
  assert.match(text(tree), /Event 0/); assert.doesNotMatch(text(tree), /Event 3/)
})

test('Today V2 tokens meet normal-text contrast in dark and light surfaces', () => {
  const luminance = hex => { const rgb = hex.match(/\w\w/g).map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 }
  const ratio = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05) }
  for (const [surfaces, texts, accent, onAccent] of [
    [['0b0f14', '141a22', '1b2430'], ['f4f7fb', 'b6c1d2', '929fb3', 'a99aff', '67e4a1', 'f3c773', 'ff999f'], 'a99aff', '0b0f14'],
    [['f4f6fa', 'ffffff', 'eef1f7'], ['172132', '4d5d73', '5b6b80', '6551bf', '187546', '855e12', 'b32e3c'], '6551bf', 'ffffff'],
  ]) {
    for (const background of surfaces) for (const foreground of texts) assert.ok(ratio(background, foreground) >= 4.5, `${foreground} on ${background}`)
    assert.ok(ratio(accent, onAccent) >= 4.5)
  }
})
