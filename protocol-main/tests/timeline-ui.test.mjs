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
const { weightComparisons, journalPresentation, eventTime } = load('../lib/health/timelinePresentation.ts')
const { TimelineEventCard } = load('../components/timeline/TimelineHistory.tsx')
const Filters = load('../components/timeline/TimelineFilters.tsx').default
const Empty = load('../components/timeline/TimelineEmpty.tsx').default
const Baseline = load('../components/timeline/TimelineBaseline.tsx').default
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props))
const weight = (id, date, value, unit = 'lbs') => ({ id, date, category: 'Weight', title: `${value} ${unit}`, metadata: { weight: value, unit } })

test('weight comparisons use previous calendar day without changing input order or data', () => {
  const events = [weight('new', '2026-09-08', 160), weight('old', '2026-08-30', 161.2)]
  const before = JSON.stringify(events)
  assert.deepEqual(weightComparisons(events).get('new'), { delta: -1.2, date: '2026-08-30' })
  assert.equal(weightComparisons(events).has('old'), false)
  assert.equal(JSON.stringify(events), before)
})
test('multiple previous-day weights and different units never get a guessed delta', () => {
  assert.equal(weightComparisons([weight('a', '2026-09-01', 160), weight('b', '2026-09-01', 162), weight('c', '2026-09-02', 161)]).size, 0)
  assert.equal(weightComparisons([weight('a', '2026-09-01', 160), weight('b', '2026-09-02', 72, 'kg')]).size, 0)
})
test('journal chips preserve zero and remove only the exact generated suffix', () => {
  const event = { metadata: { sleep: 0, mood: 4 }, description: 'My note\nMood 4/5 · Sleep 0h' }
  assert.deepEqual(journalPresentation(event), { metrics: ['Mood 4/5', 'Sleep 0h'], notes: 'My note' })
  assert.equal(journalPresentation({ ...event, description: 'Mood changed today' }).notes, 'Mood changed today')
})
test('calendar-only dates never get fabricated times', () => {
  assert.equal(eventTime('2026-09-08'), null)
  assert.equal(eventTime('invalidTdate'), null)
})
test('all five accessible filter controls remain with one selected', () => {
  const html = render(Filters, { value: 'Weight', onChange() {} })
  assert.equal((html.match(/<button/g) || []).length, 5)
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1)
  for (const label of ['All', 'Protocols', 'Weight', 'Journal', 'Labs']) assert.ok(html.includes(label))
})
test('protocol cards retain original event title and identify mutable saved-plan context', () => {
  const html = render(TimelineEventCard, { event: { id: 'p', date: '2026-09-08', title: 'Plan dose changed', category: 'Protocol', description: 'Recorded change', metadata: { dose: 3, doseUnit: 'mg', protocolId: 'different-id' } } })
  assert.ok(html.includes('Plan dose changed'))
  assert.ok(html.includes('Saved plan context'))
  assert.ok(html.includes('/protocol/manage?protocol=different-id'))
  assert.ok(!html.includes('→'))
})
test('long journal notes expand inline and metrics are not repeated in note text', () => {
  const html = render(TimelineEventCard, { event: { category: 'Journal', date: '2026-09-08', title: 'Daily check-in', description: 'Long note '.repeat(40) + '\nSleep 0h', metadata: { sleep: 0 } } })
  assert.ok(html.includes('<details'))
  assert.ok(html.includes('Read full note'))
  assert.equal((html.match(/Sleep 0h/g) || []).length, 1)
})
test('empty states are specific, Labs links to manual entry without fake data', () => {
  for (const filter of ['All', 'Protocols', 'Weight', 'Journal', 'Labs']) assert.ok(render(Empty, { filter }).includes('<h2>'))
  const labs = render(Empty, { filter: 'Labs' })
  assert.ok(labs.includes('No lab results yet'))
  assert.ok(labs.includes('/health?action=add'))
})
test('baseline keeps current facts and protocol details available without inventing metrics', () => {
  const html = render(Baseline, { baseline: { weight: null, activeProtocolCount: 1, lastProtocolChangeDate: '2026-09-08', lastProtocolChangeTitle: 'Plan started', activeProtocols: [{ id: 'p', name: 'Plan', week: 2, compounds: [{ id: 'c', details: ['20 U-100 units'], issue: 'Incomplete' }] }] } })
  assert.ok(html.includes('Not recorded'))
  assert.ok(html.includes('Plan started'))
  assert.ok(html.includes('<details'))
  assert.ok(html.includes('20 U-100 units'))
  assert.ok(!html.includes('20 mg'))
})
