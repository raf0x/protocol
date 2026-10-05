import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const options = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
function load(file) {
  const url = new URL(file, import.meta.url), output = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(read(url), { compilerOptions: options }).outputText)(name => {
    if (name.endsWith('/supabase')) throw Error('No real backend in correction tests')
    return name.startsWith('.') ? load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url)) : require(name)
  }, output, output.exports)
  return output.exports
}
const ast = ts.createSourceFile('page.tsx', read('../app/protocol/page.tsx'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
function pageHandler(name, context) {
  let found
  function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === name) found = node.getText(ast); ts.forEachChild(node, visit) }
  visit(ast); assert.ok(found, name)
  return new Function('context', 'with(context){' + ts.transpileModule(found, { compilerOptions: options }).outputText + ';return ' + name + '}')(context)
}

function weightFixture(draft = '180', unit = 'lbs') {
  const writes = []
  const context = { weight: draft, weightUnit: unit, sleep: '', entryNotes: '', today: '2026-10-04',
    ...load('../lib/weightUtils.ts'), navigator: {},
    setWeight(value) { context.weight = typeof value === 'function' ? value(context.weight) : value },
    setWeightUnit(value) { context.weightUnit = value }, setSaving() {}, setSaved() {}, loadAll() {},
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) }, from(table) {
      return { update(value) { writes.push({ table, value }); return this }, eq: async () => ({ error: null }),
        upsert: async value => { writes.push({ table, value }); return { error: null } } }
    } }),
  }
  return { context, writes, toggle: pageHandler('toggleWeightUnit', context), save: pageHandler('saveEntry', context) }
}
test('unit switch converts the current check-in draft and saves canonical pounds once', async () => {
  const f = weightFixture()
  await f.toggle()
  assert.equal(f.context.weightUnit, 'kg'); assert.equal(f.context.weight, '81.6')
  assert.equal(await f.save(), true)
  const journal = f.writes.filter(write => write.table === 'journal_entries')
  assert.equal(journal.length, 1)
  assert.ok(Math.abs(journal[0].value.weight - 180) < .2, '81.6 kg is saved as about 180 canonical pounds')
  assert.deepEqual(f.writes[0], { table: 'user_profiles', value: { weight_unit: 'kg' } })
})
test('unit round trip and an edited draft retain their meaning', async () => {
  const f = weightFixture()
  await f.toggle(); await f.toggle()
  assert.equal(f.context.weightUnit, 'lbs'); assert.equal(f.context.weight, '180')
  await f.save()
  assert.equal(f.writes.at(-1).value.weight, 180)
  f.context.weight = '200'
  await f.toggle()
  assert.equal(f.context.weight, '90.7', 'Convert the current draft, not the previously saved entry')
})
test('unit switch preserves blank and invalid drafts without inventing a numeric value', async () => {
  for (const draft of ['', '  ', 'invalid', '1e', 'Infinity']) {
    const f = weightFixture(draft)
    await f.toggle(); assert.equal(f.context.weight, draft)
    await f.toggle(); assert.equal(f.context.weight, draft)
  }
  const blank = weightFixture('')
  await blank.toggle(); await blank.save()
  assert.equal(Object.hasOwn(blank.writes.at(-1).value, 'weight'), false)
})

async function exportedRows(start, phases = []) {
  let blob
  const protocol = { id: 'p', name: 'Plan', status: 'completed', start_date: start,
    compounds: [{ name: 'Medication', phases, injection_logs: [], vial_strength: 10, ml_per_dose: .1 }] }
  const context = { ...load('../lib/health/protocolDates.ts'), ...load('../lib/health/dosingEntry.ts'), Blob,
    createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
      from: table => { assert.equal(table, 'protocols'); return { select() { return this }, eq: async () => ({ data: [protocol] }) } } }),
    window: { URL: { createObjectURL(value) { blob = value; return 'blob:fixture' }, revokeObjectURL() {} }, setTimeout(callback) { callback() } },
    document: { createElement: () => ({ style: {}, click() {}, remove() {} }), body: { appendChild() {} } },
    alert() { throw Error('Unexpected empty export') },
  }
  await pageHandler('exportToCSV', context)()
  return (await blob.text()).trim().split('\n').slice(1).map(row => row.split(','))
}
for (const timezone of ['America/New_York', 'Pacific/Kiritimati']) {
  test(`CSV preserves calendar-only start and phase dates in ${timezone}`, async () => {
    const previous = process.env.TZ
    try {
      process.env.TZ = timezone
      for (const [date, expected] of [['2026-09-01', '9/1/2026'], ['2027-01-01', '1/1/2027'], ['2026-03-08', '3/8/2026']]) {
        assert.equal((await exportedRows(date))[0][5], expected)
        assert.equal((await exportedRows(date, [{ dose: 5, dose_unit: 'mg', start_week: 1, end_week: 2 }]))[0][5], expected)
      }
      const boundary = (await exportedRows('2026-12-29', [{ dose: 5, start_week: 2, end_week: 3 }]))[0]
      assert.equal(boundary[5], '1/5/2027'); assert.equal(boundary[6], '1/12/2027')
      const dst = (await exportedRows('2026-11-01', [{ dose: 5, start_week: 2, end_week: 3 }]))[0]
      assert.equal(dst[5], '11/8/2026'); assert.equal(dst[6], '11/15/2026')
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
  })
  test(`CSV retains timestamp formatting and phase offsets in ${timezone}`, async () => {
    const previous = process.env.TZ
    try {
      process.env.TZ = timezone
      const value = '2026-09-01T00:30:00Z', start = new Date(value)
      assert.equal((await exportedRows(value))[0][5], start.toLocaleDateString('en-US'))
      const row = (await exportedRows(value, [{ dose: 5, start_week: 2, end_week: 3 }]))[0]
      assert.equal(row[5], new Date(start.getTime() + 7 * 86400000).toLocaleDateString('en-US'))
      assert.equal(row[6], new Date(start.getTime() + 14 * 86400000).toLocaleDateString('en-US'))
    } finally { if (previous === undefined) delete process.env.TZ; else process.env.TZ = previous }
  })
}

const nodes = tree => Array.isArray(tree) ? tree.flatMap(nodes) : tree && typeof tree === 'object' ? [tree, ...nodes(tree.props?.children)] : []
function vialFixture(t, { props = {}, stock: initialStock = 2 } = {}) {
  const slots = [], effects = [], writes = [], events = [], listeners = new Map()
  let slot, stock = initialStock, outcome = 'success', release
  const previousWindow = globalThis.window
  globalThis.window = { location: {}, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: name => listeners.delete(name),
    dispatchEvent(event) { events.push(event.type); listeners.get(event.type)?.() } }
  t.after(() => { globalThis.window = previousWindow })
  const output = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(read('../components/dashboard/VialInventory.tsx'), { compilerOptions: options }).outputText)(name => {
    if (name === 'react') return { ...React, useId: () => 'vial-fixture', useRef(initial) { const index = slot++; return slots[index] ?? (slots[index] = { current: initial }) }, useEffect(callback) { effects.push(callback) }, useState(initial) {
      const index = slot++; if (!(index in slots)) slots[index] = initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    } }
    if (name.endsWith('.module.css')) return { newVialDialog: 'newVialDialog' }
    if (name.endsWith('/supabase')) return { createClient: () => ({ from(table) {
      assert.equal(table, 'compounds'); let value
      return { select() { return this }, update(input) { value = input; return this }, eq(key, id) {
        assert.equal(key, 'id'); assert.equal(id, 'compound')
        if (!value) return this
        writes.push({ ...value })
        return (async () => {
          if (outcome === 'pending') await new Promise(resolve => { release = resolve })
          if (outcome === 'throw') throw Error('Offline')
          if (outcome === 'error') return { error: { message: 'Rejected' } }
          stock = value.vials_in_stock; return { error: null }
        })()
      }, single: async () => ({ data: { vials_in_stock: stock } }) }
    } }) }
    return name.startsWith('.') ? load(new URL(name + '.ts', new URL('../components/dashboard/VialInventory.tsx', import.meta.url))) : require(name)
  }, output, output.exports)
  const draw = () => { slot = 0; effects.length = 0; return output.exports.default({ compoundId: 'compound', compoundName: 'Medication', reconstitutionDate: '2026-09-01', bacWaterMl: 2, vialStrength: 10, vialUnit: 'mg', ...props }) }
  let tree = draw()
  for (const effect of [...effects]) effect()
  const button = label => nodes(draw()).find(node => node.type === 'button' && node.props.children === label)
  return { draw, writes, events, button, setOutcome(value) { outcome = value }, resolve() { outcome = 'success'; release() },
    async ready() { await Promise.resolve(); tree = draw(); assert.ok(button('+ New Vial')) },
    async open() { await button('+ New Vial').props.onClick() },
    inputs: () => nodes(draw()).filter(node => node.type === 'input'),
    alert: () => nodes(draw()).find(node => node.props?.role === 'alert'),
  }
}
const textContent = tree => Array.isArray(tree) ? tree.map(textContent).join('') : tree && typeof tree === 'object' ? textContent(tree.props?.children) : tree == null || typeof tree === 'boolean' ? '' : String(tree)
for (const scenario of [
  { name: 'recorded date', props: { reconstitutionDate: '2026-09-30' }, lifecycle: true },
  { name: 'expired date', lifecycle: true, expired: true },
  { name: 'missing date', props: { reconstitutionDate: undefined } },
  { name: 'empty date', props: { reconstitutionDate: '' } },
  { name: 'invalid date', props: { reconstitutionDate: 'invalid' } },
  { name: 'missing BAC water', props: { bacWaterMl: undefined }, lifecycle: true },
  { name: 'missing strength', props: { vialStrength: undefined }, lifecycle: true },
  { name: 'missing strength and water', props: { bacWaterMl: undefined, vialStrength: undefined }, lifecycle: true },
  { name: 'zero stock', stock: 0, lifecycle: true },
  { name: 'unknown stock', stock: null, lifecycle: true },
  { name: 'missing metadata and zero stock', props: { reconstitutionDate: undefined, bacWaterMl: undefined, vialStrength: undefined }, stock: 0 },
  { name: 'missing metadata and unknown stock', props: { reconstitutionDate: undefined, bacWaterMl: undefined, vialStrength: undefined }, stock: null },
]) test(`New Vial stays available with ${scenario.name} and only shows calculable lifecycle data`, async t => {
  t.mock.method(Date, 'now', () => new Date('2026-10-05T12:00:00').getTime())
  const f = vialFixture(t, scenario)
  assert.equal(f.button('+ New Vial'), undefined, 'Inventory loading behavior is retained')
  await f.ready()
  const tree = f.draw(), find = className => nodes(tree).find(node => node.props?.className === className)
  assert.equal(textContent(find('vial-lifecycle-title')), 'VIAL LIFECYCLE')
  assert.equal(f.button('+ New Vial').props['aria-haspopup'], 'dialog')
  assert.equal(Boolean(find('vial-lifecycle-status')), Boolean(scenario.lifecycle))
  assert.equal(Boolean(find('vial-lifecycle-track')), Boolean(scenario.lifecycle))
  assert.equal(find('vial-lifecycle-toolbar').props.style.marginBottom, scenario.lifecycle ? '6px' : '0')
  if (scenario.name === 'recorded date') {
    assert.match(textContent(find('vial-lifecycle-status')), /Day 5\/28.*23d left/)
    assert.ok(Math.abs(parseFloat(find('vial-lifecycle-track').props.children.props.style.width) - 17.857142857142858) < .001)
  }
  if (scenario.expired) {
    assert.match(textContent(find('vial-lifecycle-status')), /Day 34\/28.*EXPIRED/)
    assert.equal(find('vial-lifecycle-track').props.children.props.style.width, '100%')
  }
  if (!scenario.lifecycle) assert.doesNotMatch(textContent(tree), /Day |d left|EXPIRED|NaN/)
  await f.open()
  const dialog = nodes(f.draw()).find(node => node.type === 'dialog')
  assert.ok(dialog, 'Existing confirmation opens regardless of metadata or stock')
  assert.equal(dialog.props['aria-modal'], 'true')
  assert.equal(textContent(nodes(dialog).find(node => node.props?.id === dialog.props['aria-labelledby'])), 'Starting a new Medication vial?')
  for (const field of f.inputs()) assert.ok(nodes(dialog).some(node => node.type === 'label' && node.props.htmlFor === field.props.id))
  if (Object.hasOwn(scenario.props ?? {}, 'vialStrength')) assert.equal(f.inputs()[0].props.value, '')
  if (Object.hasOwn(scenario.props ?? {}, 'bacWaterMl')) assert.equal(f.inputs()[2].props.value, '')
  assert.deepEqual(f.writes, [], 'Opening the dialog does not save inventory')
  assert.deepEqual(f.events, [])
})

test('New Vial success retains its payload, closes confirmation and dispatches doses_updated', async t => {
  const f = vialFixture(t); await f.ready(); await f.open()
  f.inputs().find(input => input.props.type === 'date').props.onChange({ target: { value: '2026-10-03' } })
  await f.button('Log New Vial').props.onClick()
  assert.deepEqual(f.writes, [{ vials_in_stock: 1, doses_taken_override: 0, reconstitution_date: '2026-10-03', bac_water_ml: 2, vial_strength: 10 }])
  assert.deepEqual(f.events, ['doses_updated']); assert.equal(f.button('Log New Vial'), undefined)
  assert.equal(f.alert(), undefined)
})
for (const outcome of ['error', 'throw']) test(`New Vial ${outcome} preserves values and count, shows error, releases saving and permits retry`, async t => {
  const f = vialFixture(t); await f.ready(); await f.open()
  const values = ['10.0', '2026-10-03', '2.0']
  f.inputs().forEach((input, index) => input.props.onChange({ target: { value: values[index] } }))
  f.setOutcome(outcome); await f.button('Log New Vial').props.onClick()
  assert.ok(f.button('Log New Vial'), 'Confirmation remains open')
  assert.equal(f.button('Log New Vial').props.disabled, false)
  assert.deepEqual(f.inputs().map(input => input.props.value), values)
  assert.match(f.alert().props.children, /wasn’t saved.*try again/)
  assert.deepEqual(f.events, [])
  f.setOutcome('success'); await f.button('Log New Vial').props.onClick()
  assert.deepEqual(f.writes[1], f.writes[0], 'Failure did not decrement local stock or change the retry payload')
  assert.deepEqual(f.events, ['doses_updated']); assert.equal(f.button('Log New Vial'), undefined)
  await f.open(); await f.button('Log New Vial').props.onClick()
  assert.equal(f.writes[2].vials_in_stock, 0, 'Successful retry advanced local inventory once')
})
test('New Vial shows saving while an update is pending', async t => {
  const f = vialFixture(t); await f.ready(); await f.open(); f.setOutcome('pending')
  const save = f.button('Log New Vial').props.onClick()
  assert.equal(f.button('Saving...').props.disabled, true)
  assert.deepEqual(f.events, [])
  f.resolve(); await save
  assert.equal(f.button('Log New Vial'), undefined); assert.deepEqual(f.events, ['doses_updated'])
})

test('New Vial uses a named native modal dialog with labelled fields', async t => {
  const f = vialFixture(t); await f.ready(); await f.open()
  const dialog = nodes(f.draw()).find(node => node.type === 'dialog')
  assert.ok(dialog)
  assert.equal(dialog.props['aria-modal'], 'true')
  const heading = nodes(dialog).find(node => node.type === 'h3')
  assert.equal(dialog.props['aria-labelledby'], heading.props.id)
  assert.deepEqual(heading.props.children, ['Starting a new ', 'Medication', ' vial?'])
  for (const field of f.inputs()) assert.ok(nodes(dialog).some(node => node.type === 'label' && node.props.htmlFor === field.props.id))
  let prevented = false
  dialog.props.onCancel({ preventDefault() { prevented = true } })
  assert.equal(prevented, true)
  assert.equal(nodes(f.draw()).some(node => node.type === 'dialog'), false)
})
