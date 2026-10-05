import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { reactHarness } from './helpers/reactHarness.mjs'

const require = createRequire(import.meta.url), cache = new Map(), renderer = reactHarness()
function load(path) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'react') return { ...React, ...renderer.hooks }
    if (!name.startsWith('.')) return require(name)
    return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url))
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}
const { onboardingEligible, onboardingSeen, markOnboardingSeen } = load('../lib/protocols/onboarding.ts')
const { createQuickStart, selectCompound, quickStartIssue } = load('../lib/protocols/quickStart.ts')
const { guidedStepIssue, scheduleQuestion } = load('../lib/protocols/guidedSteps.ts')
const { protocolCompoundPayload } = load('../lib/protocols/form.ts')
const { activeRingItems } = load('../lib/protocols/rings.ts')
const Rings = load('../components/protocols/ProtocolRingComposition.tsx').default
const Flow = load('../components/protocols/ProtocolQuickStart.tsx').default
const Success = load('../components/protocols/ProtocolSetupSuccess.tsx').default
const { saveProtocolWithEvents, ProtocolSaveUncertainError } = load('../lib/health/protocolMutations.ts')
const today = '2026-09-24'
const ready = () => ({ startDate: today, compounds: [{ ...selectCompound(createQuickStart().compounds[0], 'Tirzepatide'), dose: '5', dose_unit: 'mg', route: 'SubQ', days_of_week: [0, 6], frequencyChoice: 'custom' }] })
function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate))
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]
}
function text(node) { return Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '' }
test('only a successful authenticated empty ownership read is eligible, regardless of lifecycle vocabulary', () => {
  assert.equal(onboardingEligible('owner', []), true)
  for (const status of ['planned', 'scheduled', 'active', 'completed', 'paused', 'stopped', 'archived']) assert.equal(onboardingEligible('owner', [{ id: 'p', status }]), false)
  assert.equal(onboardingEligible(null, []), false); assert.equal(onboardingEligible('owner', null), false)
})
test('dismissal is per user and survives restricted session storage without storing health information', () => {
  const records = new Map()
  globalThis.sessionStorage = { getItem: key => records.get(key), setItem: (key, value) => records.set(key, value) }
  assert.equal(onboardingSeen('first'), false); markOnboardingSeen('first')
  assert.equal(onboardingSeen('first'), true); assert.equal(onboardingSeen('second'), false)
  assert.deepEqual([...records], [['mpp:first-protocol:first', '1']])
  delete globalThis.sessionStorage
  markOnboardingSeen('restricted'); assert.equal(onboardingSeen('restricted'), true)
})
test('each step validates its shared draft section without a later missing answer masking an error', () => {
  const value = createQuickStart(undefined, undefined, today)
  assert.equal(guidedStepIssue(value, 'compound', 0).field, 'name')
  assert.equal(guidedStepIssue(value, 'dose', 0).field, 'route')
  assert.equal(guidedStepIssue(value, 'schedule', 0).field, 'days_of_week')
  assert.equal(guidedStepIssue(value, 'start', 0), null)
  const draft = ready()
  for (const field of ['dose', 'dose_unit']) {
    const partial = { ...draft, compounds: [{ ...draft.compounds[0], [field]: '' }] }
    assert.equal(guidedStepIssue(partial, 'dose', 0), null)
    assert.equal(quickStartIssue(partial), null)
  }
  assert.equal(quickStartIssue({ ...draft, compounds: [{ ...draft.compounds[0], dose: '', dose_unit: '' }] }), null)
  assert.equal(guidedStepIssue({ ...draft, compounds: [{ ...draft.compounds[0], route: '' }] }, 'dose', 0).field, 'route')
  for (const [field, entered] of [['dose', '-1'], ['dose_unit', 'g']]) {
    const invalid = { ...draft, compounds: [{ ...draft.compounds[0], [field]: entered }] }
    assert.equal(guidedStepIssue(invalid, 'dose', 0).field, field)
    const missingRoute = { ...invalid, compounds: [{ ...invalid.compounds[0], route: '' }] }
    assert.equal(guidedStepIssue(missingRoute, 'dose', 0).field, field)
  }
  assert.ok(guidedStepIssue({ ...draft, compounds: [{ ...draft.compounds[0], frequencyChoice: '3x' }] }, 'schedule', 0))
  for (const cycle_days of ['', '0', '8', '1.5', 'Infinity']) assert.ok(guidedStepIssue({ ...draft, compounds: [{ ...draft.compounds[0], frequency_mode: 'rolling', cycle_days }] }, 'schedule', 0))
  assert.equal(quickStartIssue(draft), null)
})
test('route-specific titles and oral recording preserve safety distinctions', () => {
  assert.equal(scheduleQuestion('IM'), 'When do you inject?'); assert.equal(scheduleQuestion('SubQ'), 'When do you inject?')
  assert.equal(scheduleQuestion('Oral'), 'When do you take it?'); assert.equal(scheduleQuestion('Other'), 'When do you use it?')
  const value = ready(); value.compounds[0] = { ...value.compounds[0], route: 'Oral', input_mode: 'volume', injection_volume: '.2' }
  assert.equal(quickStartIssue(value).field, 'input_mode')
})
test('guided back/forward preserves entries; incomplete steps cannot advance; retry retains review', () => {
  renderer.reset(); let value = createQuickStart(undefined, undefined, today), saved = 0, closed = 0, saveError = ''
  const render = () => renderer.render(React.createElement(Flow, { value, today, onChange: next => { value = next }, onSave() { saved++; saveError = 'Please try again.' }, onClose() { closed++ }, firstProtocol: true, saveError }))
  const button = name => nodes(render(), node => node.type === 'button' && text(node) === name)[0]
  const field = name => nodes(render(), node => node.props['aria-label'] === name)[0]
  button('Not now').props.onClick(); assert.equal(closed, 1)
  button('Continue').props.onClick(); assert.match(text(render()), /What are you tracking/)
  button('Tirzepatide').props.onClick(); button('Continue').props.onClick()
  assert.equal(field('Protocol start date'), undefined); assert.equal(button('Daily'), undefined)
  button('Continue').props.onClick(); assert.match(text(render()), /How much do you take/)
  field('Medication dose').props.onChange({ target: { value: '5' } }); field('Medication dose unit').props.onChange({ target: { value: 'mg' } }); field('How do you take it?').props.onChange({ target: { value: 'Oral' } })
  assert.equal(field('Vial strength'), undefined)
  button('Continue').props.onClick(); assert.match(text(render()), /When do you take it/)
  button('Custom').props.onClick(); field('Saturday').props.onClick(); field('Sunday').props.onClick(); button('Night').props.onClick()
  button('Back').props.onClick(); assert.equal(field('Medication dose').props.value, '5')
  button('Continue').props.onClick(); assert.equal(field('Sunday').props['aria-pressed'], true)
  button('Continue').props.onClick(); button('I don’t know yet').props.onClick(); button('Review protocol').props.onClick()
  assert.match(text(render()), /Planned/); assert.equal(button('Start tracking'), undefined)
  button('Save protocol').props.onClick(); assert.equal(saved, 1); assert.match(text(render()), /Please try again/)
  assert.equal(value.compounds[0].dose, '5'); assert.deepEqual(value.compounds[0].days_of_week, [6, 0])
  button('Save protocol').props.onClick(); assert.equal(saved, 2)
})
test('rings use ordered rows of three and center incomplete final rows', () => {
  for (const count of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 15]) {
    const protocols = Array.from({ length: count }, (_, i) => ({ id: String(i), created_at: `2026-09-${10 + i}`, status: 'active', start_date: '2026-09-01', compounds: [{ id: `c${i}`, name: `Compound ${i}` }] }))
    const items = activeRingItems(protocols, today)
    assert.deepEqual(activeRingItems([...protocols].reverse(), today), items)
    const html = renderToStaticMarkup(React.createElement(Rings, { items, selected: 'c0', onSelect() {} }))
    assert.equal((html.match(/class="protocol-ring protocol-ring-/g) || []).length, count || 5)
    assert.equal((html.match(/<button /g) || []).length, count)
    assert.equal((html.match(/aria-hidden="true"/g) || []).length, count ? 0 : 5)
    if (count) assert.match(html, /Compound 0, week 4. Select protocol/)
    for (let index = 0; index < count; index++) assert.match(html, new RegExp(`Compound ${index}, week 4\\. Select protocol`))
    assert.equal(new Set([...html.matchAll(/aria-label="Compound (\d+), week 4\. Select protocol"/g)].map(match => match[1])).size, count)
    assert.doesNotMatch(html, /required|slot|of 5|\+\d+ more/i)
    if (count) {
      const positions = [...html.matchAll(/grid-column:([^;]+);grid-row:(\d+)/g)].map(match => [match[1], Number(match[2])])
      const expected = Array.from({ length: count }, (_, index) => {
        const row = Math.floor(index / 3)
        const indexInRow = index % 3
        const rowSize = Math.min(3, count - row * 3)
        const column = rowSize === 1 ? 3 : rowSize === 2 ? 2 + indexInRow * 2 : 1 + indexInRow * 2
        return [`${column} / span 2`, row + 1]
      })
      assert.deepEqual(positions, expected)
    }
  }
})
test('non-active lifecycles never occupy active rings', () => {
  const base = { id: 'p', start_date: '2026-09-01', compounds: [{ id: 'c', name: 'Test' }] }
  for (const status of ['planned', 'scheduled', 'completed', 'paused', 'stopped']) assert.equal(activeRingItems([{ ...base, status }], today).length, 0)
  assert.equal(activeRingItems([{ ...base, status: 'active', start_date: '2099-01-01' }], today).length, 0)
})
test('success distinguishes lifecycle, shows recorded next occurrence and centers its named ring', () => {
  for (const startDate of [today, '2099-01-01', '']) {
    renderer.reset(); const draft = { ...ready(), startDate }, payload = protocolCompoundPayload(draft.compounds)
    const view = renderer.render(React.createElement(Success, { saved: { id: 'saved', draft, payload, firstProtocol: true }, today }))
    assert.match(text(view), /Your protocol is ready/)
    assert.equal(nodes(view, n => /^protocol-ring protocol-ring-/.test(n.props.className || '')).length, 1)
    if (!startDate) { assert.match(text(view), /Planned/); assert.doesNotMatch(text(view), /Next scheduled:/) }
    else if (startDate > today) { assert.match(text(view), /Scheduled/); assert.match(text(view), /Jan 1, 2099|Jan 3, 2099|Jan 4, 2099/) }
    else assert.match(text(view), /Next scheduled: Sep 26, 2026/)
  }
})
test('canonical transport distinguishes known rollback errors from ambiguous outcomes', async () => {
  const input = { protocolId: null, name: 'Test', startDate: today, compounds: [] }
  let calls = 0
  assert.equal(await saveProtocolWithEvents(input, { rpc: async () => { calls++; return { data: 'saved', error: null, status: 200 } } }), 'saved')
  assert.equal(calls, 1)
  await assert.rejects(saveProtocolWithEvents(input, { rpc: async () => ({ error: { code: 'P0001', message: 'Rejected' }, status: 400 }) }), error => !(error instanceof ProtocolSaveUncertainError))
  for (const rpc of [async () => { throw Error('Network lost') }, async () => ({ error: { code: '', message: 'Fetch failed' }, status: 0 }), async () => ({ data: null, error: null, status: 200 })]) await assert.rejects(saveProtocolWithEvents(input, { rpc }), ProtocolSaveUncertainError)
})
