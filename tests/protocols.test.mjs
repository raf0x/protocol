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
const { compoundOverview, durationLabel } = load('../lib/health/protocolPresentation.ts')
const { entryFromForm } = load('../lib/health/dosingEntry.ts')
const phase = { id: 'ph', dose: 2, dose_unit: 'mg', dose_semantics_version: 1, start_week: 1, end_week: null, frequency: 'daily', route: 'SubQ', time_of_day: null }
const compound = { id: 'c', name: 'Test compound', phases: [phase] }
const protocol = { id: 'p', name: 'Plan', start_date: '2026-08-01', status: 'active', compounds: [compound] }
const today = '2026-09-09'

test('overview uses the covering phase rather than first phase, and never mutates history', () => {
  const c = { ...compound, phases: [{ ...phase, end_week: 4 }, { ...phase, id: 'next', start_week: 5, dose: 3 }] }
  const before = JSON.stringify(c)
  assert.equal(compoundOverview(protocol, c, today).dose, '3 mg')
  assert.equal(compoundOverview(protocol, c, today).week, 6)
  assert.equal(JSON.stringify(c), before)
})
test('expired phase stays expired and does not generate an upcoming dose', () => {
  const info = compoundOverview(protocol, { ...compound, phases: [{ ...phase, end_week: 4 }] }, today)
  assert.equal(info.phase, null)
  assert.equal(info.next, null)
  assert.equal(info.dose, 'Dose not fully calculated')
})
test('next scheduled day uses existing structured schedule and phase bounds', () => {
  const info = compoundOverview(protocol, { ...compound, phases: [{ ...phase, frequency: '2x/week', days_of_week: [1, 4] }] }, today)
  assert.equal(info.next.date, '2026-09-10')
  assert.equal(info.next.time, null)
  assert.equal(info.frequency, '2x/week')
})
test('completed overview uses saved completion date and never schedules reactivation', () => {
  const p = { ...protocol, status: 'completed', completed_date: '2026-08-14T12:00:00Z' }
  const info = compoundOverview(p, compound, today)
  assert.equal(info.dose, '2 mg')
  assert.equal(info.next, null)
  assert.equal(info.week, null)
  assert.equal(durationLabel(p), '13 days')
})
test('incomplete syringe entry stays a raw dose representation with no invented medication amount', () => {
  const entry = entryFromForm({ input_mode: 'syringe', syringe_markings: '20', syringe_scale: '100' })
  assert.equal(compoundOverview(protocol, { ...compound, phases: [{ ...phase, dosing_entry: entry }] }, today).dose, '20 U-100 units')
  assert.equal(compoundOverview(protocol, { ...compound, phases: [] }, today).dose, 'Dose not fully calculated')
})
test('library renders separate Active and Completed groups and useful empty states', () => {
  const Library = load('../components/protocols/ProtocolLibrary.tsx').default
  const html = renderToStaticMarkup(React.createElement(Library, { protocols: [], today, selected: new Set(), selecting: false, onOpen() {}, onAdd() {}, onSelect() {} }))
  assert.match(html, /Active protocols/)
  assert.match(html, /Completed protocols/)
  assert.match(html, /Add Protocol/)
  assert.match(html, /Completed protocols keep their dates and history/)
})
test('multi-compound protocols remain distinct and all compounds are visible in the card', () => {
  const Card = load('../components/protocols/ProtocolCard.tsx').default
  const html = renderToStaticMarkup(React.createElement(Card, { protocol: { ...protocol, compounds: [compound, { ...compound, id: 'other', name: 'Another compound' }] }, today, index: 0, selecting: false, selected: false, onOpen() {}, onSelect() {} }))
  assert.match(html, /Test compound/)
  assert.match(html, /Another compound/)
  assert.match(html, /aria-label="View Plan"/)
})
test('detail renders progressive disclosure and expired-phase actions', () => {
  const Detail = load('../components/protocols/ProtocolDetail.tsx').default
  const html = renderToStaticMarkup(React.createElement(Detail, { protocol: { ...protocol, compounds: [{ ...compound, phases: [{ ...phase, end_week: 4 }] }] }, today, onBack() {}, onEdit() {}, onComplete() {}, onReactivate() {}, onDelete() {}, onReload() {} }))
  for (const label of ['Latest phase ended', 'Continue latest phase', 'Add new phase', 'Administration details', 'Reconstitution &amp; concentration', 'Inventory &amp; notes', 'History']) assert.ok(html.includes(label), label)
  assert.doesNotMatch(html, /NaN|undefined/)
})
test('completed protocol has no continue-latest mutation action', () => {
  const Phase = load('../components/protocols/PhaseCard.tsx').default
  const html = renderToStaticMarkup(React.createElement(Phase, { protocol: { ...protocol, status: 'completed', completed_date: '2026-08-29' }, compound: { ...compound, phases: [{ ...phase, end_week: 4 }] }, today, onEdit() {}, onReload() {} }))
  assert.doesNotMatch(html, /Continue latest phase|Add new phase/)
})
test('editor sections support native collapsed optional fields without unmounting inputs', () => {
  const Section = load('../components/protocols/EditorSection.tsx').default
  const html = renderToStaticMarkup(React.createElement(Section, { title: 'Preparation', optional: true }, React.createElement('input', { name: 'amount', defaultValue: '' })))
  assert.match(html, /<details/)
  assert.match(html, /<input/)
  assert.doesNotMatch(html, /open=""/)
})
test('editor still calls the save-first RPC, uses ongoing helper, and retains every entry mode', () => {
  const source = readFileSync(new URL('../app/protocol/manage/page.tsx', import.meta.url), 'utf8')
  for (const token of ["rpc('save_protocol_dosing_v2'", 'phaseEndWeek(start,c.duration_weeks)', 'entryFromForm(c)', 'value="medication"', 'value="syringe"', 'value="volume"', 'value="unknown"']) assert.ok(source.includes(token), token)
  assert.doesNotMatch(source, /calculateDosing\(/)
})
