import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const read = file => readFileSync(new URL(file, import.meta.url), 'utf8')
const options = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true }
function load(file, mocks = {}) {
  const url = new URL(file, import.meta.url), output = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(read(url), { compilerOptions: options }).outputText)(name => {
    if (Object.hasOwn(mocks, name)) return mocks[name]
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
    if (name.endsWith('/supabase')) throw Error('No real backend in correction tests')
    return name.startsWith('.') ? load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url), mocks) : require(name)
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
        upsert(value) { writes.push({ table, value }); return { select() { return this }, single: async () => ({ data: { weight_unit: value.weight_unit }, error: null }), then(resolve) { return Promise.resolve({ error: null }).then(resolve) } } } }
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
  assert.deepEqual(f.writes[0], { table: 'user_profiles', value: { id: 'owner', weight_unit: 'kg' } })
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
  const context = { ...load('../lib/health/protocolDates.ts'), ...load('../lib/health/dosingEntry.ts'), ...load('../lib/health/recordedDose.ts'), Blob,
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
function heroFixture() {
  function InventoryBoundary() { throw Error('Parent unit fixture must not render the inventory boundary') }
  const backend = { createClient() { throw Error('No real backend in parent correction tests') } }
  const Hero = load('../components/dashboard/HeroProtocolCard.tsx', {
    react: { ...React, useState: initial => [initial, () => {}], useEffect() {} },
    '../../lib/health/useLocalCalendarDate': { useLocalCalendarDate: () => '2026-10-05' },
    '../../lib/supabase': backend, '../supabase': backend,
    './VialInventory': { default: InventoryBoundary, __esModule: true },
  }).default
  const compounds = [
    { id: 'compound-1', name: 'Medication One', reconstitution_date: '2026-09-30', bac_water_ml: 2, vial_strength: 10, vials_in_stock: 2 },
    { id: 'compound-2', name: 'Medication Two', reconstitution_date: null, bac_water_ml: null, vial_strength: null, vials_in_stock: 0 },
    { id: 'compound-3', name: 'Medication Three', reconstitution_date: null, bac_water_ml: null, vial_strength: null, vials_in_stock: null },
    { id: 'compound-4', name: 'Medication Four', reconstitution_date: '2026-09-30', bac_water_ml: null, vial_strength: null, vials_in_stock: null },
  ].map(compound => ({ ...compound, vial_unit: 'mg', phases: [] }))
  const protocols = [
    { id: 'protocol-1', name: 'Plan One', start_date: '2026-09-01', status: 'active', compounds: compounds.slice(0, 2) },
    { id: 'protocol-2', name: 'Plan Two', start_date: '2026-09-01', status: 'active', compounds: compounds.slice(2) },
  ]
  const draw = (snapshot, selected, activeProtocols = protocols) => Hero({ activeProtocols, activeCompoundTab: selected, logs: {}, allLogs: [], totalLost: null, compoundIndex: 0, snapshot })
  return { draw, compounds, InventoryBoundary }
}
for (const snapshot of [true, false]) test(`${snapshot ? 'Today snapshot' : 'Legacy Hero card'} passes inventory for each selected compound regardless of metadata`, () => {
  const f = heroFixture()
  for (const compound of [f.compounds[0], f.compounds[1], f.compounds[2], f.compounds[3], f.compounds[0]]) {
    const tree = f.draw(snapshot, compound.id)
    const selectedSnapshot = nodes(tree).find(node => node.type?.name === 'SelectedProtocolSnapshot')
    const inventory = snapshot ? selectedSnapshot?.props.lifecycle : nodes(tree).find(node => node.type === f.InventoryBoundary)
    assert.ok(inventory, 'The actual Hero parent must pass the inventory boundary without a metadata gate')
    assert.equal(inventory.type, f.InventoryBoundary)
    assert.equal(inventory.props.compoundId, compound.id)
    assert.equal(inventory.props.compoundName, compound.name)
    assert.equal(inventory.props.presentation, snapshot ? 'status' : undefined, 'Status polish is scoped to Today')
    assert.equal(inventory.props.reconstitutionDate, compound.reconstitution_date)
    assert.equal(inventory.props.bacWaterMl, compound.bac_water_ml)
    assert.equal(inventory.props.vialStrength, compound.vial_strength)
    if (snapshot) {
      assert.equal(selectedSnapshot.props.name, compound.name)
      assert.equal(selectedSnapshot.props.protocolName, compound.id === 'compound-1' || compound.id === 'compound-2' ? 'Plan One' : 'Plan Two')
      const renderedSnapshot = selectedSnapshot.type(selectedSnapshot.props)
      assert.ok(nodes(renderedSnapshot).some(node => node.props?.className === 'today-snapshot-lifecycle'), 'The real snapshot renders its lifecycle slot')
      assert.ok(nodes(renderedSnapshot).some(node => node.type === f.InventoryBoundary), 'The real snapshot retains the inventory child')
    }
  }
})
test('Hero inventory requires an actual compound and retains fallback selection', () => {
  const f = heroFixture()
  assert.equal(f.draw(true, null, []), null)
  assert.equal(f.draw(true, null, [{ id: 'empty', compounds: [] }]), null)
  const fallback = nodes(f.draw(true, null)).find(node => node.type?.name === 'SelectedProtocolSnapshot')
  assert.equal(fallback.props.lifecycle.props.compoundId, 'compound-1')
})

// Release 4A replaces the unsafe mutation/countdown contract with non-mutating containment.
function vialFixture(t, { props = {}, stock = 2 } = {}) {
  const slots = [], effects = [], backend = [], events = []
  let slot
  const saved = Object.freeze({ id: 'compound', vials_in_stock: stock, doses_taken_override: 7,
    reconstitution_date: props.reconstitutionDate ?? null, vial_strength: props.vialStrength ?? 10,
    bac_water_ml: props.bacWaterMl ?? 2, phases: Object.freeze([{ dose: '18.00', dose_unit: 'IU', dose_semantics_version: null }]),
    logs: Object.freeze([{ date: '2020-01-01', taken: true }]) })
  const before = JSON.stringify(saved)
  const previousWindow = globalThis.window
  globalThis.window = { location: {}, dispatchEvent(event) { events.push(event.type) } }
  t.after(() => { globalThis.window = previousWindow })
  const output = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(read('../components/dashboard/VialInventory.tsx'), { compilerOptions: options }).outputText)(name => {
    if (name === 'react') return { ...React, useId: () => 'vial-fixture', useRef(initial) { const index = slot++; return slots[index] ?? (slots[index] = { current: initial }) }, useEffect(callback) { effects.push(callback) }, useState(initial) {
      const index = slot++; if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value }]
    } }
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => String(key) })
    if (name.endsWith('/supabase')) return { createClient() { backend.push('client'); throw Error('Containment must not access the backend') } }
    return name.startsWith('.') ? load(new URL(name + '.ts', new URL('../components/dashboard/VialInventory.tsx', import.meta.url))) : require(name)
  }, output, output.exports)
  const draw = () => { slot = 0; effects.length = 0; return output.exports.default({ compoundId: 'compound', compoundName: 'Medication', reconstitutionDate: '2026-09-01', bacWaterMl: 2, vialStrength: 10, vialUnit: 'mg', vials_in_stock: stock, ...props }) }
  const button = label => nodes(draw()).find(node => node.type === 'button' && node.props.children === label)
  const runEffects = () => { for (const effect of [...effects]) effect() }
  draw(); runEffects()
  return { draw, backend, events, button, saved, before,
    open() { button('+ New Vial').props.onClick(); draw(); runEffects() },
    preserved() { assert.deepEqual(backend, []); assert.deepEqual(events, []); assert.equal(JSON.stringify(saved), before); assert.deepEqual(globalThis.window.location, {}) },
  }
}
const textContent = tree => Array.isArray(tree) ? tree.map(textContent).join('') : tree && typeof tree === 'object' ? textContent(tree.props?.children) : tree == null || typeof tree === 'boolean' ? '' : String(tree)
for (const date of ['2026-09-23', '2026-10-05', '2026-09-08', '2026-08-12', '2026-09-06', '2026-09-07', undefined, '', 'invalid']) {
  test(`Today vial status preserves recorded date ${date ?? 'missing'} without inventing expiration`, t => {
    const f = vialFixture(t, { props: { presentation: 'status', reconstitutionDate: date } })
    const tree = f.draw(), find = className => nodes(tree).find(node => node.props?.className === className)
    const valid = date && date !== 'invalid'
    assert.equal(textContent(find('vial-lifecycle-title')), 'VIAL STATUS')
    assert.equal(textContent(find('vial-lifecycle-status')), valid ? 'Reconstituted ' + load('../lib/health/protocolPresentation.ts').dateLabel(date) : 'Reconstitution date not recorded')
    assert.match(textContent(tree), /Expiration unknown/)
    assert.ok(nodes(tree).some(node => node.props?.['aria-label'] === 'Expiration unknown. No expiration or beyond-use date is recorded for this vial.'))
    assert.doesNotMatch(textContent(tree), /Expired|EXPIRED|days left|Day \d+|NaN/)
    assert.equal(find('vial-lifecycle-track'), undefined)
    assert.ok(f.button('+ New Vial')); assert.notEqual(f.button('+ New Vial').props.disabled, true)
    f.open(); assert.ok(nodes(f.draw()).some(node => node.type === 'dialog')); f.preserved()
  })
}
for (const scenario of [
  { name: 'recorded date', props: { reconstitutionDate: '2026-09-30' } },
  { name: 'old date', props: { reconstitutionDate: '2026-08-01' } },
  { name: 'missing date', props: { reconstitutionDate: undefined } },
  { name: 'empty date', props: { reconstitutionDate: '' } },
  { name: 'invalid date', props: { reconstitutionDate: 'invalid' } },
  { name: 'missing BAC water', props: { bacWaterMl: undefined } },
  { name: 'missing strength', props: { vialStrength: undefined } },
  { name: 'missing strength and water', props: { bacWaterMl: undefined, vialStrength: undefined } },
  { name: 'zero stock', stock: 0 },
  { name: 'unknown stock', stock: null },
  { name: 'missing metadata and zero stock', props: { reconstitutionDate: undefined, bacWaterMl: undefined, vialStrength: undefined }, stock: 0 },
  { name: 'missing metadata and unknown stock', props: { reconstitutionDate: undefined, bacWaterMl: undefined, vialStrength: undefined }, stock: null },
]) test(`New Vial explains containment with ${scenario.name} and preserves all recorded values`, t => {
  const f = vialFixture(t, scenario)
  assert.equal(f.button('+ New Vial').props['aria-haspopup'], 'dialog')
  assert.notEqual(f.button('+ New Vial').props.disabled, true)
  f.open()
  const dialog = nodes(f.draw()).find(node => node.type === 'dialog')
  assert.equal(dialog.props['aria-modal'], 'true')
  assert.equal(textContent(nodes(dialog).find(node => node.props?.id === dialog.props['aria-labelledby'])), 'Starting a new vial is temporarily unavailable')
  assert.match(textContent(nodes(dialog).find(node => node.props?.id === dialog.props['aria-describedby'])), /preserve your previous Medication vial details.*No stock, preparation details or dose counters have changed/)
  assert.equal(nodes(dialog).some(node => ['input', 'select', 'textarea'].includes(node.type)), false)
  assert.equal(f.button('Log New Vial'), undefined)
  assert.equal(nodes(dialog).find(node => node.type === 'a').props.href, '/protocol/manage')
  assert.equal(textContent(nodes(dialog).find(node => node.type === 'a')), 'View protocols')
  f.preserved()
  f.button('Close').props.onClick()
  assert.equal(nodes(f.draw()).some(node => node.type === 'dialog'), false)
  f.preserved();assert.equal(f.saved.vials_in_stock, Object.hasOwn(scenario, 'stock') ? scenario.stock : 2)
})
test('New Vial containment supports native Escape cancellation and repeated opening without backend effects', t => {
  const f = vialFixture(t, { stock: null })
  for (let i = 0; i < 3; i++) {
    f.open();const dialog = nodes(f.draw()).find(node => node.type === 'dialog')
    let prevented = false
    dialog.props.onCancel({ preventDefault() { prevented = true } })
    assert.equal(prevented, true);assert.equal(nodes(f.draw()).some(node => node.type === 'dialog'), false)
    f.preserved()
  }
  assert.equal(f.saved.vials_in_stock, null)
})