import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function loader({ hooks, continuation = async () => { throw Error('No mutation is allowed while rendering') } } = {}) {
  const cache = new Map()
  function load(file) {
    const url = new URL(file, import.meta.url)
    if (cache.has(url.href)) return cache.get(url.href)
    const output = { exports: {} }
    const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
    new Function('require', 'module', 'exports', code)(name => {
      if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
      if (name === 'react' && hooks) return { ...React, ...hooks }
      if (name.endsWith('/protocolMutations')) return { continueLatestPhase: continuation }
      if (name.endsWith('/supabase')) return { createClient() { throw Error('Presentation must not request backend data') } }
      if (!name.startsWith('.')) return require(name)
      return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url))
    }, output, output.exports)
    cache.set(url.href, output.exports)
    return output.exports
  }
  return load
}
const load = loader()
const PhaseCard = load('../components/protocols/PhaseCard.tsx').default
const Detail = load('../components/protocols/ProtocolDetail.tsx').default
const Artwork = load('../components/protocols/ProtocolSetupArtwork.tsx').default
const { entryFromForm } = load('../lib/health/dosingEntry.ts')
const noop = () => {}
const today = '2026-11-04'
// Existing formatProtocolNumber rounds dose to two decimals and markings to one.
// These assertions preserve that baseline display contract and raw records separately.
const phase = (id, start, end, dose = 1.2345, unit = 'mg') => ({ id, start_week: start, end_week: end, dose, dose_unit: unit, dose_semantics_version: 1, frequency: 'daily', route: 'SubQ' })
const compound = { id: 'fictional-compound', name: 'Synthetic QA compound', phases: [phase('ongoing', 1, null)] }
const protocol = { id: 'fictional-protocol', name: 'Synthetic QA protocol', status: 'active', start_date: '2026-10-01', compounds: [compound] }
const render = (Component, props) => renderToStaticMarkup(React.createElement(Component, props))
const copy = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
function card(overrides = {}) {
  const props = { protocol, compound, today, onEdit: noop, onReload: noop, ...overrides }
  const original = JSON.stringify(props)
  const html = render(PhaseCard, props)
  assert.equal(JSON.stringify(props), original, 'Rendering cannot mutate supplied medical facts')
  return html
}
const detail = supplied => render(Detail, { protocol: supplied, today, onBack: noop, onEdit: noop, onComplete: noop, onPause: noop, onResume: noop, onReactivate: noop, onDelete: noop, onReload: noop })

test('every historical and ongoing phase remains visible with its baseline formatted dose and original weeks', () => {
  const phases = [phase('one', 1, 2, 1.2345), phase('two', 3, 4, 125.25, 'mcg'), phase('three', 5, null, 4.125, 'IU')]
  const html = card({ compound: { ...compound, phases } }), text = copy(html)
  assert.equal((html.match(/class="protocol-history-row"/g) ?? []).length, 3)
  for (const fact of ['1.23 mg', '125.25 mcg', '4.13 IU', 'Weeks 1–2', 'Weeks 3–4', 'Started Week 5 · Ongoing', 'Show phases (3)']) assert.ok(text.includes(fact), fact)
  assert.ok(text.indexOf('4.13 IU') < text.indexOf('125.25 mcg'), 'Existing reverse chronological phase order')
})

for (const [label, changes, expected] of [
  ['ongoing', {}, 'Current phase'],
  ['completed', { status: 'completed', completed_date: '2026-10-12' }, 'Final phase'],
  ['planned', { status: 'planned', start_date: null }, 'Planned phase'],
  ['future', { start_date: '2026-12-01' }, 'Scheduled phase'],
]) test(`saved ${label} lifecycle label survives the artwork integration`, () => {
  const html = card({ protocol: { ...protocol, ...changes } })
  assert.ok(copy(html).includes(expected))
  assert.match(html, /data-protocol-setup-artwork="phases"/)
  assert.doesNotMatch(html, /progressbar|[0-9]+%|<text/)
})

test('missing dates retain the unknown current-phase state and saved history', () => {
  const text = copy(card({ protocol: { ...protocol, start_date: null } }))
  assert.ok(text.includes('No current phase saved'))
  assert.ok(text.includes('Started Week 1 · Ongoing'))
})

test('missing phase weeks remain unknown rather than inferred by the artwork', () => {
  const text = copy(card({ protocol: { ...protocol, start_date: null }, compound: { ...compound, phases: [phase('unknown-week', null, null)] } }))
  assert.ok(text.includes('Started Week unknown · Ongoing'))
})

test('empty planned protocol has no invented history or phase data', () => {
  const html = card({ protocol: { ...protocol, status: 'planned', start_date: null }, compound: { ...compound, phases: [] } }), text = copy(html)
  assert.ok(text.includes('No current phase saved'))
  assert.ok(text.includes('Add a phase'))
  assert.doesNotMatch(html, /protocol-history-row|Show phases|Started Week|Weeks \d/)
  assert.ok(copy(detail({ ...protocol, status: 'planned', compounds: [] })).includes('No compounds saved yet'))
})

test('expired phase retains continue and add controls without marking it current', () => {
  const text = copy(card({ compound: { ...compound, phases: [phase('ended', 1, 2)] } }))
  for (const expected of ['Latest phase ended', 'Continue latest phase', 'Add new phase', 'Weeks 1–2']) assert.ok(text.includes(expected), expected)
})

for (const scale of ['40', '100']) test(`Protocol Detail retains U-${scale}, decimal markings, volume and saved phase history`, () => {
  const dosing_entry = entryFromForm({ input_mode: 'syringe', syringe_markings: '8.125', syringe_scale: scale, reviewed: true })
  const html = detail({ ...protocol, compounds: [{ ...compound, phases: [{ ...phase('draw', 1, null), dosing_entry }] }] }), text = copy(html)
  assert.ok(text.includes(`8.1 U-${scale} units`), text)
  assert.ok(text.includes(scale === '40' ? '0.2 mL' : '0.08 mL'), text)
  for (const action of ['Edit protocol', 'Pause protocol', 'Complete protocol', 'Delete protocol', 'Show phases']) assert.ok(text.includes(action), action)
})

test('unknown dosing and review warning remain separate from decorative artwork', () => {
  const dosing_entry = entryFromForm({ input_mode: 'unknown', dose: '1.2345', dose_unit: 'mg', reviewed: false })
  const html = detail({ ...protocol, compounds: [{ ...compound, phases: [{ ...phase('review', 1, null), dosing_entry }] }] })
  assert.match(html, /class="protocol-dose-issue" role="status"/)
  assert.ok(copy(html).includes('Dose meaning is unverified'))
  assert.ok(copy(html).includes('Review what the amount measures'))
  assert.ok(copy(html).includes('The original amount is preserved'))
})

test('multiple compounds retain independent phase lists and unique local SVG definitions', () => {
  const html = detail({ ...protocol, compounds: [compound, { ...compound, id: 'second', name: 'Second synthetic compound', phases: [phase('second-first', 1, 2), phase('second-current', 3, null)] }] })
  assert.equal((html.match(/data-protocol-setup-artwork="phases"/g) ?? []).length, 2)
  assert.equal((html.match(/class="protocol-history-row"/g) ?? []).length, 3)
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1])
  assert.equal(new Set(ids).size, ids.length, 'Duplicate SVG IDs can cross-paint compound artwork')
  for (const id of html.matchAll(/url\(#([^)]+)\)/g)) assert.ok(ids.includes(id[1]))
})

test('artwork contains no clinical text, current/completed step, control, count or focus stop', () => {
  for (const kind of ['phases', 'other']) {
    const html = render(Artwork, { kind })
    assert.equal(copy(html), '')
    assert.match(html, /aria-hidden="true"/)
    assert.match(html, /focusable="false"/)
    assert.doesNotMatch(html, /<text|<button|tabindex|role="progressbar"|data-current|data-completed|data-motion="phase-energy"/)
    assert.equal((html.match(/<linearGradient/g) ?? []).length, 5, 'Approved dimensional materials retained')
  }
})

test('artwork alone cannot continue a phase; the existing explicit action passes original identifiers', async () => {
  const writes = [], edits = [], states = []
  let reloads = 0
  const interactiveLoad = loader({ hooks: { useState(initial) { return [initial, value => states.push(value)] } }, continuation: async input => { writes.push(input) } })
  const InteractiveCard = interactiveLoad('../components/protocols/PhaseCard.tsx').default
  const tree = InteractiveCard({ protocol, compound: { ...compound, phases: [phase('ended', 1, 2)] }, today, onEdit: (...args) => edits.push(args), onReload: () => reloads++ })
  const walk = node => !node ? [] : Array.isArray(node) ? node.flatMap(walk) : React.isValidElement(node) ? [node, ...walk(node.props.children)] : []
  const buttons = walk(tree).filter(node => node.type === 'button')
  assert.equal(writes.length, 0)
  buttons.find(node => node.props.children === 'Add new phase').props.onClick()
  assert.deepEqual(edits, [['fictional-compound', true]])
  await buttons.find(node => node.props.children === 'Continue latest phase').props.onClick()
  assert.deepEqual(writes, [{ protocolId: 'fictional-protocol', compoundId: 'fictional-compound', phaseId: 'ended' }])
  assert.equal(reloads, 1)
  assert.deepEqual(states, [true, '', false])
})

test('an unsuccessful explicit continuation still reports the original error and does not reload', async () => {
  const states = []
  const interactiveLoad = loader({ hooks: { useState(initial) { return [initial, value => states.push(value)] } }, continuation: async () => { throw Error('Synthetic rejected save') } })
  const InteractiveCard = interactiveLoad('../components/protocols/PhaseCard.tsx').default
  const tree = InteractiveCard({ protocol, compound: { ...compound, phases: [phase('ended', 1, 2)] }, today, onEdit: noop, onReload: () => assert.fail('Failed save must not reload') })
  const actions = tree.props.children.find(child => child?.props?.className === 'protocol-action-row')
  await actions.props.children[0].props.onClick()
  assert.deepEqual(states, [true, '', 'This phase could not be continued. Please try again.', false])
})
