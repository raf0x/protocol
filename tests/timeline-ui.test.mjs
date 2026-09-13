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
const { weightComparisons, journalPresentation, eventTime, timelineFilterFromParam, timelineFilterUrl } = load('../lib/health/timelinePresentation.ts')
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
test('Timeline URL filters preserve unrelated state and treatment implies Protocols', () => {
  const key = 't1:["protocol:one","compound:one"]'
  const url = new URL(timelineFilterUrl('other=kept&category=labs', 'All', key), 'https://example.test')
  assert.equal(url.pathname, '/timeline'); assert.equal(url.searchParams.get('other'), 'kept')
  assert.equal(url.searchParams.get('category'), 'protocols'); assert.equal(url.searchParams.get('treatment'), key)
  assert.equal(timelineFilterFromParam(url.searchParams.get('category')), 'Protocols')
  const cleared = new URL(timelineFilterUrl(url.search, 'All'), url.origin)
  assert.equal(cleared.searchParams.has('category'), false); assert.equal(cleared.searchParams.has('treatment'), false)
})
test('all five accessible filter controls remain with one selected', () => {
  const html = render(Filters, { value: 'Weight', treatments: [{ key: 't1:["p","c"]', label: 'Tirzepatide', startedAt: '2026-01-01' }], onChange() {} })
  assert.equal((html.match(/<button/g) || []).length, 5)
  assert.equal((html.match(/aria-pressed="true"/g) || []).length, 1)
  for (const label of ['All', 'Protocols', 'Weight', 'Journal', 'Labs']) assert.ok(html.includes(label))
  assert.match(html, /<label[^>]*for="timeline-treatment"/); assert.match(html, /<select[^>]*id="timeline-treatment"/)
  assert.ok(html.includes('All treatments')); assert.ok(html.includes('Tirzepatide'))
})
test('Timeline page reads both filters from URL state and uses native History', () => {
  const ui = readFileSync(new URL('../app/timeline/page.tsx', import.meta.url), 'utf8')
  assert.match(ui, /useSearchParams\(\)/); assert.match(ui, /query\.get\('category'\)/); assert.match(ui, /query\.get\('treatment'\)/)
  assert.equal((ui.match(/window\.history\.pushState/g) || []).length, 2)
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
