import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const cache = new Map()
function moduleUrl(file) {
  if (cache.has(file)) return cache.get(file)
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  let code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 } }).outputText
  for (const match of code.matchAll(/from ['"](\.\/[^'"]+)['"]/g)) {
    const dependency = new URL(match[1] + '.ts', new URL(file, import.meta.url))
    code = code.replaceAll("'" + match[1] + "'", JSON.stringify(moduleUrl(dependency.href)))
  }
  const url = 'data:text/javascript;base64,' + Buffer.from(code).toString('base64')
  cache.set(file, url)
  return url
}
const { todayProtocols, nextTodayDose, recentChanges, journalSnapshot } = await import(moduleUrl('../lib/health/today.ts'))
const { activeTab } = await import(moduleUrl('../lib/tabs.ts'))
const phase = { id: 'phase', dose: 2, dose_unit: 'mg', dose_semantics_version: 1, frequency: 'daily', start_week: 1, end_week: null }
const protocol = { id: 'p', name: 'Plan', status: 'active', start_date: '2026-08-01', compounds: [{ id: 'c', name: 'Test compound', phases: [phase] }] }

test('active rows reuse normalized dosing and strict phase selection', () => {
  const [row] = todayProtocols([protocol], '2026-09-09')
  assert.equal(row.details, '2 mg · daily')
  assert.equal(row.week, 6)
  const [expired] = todayProtocols([{ ...protocol, compounds: [{ ...protocol.compounds[0], phases: [{ ...phase, end_week: 4 }] }] }], '2026-09-09')
  assert.equal(expired.hasPhase, false)
  assert.equal(expired.details, 'Dose not fully calculated')
})
test('legacy amounts are not interpreted as confirmed medication', () => {
  const [row] = todayProtocols([{ ...protocol, compounds: [{ ...protocol.compounds[0], phases: [{ ...phase, dose_semantics_version: null, dose: 50, dose_unit: 'IU' }] }] }], '2026-09-09')
  assert.equal(row.details, 'Dose not fully calculated')
})
test('next dose excludes logged doses, respects saved time groups and never mutates source', () => {
  const due = [{ id: 'b', time_of_day: 'night' }, { id: 'a', time_of_day: 'morning' }, { id: 'c', time_of_day: '' }]
  assert.equal(nextTodayDose(due, {}).id, 'a')
  assert.equal(nextTodayDose(due, { a: { taken: true } }).id, 'b')
  assert.equal(nextTodayDose(due, Object.fromEntries(due.map(d => [d.id, { taken: true }]))), null)
  assert.deepEqual(due.map(d => d.id), ['b', 'a', 'c'])
})
test('empty account has no fabricated protocols, events, metrics or due doses', () => {
  assert.deepEqual(todayProtocols([], '2026-09-09'), [])
  assert.deepEqual(recentChanges([], []), [])
  assert.equal(nextTodayDose([], {}), null)
  assert.equal(journalSnapshot([]).latest, null)
  assert.equal(journalSnapshot([]).change, null)
})
test('journal summary uses real dated observations, keeps zero sleep, and does not claim a change from one weight', () => {
  const entry = { id: 'j', date: '2026-09-09', weight: 150, energy: null, mood: 4, sleep: 0 }
  assert.equal(journalSnapshot([entry]).change, null)
  const data = journalSnapshot([entry, { ...entry, id: 'old', date: '2026-09-01', weight: 153, energy: 3 }])
  assert.equal(data.change, -3)
  assert.equal(data.sleep.sleep, 0)
  assert.equal(data.energy.date, '2026-09-01')
})
test('recent changes reuse timeline normalization, ordering and source identity', () => {
  const event = { id: 'e', protocol_id: 'p', compound_id: 'c', event_type: 'started', description: 'Started Test compound', date: '2026-09-08', protocols: null, compounds: null }
  const items = recentChanges([event, event, { ...event, id: 'second', date: '2026-09-09', event_type: 'dose_change' }], [protocol])
  assert.equal(items.length, 2)
  assert.equal(items[1].title, 'Test compound started')
  assert.equal(items[0].date, '2026-09-09')
})
test('all five navigation destinations have distinct active states', () => {
  assert.equal(activeTab('/protocol'), 'Today')
  assert.equal(activeTab('/protocol/manage'), 'Protocols')
  assert.equal(activeTab('/timeline'), 'Timeline')
  assert.equal(activeTab('/journal'), 'Health')
  assert.equal(activeTab('/calculator'), 'More')
  assert.equal(activeTab('/profile'), 'More')
})
test('Today keeps existing log conflict key and only reports success after the write', () => {
  const source = readFileSync(new URL('../app/protocol/page.tsx', import.meta.url), 'utf8')
  const save = source.slice(source.indexOf('async function toggleInjection'), source.indexOf('async function setDiscomfortVal'))
  assert.match(save, /onConflict: 'user_id,compound_id,date'/)
  assert.ok(save.indexOf('if (error) throw error') < save.indexOf('setLogs('))
  assert.match(save, /setDoseSaveError/)
  assert.doesNotMatch(source, /await createDemoCompounds\(/)
})

const require = createRequire(import.meta.url)
const renderedModules = new Map()
function component(file) {
  const url = new URL(file, import.meta.url)
  if (renderedModules.has(url.href)) return renderedModules.get(url.href)
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  const compiledModule = { exports: {} }
  const localRequire = name => {
    if (name === 'next/navigation') return { usePathname: () => '/protocol' }
    if (name.startsWith('.')) {
      const base = new URL(name, url)
      for (const extension of ['.ts', '.tsx']) {
        try { readFileSync(base.href.replace('file://', '') + extension); return component(base.href + extension) } catch (error) { if (error.code !== 'ENOENT') throw error }
      }
    }
    return require(name)
  }
  new Function('require', 'module', 'exports', code)(localRequire, compiledModule, compiledModule.exports)
  renderedModules.set(url.href, compiledModule.exports)
  return compiledModule.exports
}
test('rendered Today has the requested section order and honest empty states', () => {
  const Overview = component('../components/today/TodayOverview.tsx').default
  const html = renderToStaticMarkup(React.createElement(Overview, {
    date: '2026-09-09', protocols: [], events: [], entries: [], due: [], logs: {}, saving: false,
    onTaken() {}, error: null, selected: null, onViewDetails() {}, detailsOpen: false, rings: null, detail: null, weightUnit: 'lbs', onToggleUnit() {},
  }))
  const positions = ['Today’s focus', 'Active protocols', 'Recent changes', 'Health trends'].map(text => html.indexOf(text))
  assert.ok(positions.every((position, index) => position >= 0 && (!index || position > positions[index - 1])))
  assert.match(html, /No doses scheduled today/)
  assert.match(html, /Create your first protocol/)
  assert.doesNotMatch(html, /Mark taken|NaN|undefined/)
})
test('ring selection renders native keyboard-operable buttons with full names', () => {
  const Rings = component('../components/dashboard/CompoundRings.tsx').default
  const html = renderToStaticMarkup(React.createElement(Rings, { activeProtocols: [protocol], activeCompoundTab: 'c', setActiveCompoundTab() {} }))
  assert.match(html, /<button type="button" aria-label="Test compound, week/)
  assert.match(html, /aria-pressed="true"/)
})
test('new focus action is accessible and cannot be clicked while saving', () => {
  const Focus = component('../components/today/TodaysFocusCard.tsx').default
  const html = renderToStaticMarkup(React.createElement(Focus, { activeCount: 1, due: [{ id: 'c', name: 'Sample', dose: '2 mg', dose_unit: '', time_of_day: '' }], logs: {}, saving: true, onTaken() {}, error: 'Please try again.' }))
  assert.match(html, /Time not set/)
  assert.match(html, /disabled=""/)
  assert.match(html, /role="alert"/)
  assert.doesNotMatch(html, /8:00|morning/)
  assert.match(html, /<progress value="0" max="1" aria-label="Today’s scheduled doses logged"/)
})

test('completed focus shows real progress and active rows expose textual status', () => {
  const Focus = component('../components/today/TodaysFocusCard.tsx').default
  const html = renderToStaticMarkup(React.createElement(Focus, { activeCount: 1, due: [{ id: 'c', name: 'Sample', dose: '2 mg', dose_unit: '', time_of_day: '' }], logs: { c: { taken: true } }, saving: false, onTaken() {}, error: null }))
  assert.match(html, /Today’s doses are logged/)
  assert.match(html, /<progress value="1" max="1"/)
  assert.doesNotMatch(html, /Mark taken/)
  const List = component('../components/today/ActiveProtocolList.tsx').default
  const rows = renderToStaticMarkup(React.createElement(List, { items: [{ id: 'c', name: 'Sample', details: '2 mg · daily', week: 6, hasPhase: true }], selected: 'c', onViewDetails() {}, detailsOpen: true }, null))
  assert.match(rows, /Active/)
  assert.match(rows, /Week 6/)
  assert.match(rows, /aria-expanded="true" aria-controls="today-protocol-detail"/)
})

test('rings select a single summary without scrolling or opening details; all compounds remain selectable', () => {
  const List = component('../components/today/ActiveProtocolList.tsx').default
  const items = [{ id: 'a', name: 'First compound', details: 'Dose not fully calculated', week: 1, hasPhase: true }, { id: 'b', name: 'Second compound', details: '2 mg · daily', week: 2, hasPhase: true }]
  const render = selected => renderToStaticMarkup(React.createElement(List, { items, selected, onViewDetails() {}, detailsOpen: false }, null))
  assert.match(render('b'), /Second compound/)
  assert.doesNotMatch(render('b'), /First compound/)
  assert.match(render(null), /First compound/)
  assert.match(render('b'), /View details/)
  assert.match(render('b'), /aria-expanded="false"/)
  const source = readFileSync(new URL('../app/protocol/page.tsx', import.meta.url), 'utf8')
  const select = source.slice(source.indexOf('function selectCompound'), source.indexOf('if (loading)'))
  assert.match(select, /setActiveCompoundTab\(id\)/)
  assert.doesNotMatch(select, /scrollIntoView|setHeroOpen/)
  const Rings = component('../components/dashboard/CompoundRings.tsx').default
  const html = renderToStaticMarkup(React.createElement(Rings, { activeProtocols: [{ ...protocol, compounds: Array.from({ length: 10 }, (_, index) => ({ id: String(index), name: 'Compound ' + index })) }], activeCompoundTab: '9', setActiveCompoundTab() {} }))
  assert.equal((html.match(/aria-pressed=/g) || []).length, 10)
  assert.match(html, /Select protocol/)
})
