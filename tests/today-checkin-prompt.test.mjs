import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import React from 'react'
import ts from 'typescript'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
let current
const hooks = {
  useState(initial) {
    const instance = current, index = instance.slot++
    if (!(index in instance.slots)) instance.slots[index] = initial
    return [instance.slots[index], value => {
      const next = typeof value === 'function' ? value(instance.slots[index]) : value
      if (!Object.is(next, instance.slots[index])) { instance.slots[index] = next; instance.dirty = true }
    }]
  },
  useRef(initial) {
    const index = current.slot++
    return current.slots[index] ?? (current.slots[index] = { current: initial })
  },
  useEffect(effect, deps) {
    const index = current.slot++, previous = current.slots[index]
    if (!previous || deps.some((dep, i) => !Object.is(dep, previous.deps[i]))) {
      const record = { deps, cleanup: previous?.cleanup }
      current.slots[index] = record
      current.pending.push(() => { record.cleanup?.(); record.cleanup = effect() })
    }
  },
}
const compiled = { exports: {} }
const code = ts.transpileModule(readFileSync(new URL('../components/today/DailyCheckInPrompt.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText
new Function('require', 'module', 'exports', code)(name => {
  if (name === 'react') return { ...React, ...hooks }
  if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
  if (name.endsWith('/DesignSystem')) return { SecondaryAction: 'button' }
  if (name.endsWith('/AppIcon')) return { __esModule: true, default: () => null }
  return require(name)
}, compiled, compiled.exports)
const Prompt = compiled.exports.default
const nodes = (tree, match) => Array.isArray(tree) ? tree.flatMap(n => nodes(n, match)) : tree && typeof tree === 'object' ? [...(match(tree) ? [tree] : []), ...nodes(tree.props?.children, match)] : []
const text = tree => Array.isArray(tree) ? tree.map(text).join('') : tree && typeof tree === 'object' ? text(tree.props?.children) : typeof tree === 'boolean' ? '' : String(tree ?? '')

// Commit refs before effects, then flush state updates. Check non-modal focus and
// dismissal interactions here; real browser layout/animation is not claimed.
function fixture(t, initial) {
  const previousDocument = globalThis.document
  const calls = { heading: 0, trigger: 0, outside: 0 }
  const focusOrigin = { focus() { calls.outside++; globalThis.document.activeElement = focusOrigin } }
  globalThis.document = { activeElement: focusOrigin, body: {} }
  const inside = {}
  const heading = { focus() { calls.heading++; globalThis.document.activeElement = heading } }
  const panel = { contains: element => element === heading || element === inside, querySelector: () => heading }
  const trigger = { focus() { calls.trigger++; globalThis.document.activeElement = trigger } }
  const instance = { slots: [], pending: [], slot: 0, dirty: true }
  let props = initial, tree
  function draw(update = {}) {
    props = { ...props, ...update }
    let renders = 0
    do {
      assert.ok(renders++ < 10, 'effects settle')
      instance.dirty = false; instance.slot = 0; instance.pending = []; current = instance
      tree = Prompt(props)
      const renderedPanel = nodes(tree, n => n.props?.role === 'dialog')[0]
      if (renderedPanel) renderedPanel.props.ref.current = panel
      nodes(tree, n => n.props?.['aria-haspopup'] === 'dialog')[0].props.ref.current = trigger
      for (const effect of instance.pending) effect()
    } while (instance.dirty)
    return tree
  }
  function unmount() { for (const slot of instance.slots) slot?.cleanup?.(); instance.slots = [] }
  const api = { draw, unmount, calls, focusOrigin, heading, trigger,
    panel: () => nodes(tree, n => n.props?.role === 'dialog')[0],
    focusOutside: () => focusOrigin.focus(),
    focusInside: () => { globalThis.document.activeElement = inside },
    click(label) {
    const button = nodes(tree, n => n.type === 'button' && (n.props['aria-label'] === label || text(n) === label))[0]
    assert.ok(button, label)
    globalThis.document.activeElement = button.props['aria-haspopup'] === 'dialog' ? trigger : inside
    button.props.onClick(); draw()
  } }
  draw()
  t.after(() => { unmount(); globalThis.document = previousDocument })
  return api
}
const day = '2026-10-04'

test('prompt waits for loaded account/day and suppresses an already recorded day', t => {
  const f = fixture(t, { ownerId: null, date: day, recorded: false })
  assert.equal(f.panel(), undefined)
  f.draw({ ownerId: 'recorded-account', recorded: true })
  assert.equal(f.panel(), undefined)
  f.click('Review check-in')
  assert.ok(f.panel()); assert.equal(f.calls.heading, 1)
  assert.equal(globalThis.document.activeElement, f.heading)
  assert.match(text(f.panel()), /Your daily check-in/)
  f.click('Done'); assert.equal(f.panel(), undefined); assert.equal(f.calls.trigger, 1)
  assert.equal(globalThis.document.activeElement, f.trigger)
})

test('missing check-in prompts once per account/local day across client navigation, and again next day', t => {
  const f = fixture(t, { ownerId: 'once-account', date: day, recorded: false })
  assert.ok(f.panel()); f.click('Skip for now'); assert.equal(f.panel(), undefined)
  f.unmount(); f.draw(); assert.equal(f.panel(), undefined)
  f.draw({ date: '2026-10-05' }); assert.ok(f.panel()); f.click('Skip for now')
  f.unmount(); f.draw({ ownerId: 'different-account' }); assert.ok(f.panel())
})

test('Escape inside the panel, close and skip dismiss without saves and allow reopening', t => {
  let saves = 0, prevented = 0
  const child = React.createElement('button', { onClick: () => saves++ }, 'Existing save')
  const f = fixture(t, { ownerId: 'dismiss-account', date: day, recorded: false, children: child })
  assert.equal(f.panel().props['aria-labelledby'], 'checkin-dialog-title')
  assert.equal(f.panel().props['aria-describedby'], 'checkin-dialog-hint')
  f.focusInside()
  f.panel().props.onKeyDown({ key: 'Tab', preventDefault: () => prevented++ }); f.draw()
  assert.equal(prevented, 0); assert.ok(f.panel(), 'Tab is not trapped')
  f.panel().props.onKeyDown({ key: 'Escape', defaultPrevented: true, preventDefault: () => prevented++ }); f.draw()
  assert.equal(prevented, 0); assert.ok(f.panel(), 'already handled Escape is respected')
  f.panel().props.onKeyDown({ key: 'Escape', preventDefault: () => prevented++ }); f.draw()
  assert.equal(prevented, 1); assert.equal(f.panel(), undefined)
  f.click('Review check-in')
  f.click('Close daily check-in'); assert.equal(f.panel(), undefined)
  f.click('Review check-in'); f.click('Skip for now'); assert.equal(f.panel(), undefined)
  assert.equal(saves, 0); assert.equal(f.calls.heading, 2); assert.equal(f.calls.trigger, 3)
})

test('existing check-in actions stay reachable and successful recording does not interrupt remaining inputs', t => {
  let saves = 0
  const child = React.createElement('button', { onClick: () => saves++ }, 'Existing save')
  const f = fixture(t, { ownerId: 'save-account', date: day, recorded: false, children: child })
  f.click('Existing save'); assert.equal(saves, 1)
  f.draw({ recorded: true }); assert.ok(f.panel()); assert.equal(f.calls.heading, 0)
  f.click('Done'); f.unmount(); f.draw(); assert.equal(f.panel(), undefined)
  f.click('Review check-in'); assert.ok(f.panel())
})

test('automatic panel leaves page focus alone and does not make the page modal', t => {
  const f = fixture(t, { ownerId: 'focus-account', date: day, recorded: false })
  assert.equal(globalThis.document.activeElement, f.focusOrigin)
  assert.equal(f.calls.heading, 0); assert.equal(f.calls.trigger, 0)
  assert.equal(f.panel().type, 'div'); assert.equal(f.panel().props['aria-modal'], 'false')
  assert.equal(f.panel().props.onClick, undefined, 'no backdrop or outside-click dismissal')
  assert.equal(f.panel().props.inert, undefined)
  f.focusOutside(); f.draw()
  assert.ok(f.panel()); assert.equal(globalThis.document.activeElement, f.focusOrigin)
  assert.equal(f.calls.heading, 0)
  // A dismiss request after focus moved outside must not move page focus back.
  nodes(f.panel(), n => n.props?.['aria-label'] === 'Close daily check-in')[0].props.onClick(); f.draw()
  assert.equal(f.panel(), undefined); assert.equal(f.calls.trigger, 0)
  assert.equal(globalThis.document.activeElement, f.focusOrigin)
})

test('floating entry is hidden while open and reopens with focus without interrupting drafts', t => {
  const draft = React.createElement('input', { value: 'Draft note', readOnly: true })
  const f = fixture(t, { ownerId: 'draft-account', date: day, recorded: false, children: draft })
  assert.equal(nodes(f.draw(), n => n.props?.['aria-haspopup'] === 'dialog')[0].props.hidden, true)
  assert.equal(nodes(f.draw(), n => n.type === 'section').length, 0)
  f.click('Skip for now'); f.focusOutside(); f.click('Review check-in')
  assert.equal(globalThis.document.activeElement, f.heading); assert.equal(f.calls.heading, 1)
  const entry = nodes(f.draw(), n => n.props?.['aria-haspopup'] === 'dialog')[0]
  assert.equal(entry.props['aria-controls'], f.panel().props.id)
  assert.equal(entry.props['aria-expanded'], true)
  f.click('Skip for now'); f.click('Review check-in')
  assert.equal(nodes(f.panel(), n => n.type === 'input')[0].props.value, 'Draft note')
})

test('dismiss completion exposes one floating reopen action without creating another prompt', t => {
  const f=fixture(t,{ownerId:'completion-account',date:day,recorded:false,children:dismiss=>React.createElement('button',{onClick:dismiss},'Saved completion')})
  f.click('Saved completion');assert.equal(f.panel(),undefined)
  const entry=nodes(f.draw(),n=>n.props?.['aria-haspopup']==='dialog')[0]
  assert.equal(entry.props.hidden,false);assert.equal(entry.props.className,'checkinReopen')
  f.unmount();f.draw();assert.equal(f.panel(),undefined)
  f.click('Review check-in');assert.ok(f.panel())
})

test('Today uses the loaded local-day journal and acknowledges only successful score writes', () => {
  const source = readFileSync(new URL('../app/protocol/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /setCheckInLoadedDate\(journalError \? null : today\)/)
  assert.match(source, /ownerId=\{checkInLoadedDate === today \? checkInOwnerId : null\}/)
  assert.match(source, /recorded=\{checkInRecordedDate === today \|\| entries.some\(entry => entry.date === today\)\}/)
  const save = source.slice(source.indexOf('async function saveJournalField'), source.indexOf('function selectCompound'))
  assert.ok(save.indexOf('if (error) throw error') < save.indexOf('setCheckInRecordedDate(today)'))
  const prompt = readFileSync(new URL('../components/today/DailyCheckInPrompt.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(prompt, /localStorage|sessionStorage|createClient|supabase|fetch\(|showModal|\.show\(|document\.(body|documentElement)\.style/)
})
