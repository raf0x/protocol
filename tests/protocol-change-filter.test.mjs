import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(path, overrides, cache = new Map()) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }
  cache.set(url.href, out.exports)
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name in overrides) return overrides[name]
    if (!name.startsWith('.')) return require(name)
    return load(new URL(`${name}.ts`, url).href, overrides, cache)
  }, out, out.exports)
  return out.exports
}

// Fictional, distinct interventions intentionally share a title. Selection must
// use the exact ID, including encoded punctuation, rather than the display name.
const firstId = 'event:first', secondId = 'phase:second:2026-01-12:dose_changed'
const intervention = (id, date) => ({ id, date, title: 'Example protocol started', sources: [], limitations: [] })
const interventions = [intervention(firstId, '2026-01-10'), intervention(secondId, '2026-01-12'), intervention('event:empty', '2026-02-01')]
const observation = (change, i) => {
  const reading = (id, date, value) => ({ id, date, value, unit: 'mg/dL', type: 'lab', source: { parentId: 'fictional-panel', label: 'Fictional panel' } })
  return { id: `${change.id}:${i}`, intervention: change, metric: { name: `Fictional marker ${i}`, unit: 'mg/dL' },
    baseline: reading(`before-${i}`, '2026-01-05', 10), followups: [reading(`after-${i}`, '2026-01-31', 12)],
    changes: [{ measurementId: `after-${i}`, delta: 2, percent: 20, daysAfter: 21 }], confounders: [],
    strength: { level: 'limited', reasons: [] }, limitations: [] }
}
const data = { asOf: '2026-05-01', window: { baselineDays: 90, followupStartDays: 1, followupEndDays: 84 },
  interventions, observations: interventions.slice(0, 2).flatMap(change => Array.from({ length: 10 }, (_, i) => observation(change, i))), versions: [], limitations: [] }

/** Exercise the actual component's change/click handlers across renders. Unlike
 * the old static-markup tests, router.push does NOT magically commit a URL: a
 * server navigation may be pending or unavailable. Native history is synchronous,
 * and useSearchParams reads its updated URL, as supported by Next's integration. */
function mount(t, initial = '/health?view=changes') {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  t.after(() => oldWindow ? Object.defineProperty(globalThis, 'window', oldWindow) : Reflect.deleteProperty(globalThis, 'window'))
  let entries = [new URL(initial, 'https://example.test')], cursor = 0, states = new Map(), scope = '', slot = 0
  const navigation = [], pushes = []
  const history = {
    pushState(_state, _unused, href) {
      const next = new URL(href, entries[cursor]); pushes.push(next.href)
      entries = entries.slice(0, cursor + 1); entries.push(next); cursor++
    },
    back() { if (cursor) cursor-- },
    forward() { if (cursor < entries.length - 1) cursor++ },
  }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { history, get location() { return entries[cursor] } } })
  const { default: View } = load('../components/health/LongitudinalChanges.tsx', {
    react: { ...React, useEffect: () => {}, useState(initialValue) {
      const key = `${scope}:${slot++}`
      if (!states.has(key)) states.set(key, initialValue === null ? data : typeof initialValue === 'function' ? initialValue() : initialValue)
      return [states.get(key), value => states.set(key, typeof value === 'function' ? value(states.get(key)) : value)]
    } },
    'next/navigation': { useRouter: () => ({ push: (...args) => navigation.push(args) }), useSearchParams: () => new URLSearchParams(entries[cursor].search) },
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    '../../app/health/health.module.css': { default: {} },
  })
  let mountedScopes = new Set()
  function render() {
    const nodes = [], currentScopes = new Set()
    function visit(node, path) {
      if (Array.isArray(node)) return node.forEach((child, i) => visit(child, `${path}/${i}`))
      if (!React.isValidElement(node)) return
      if (typeof node.type === 'function') {
        scope = `${path}:${node.type.name}:${node.key ?? ''}`; slot = 0
        currentScopes.add(scope)
        if (!mountedScopes.has(scope)) for (const key of states.keys()) if (key.startsWith(`${scope}:`)) states.delete(key)
        return visit(node.type(node.props), `${scope}/content`)
      }
      nodes.push(node); visit(node.props.children, `${path}/children`)
    }
    visit(React.createElement(View), 'root')
    mountedScopes = currentScopes
    return nodes
  }
  const nodes = type => render().filter(node => node.type === type)
  return { nodes, navigation, pushes, url: () => entries[cursor], history,
    select(value) { nodes('select')[0].props.onChange({ target: { value } }) },
    more() { nodes('button').find(node => node.props.children === 'Show more recorded comparisons').props.onClick() },
    refresh() { states = new Map(); mountedScopes = new Set(); render() },
  }
}

test('actual select filters immediately even while server navigation cannot complete', t => {
  const app = mount(t)
  app.select(secondId)
  assert.equal(app.url().searchParams.get('change'), secondId)
  assert.equal(app.nodes('select')[0].props.value, secondId)
  assert.ok(app.nodes('article').every(node => node.key.startsWith(secondId)))
  assert.equal(app.navigation.length, 0, 'filtering loaded data must not request a server navigation')
})
test('All changes includes both interventions and excludes insufficient comparisons', t => {
  const app = mount(t); app.more(); app.more()
  assert.equal(app.nodes('article').length, 20)
  assert.ok(app.nodes('article').some(node => node.key.startsWith(firstId)))
  assert.ok(app.nodes('article').some(node => node.key.startsWith(secondId)))
})
test('selection round-trips exact IDs and preserves unrelated search parameters', t => {
  const app = mount(t, '/health?view=changes&other=kept'); app.select(secondId)
  assert.equal(app.url().searchParams.get('view'), 'changes'); assert.equal(app.url().searchParams.get('other'), 'kept')
  assert.equal(app.url().searchParams.get('change'), secondId)
})
test('refresh preserves a selected change', t => {
  const app = mount(t); app.select(secondId); app.refresh()
  assert.equal(app.nodes('select')[0].props.value, secondId)
  assert.ok(app.nodes('article').every(node => node.key.startsWith(secondId)))
})
test('Back and Forward restore both selection and cards', t => {
  const app = mount(t); app.select(firstId); app.select(secondId); app.history.back()
  assert.equal(app.nodes('select')[0].props.value, firstId)
  assert.ok(app.nodes('article').every(node => node.key.startsWith(firstId)))
  app.history.forward(); assert.equal(app.nodes('select')[0].props.value, secondId)
  assert.ok(app.nodes('article').every(node => node.key.startsWith(secondId)))
})
test('unknown linked ID renders zero cards, not All changes', t => {
  const app = mount(t, '/health?view=changes&change=unknown')
  assert.equal(app.nodes('select')[0].props.value, 'unknown'); assert.equal(app.nodes('article').length, 0)
  assert.ok(app.nodes('h3').some(node => node.props.children === 'This protocol change is not available in the loaded history.'))
})
test('known change without comparable labs produces one empty state', t => {
  const app = mount(t); app.select('event:empty')
  assert.equal(app.nodes('article').length, 0)
  assert.equal(app.nodes('h3').filter(node => node.props.children === 'No comparable lab changes were recorded around this protocol update.').length, 1)
})
test('selection and history navigation reset Show more pagination', t => {
  const app = mount(t); app.more(); assert.equal(app.nodes('article').length, 16)
  app.select(firstId); assert.equal(app.nodes('article').length, 8)
  app.more(); assert.equal(app.nodes('article').length, 10)
  app.select(secondId); assert.equal(app.nodes('article').length, 8)
  app.history.back(); assert.equal(app.nodes('article').length, 8)
})
test('switching back to All changes removes the URL filter and restores all groups', t => {
  const app = mount(t); app.select(secondId); app.select('')
  assert.equal(app.url().searchParams.has('change'), false); assert.equal(app.nodes('select')[0].props.value, '')
  app.more(); app.more(); assert.equal(app.nodes('article').length, 20)
})
test('identically named interventions remain separate options and selections', t => {
  const app = mount(t)
  assert.ok(app.nodes('option').some(node => node.props.value === firstId))
  assert.ok(app.nodes('option').some(node => node.props.value === secondId))
  app.select(firstId); assert.ok(app.nodes('article').every(node => node.key.startsWith(firstId)))
})
