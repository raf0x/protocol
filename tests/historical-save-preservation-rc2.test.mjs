import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
function load(path) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name.endsWith('.css')) return {}
    if (!name.startsWith('.')) return require(name)
    return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url).href)
  }, out, out.exports)
  cache.set(url.href, out.exports)
  return out.exports
}
const form = load('../lib/protocols/form.ts')
const { entryFromForm, entryFormState } = load('../lib/health/dosingEntry.ts')

function synthetic(preparation = 'ready', date = '2026-10-01') {
  const phase = { id: '00000000-0000-0000-0000-000000000003', start_week: 1, end_week: null, duration_weeks: null, frequency: 'daily', days_of_week: [0, 1, 2, 3, 4, 5, 6], day_of_week: 0, time_of_day: 'morning', route: 'SubQ', dosing_entry: entryFromForm({ input_mode: 'medication', preparation, isPreMixed: preparation === 'ready', dose: '2', dose_unit: 'mg', syringe_scale: '', reviewed: true, vial_strength: preparation === 'mixing' ? '10' : '', vial_unit: preparation === 'mixing' ? 'mg' : '', bac_water_ml: preparation === 'mixing' ? '2' : '' }) }
  const compound = { id: '00000000-0000-0000-0000-000000000002', name: 'Synthetic compound', vial_strength: 10, vial_unit: 'mg', bac_water_ml: 2, reconstitution_date: date, notes: 'Original synthetic note', vials_in_stock: 0, phases: [phase] }
  return { compound, phase }
}
function hydrate(compound, phase, capture = true) {
  const preparation = { isPreMixed: !compound.vial_strength && !compound.bac_water_ml && !compound.reconstitution_date, vial_strength: compound.vial_strength?.toString() || '', vial_unit: compound.vial_unit || '', bac_water_ml: compound.bac_water_ml?.toString() || '' }
  const draft = { ...form.newCompound(), id: compound.id, name: compound.name, phase_id: phase.id, phase_start_week: String(phase.start_week || 1), duration_weeks: phase.end_week == null ? '' : String(phase.end_week - (phase.start_week || 1) + 1), reconstitution_date: compound.reconstitution_date || '', notes: compound.notes || '', vials_in_stock: compound.vials_in_stock?.toString() || '', route: phase.route || '', frequency_mode: 'weekly', days_of_week: phase.days_of_week || [], time_of_day: 'Morning', ...preparation, ...entryFormState(phase, preparation) }
  return capture ? form.captureHistoricalCompound(draft, compound, phase) : draft
}

test('RC2: actual editor hydration and payload preserve a recorded date for a ready-to-use phase', () => {
  const { compound, phase } = synthetic()
  const before = structuredClone({ compound, phase })
  const draft = hydrate(compound, phase)
  const payload = form.protocolCompoundPayload([draft])[0]
  const evidence = { syntheticOnly: true, sourceDate: compound.reconstitution_date, hydratedPreparation: draft.preparation, hydratedIsPreMixed: draft.isPreMixed, payload, databaseAccess: false }
  if (process.env.RC2_PAYLOAD_EVIDENCE) writeFileSync(process.env.RC2_PAYLOAD_EVIDENCE, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' })
  assert.equal(draft.isPreMixed, true, 'historical ready-to-use semantics hydrate unchanged')
  assert.equal(Object.hasOwn(payload, 'reconstitution_date'), false, 'untouched date is omitted so the unchanged RPC preserves the recorded fact')
  assert.deepEqual({ compound, phase }, before, 'hydration and serialization must not mutate source records')
})
import React from 'react'
import { pathToFileURL } from 'node:url'

function text(node) {
  if (Array.isArray(node)) return node.map(text).join('')
  return React.isValidElement(node) ? text(node.props.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : ''
}
function editor(protocol, rpcResult = { data: protocol.id, error: null, status: 200 }) {
  const states = [], refs = [], calls = []; let slot = 0, refSlot = 0
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'synthetic-owner' } } }) },
    from: () => ({ select: () => ({ eq() { return this }, order: async () => ({ data: [protocol] }) }) }),
    rpc: async (name, args) => { calls.push({ name, args }); if (rpcResult instanceof Error) throw rpcResult; return rpcResult },
  }
  const hooks = { useEffect() {}, useRef(initial) { return refs[refSlot++] ?? (refs[refSlot - 1] = { current: initial }) }, useState(initial) { const i = slot++; if (!(i in states)) states[i] = i === 1 ? false : i === 2 ? [protocol] : typeof initial === 'function' ? initial() : initial; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] } }
  const url = new URL('../app/protocol/manage/page.tsx', import.meta.url), out = { exports: {} }
  const mutations = load('../lib/health/protocolMutations.ts')
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'react') return { ...React, ...hooks }
    if (name === 'next/navigation') return { useRouter: () => ({ push() {} }) }
    if (name.endsWith('/useLocalCalendarDate')) return { useLocalCalendarDate: () => new Date().toLocaleDateString('en-CA') }
    if (name.endsWith('/supabase')) return { createClient: () => client }
    if (name.endsWith('/inventory/client')) return { loadInventory: async () => [] }
    if (name.endsWith('/protocolMutations')) return { ...mutations, saveProtocolWithEvents: input => mutations.saveProtocolWithEvents(input, client) }
    if (name.endsWith('.css')) return {}
    if (!name.startsWith('.')) return require(name)
    return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url).href)
  }, out, out.exports)
  function render() {
    slot = 0; refSlot = 0; const nodes = []
    function visit(node) { if (Array.isArray(node)) return node.forEach(visit); if (!React.isValidElement(node)) return; nodes.push(node); visit(node.props.children) }
    visit(out.exports.default()); return nodes
  }
  const result = { calls, render, field: (label, index = 0) => render().filter(node => node.props['aria-label'] === label)[index], button: label => render().find(node => node.type === 'button' && text(node.props.children) === label), input(label, value, index = 0) { const field = this.field(label, index); assert.ok(field, label); field.props.onChange({ target: { value } }) }, open() { render().find(node => node.props.onOpen).props.onOpen(protocol.id); render().find(node => node.props.onEdit).props.onEdit() }, alerts() { return render().filter(node => node.props.role === 'alert').map(node => text(node.props.children)).join('\n') } }
  return result
}
function protocolFixture(compounds = [synthetic().compound]) {
  return { id: '00000000-0000-0000-0000-000000000001', name: 'Synthetic protocol', status: 'active', start_date: '2026-01-01', compounds }
}
async function withEditor(protocol, action, result) {
  const previous = globalThis.window
  globalThis.window = { scrollTo() {}, location: { search: '' } }
  try { const h = editor(protocol, result); h.open(); return await action(h) } finally { globalThis.window = previous }
}

for (const preparation of ['ready', 'mixing']) {
  for (const edit of ['no-op', 'notes-only', 'dose-only', 'schedule-only']) test(`RC2: actual ${preparation} editor ${edit} save preserves historical compound facts`, async () => {
    const { compound, phase } = synthetic(preparation), before = structuredClone(compound)
    await withEditor(protocolFixture([compound]), async h => {
      if (edit === 'notes-only') h.input('Notes', 'Changed synthetic notes')
      if (edit === 'dose-only') h.input('Medication dose', '3')
      if (edit === 'schedule-only') h.button('Evening').props.onClick()
      await h.button('Save changes').props.onClick()
      assert.equal(h.calls.length, 1, h.alerts())
      assert.equal(h.calls[0].args.p_name, 'Synthetic protocol', 'unrelated edits preserve the existing protocol name')
      const payload = h.calls[0].args.p_compounds[0]
      assert.equal(Object.hasOwn(payload, 'reconstitution_date'), false)
      assert.equal(payload.id, compound.id); assert.equal(payload.phase.id, phase.id)
      assert.equal(Object.hasOwn(payload, 'vials_in_stock'), false)
      if (edit !== 'dose-only') assert.deepEqual(payload.phase.dosing_entry, phase.dosing_entry)
      else { const expected = { ...phase.dosing_entry, dose: '3', review_status: 'unverified' }; assert.deepEqual(payload.phase.dosing_entry, expected) }
      assert.equal(payload.phase.route, phase.route)
      assert.deepEqual(payload.phase.days_of_week, phase.days_of_week)
      assert.equal(payload.phase.time_of_day, edit === 'schedule-only' ? 'evening' : phase.time_of_day)
      assert.deepEqual(compound, before, 'source record is not changed by editor/save')
    })
  })
}

test('RC2: independent dates, null stock and explicit zero survive a multi-compound ordinary save', async () => {
  const a = synthetic('ready', '2026-10-01').compound, b = synthetic('mixing', '2026-09-21').compound
  b.id = '00000000-0000-0000-0000-000000000012'; b.phases[0].id = '00000000-0000-0000-0000-000000000013'; b.vials_in_stock = null
  await withEditor(protocolFixture([a, b]), async h => {
    await h.button('Save changes').props.onClick()
    assert.equal(h.calls.length, 1, h.alerts())
    const rows = h.calls[0].args.p_compounds
    assert.ok(rows.every(row => !Object.hasOwn(row, 'reconstitution_date') && !Object.hasOwn(row, 'vials_in_stock')))
    assert.deepEqual([a.reconstitution_date, b.reconstitution_date], ['2026-10-01', '2026-09-21'])
    assert.deepEqual([a.vials_in_stock, b.vials_in_stock], [0, null])
  })
})

test('RC2: cancellation of deliberate edits never sends an RPC or changes loaded records', async () => {
  const protocol = protocolFixture(), before = structuredClone(protocol)
  await withEditor(protocol, async h => {
    h.input('Notes', 'Discard this note'); h.input('Medication dose', '12')
    h.button('Cancel').props.onClick()
    assert.equal(h.calls.length, 0); assert.deepEqual(protocol, before); assert.equal(h.button('Save changes'), undefined)
    h.open(); assert.equal(h.field('Notes').props.value, before.compounds[0].notes); assert.equal(h.field('Medication dose').props.value, '2')
  })
})

for (const outcome of [{ error: { code: 'P0001', message: 'Synthetic persistence rejection' }, status: 400 }, new Error('Synthetic network failure')]) test(`RC2: ${outcome instanceof Error ? 'unknown failure' : 'known rejection'} keeps draft and recorded facts`, async () => {
  const protocol = protocolFixture(), before = structuredClone(protocol)
  await withEditor(protocol, async h => {
    h.input('Notes', 'Keep this unsaved note')
    await h.button('Save changes').props.onClick()
    assert.equal(h.calls.length, 1, h.alerts())
    assert.ok(h.button('Save changes')); assert.equal(h.field('Notes').props.value, 'Keep this unsaved note')
    assert.match(h.alerts(), outcome instanceof Error ? /Unable to confirm the save/ : /Synthetic persistence rejection/)
    assert.equal(Object.hasOwn(h.calls[0].args.p_compounds[0], 'reconstitution_date'), false)
    assert.deepEqual(protocol, before)
  }, outcome)
})

async function syntheticDatabase() {
  const runtime = process.env.DOSING_PGLITE_PATH ? pathToFileURL(process.env.DOSING_PGLITE_PATH) : pathToFileURL(require.resolve('@electric-sql/pglite'))
  const { PGlite } = await import(runtime.href), db = new PGlite()
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated;
    CREATE TABLE protocols(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,name text,start_date date NOT NULL,
      status text DEFAULT 'active' CHECK(status IN ('active','paused','completed','stopped')),completed_date timestamptz,continued_from_protocol_id uuid);
    CREATE TABLE compounds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,protocol_id uuid REFERENCES protocols(id),name text,
      vial_strength numeric,vial_unit text,bac_water_ml numeric,reconstitution_date date,notes text,vials_in_stock int,ml_per_dose numeric);
    CREATE TABLE phases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,compound_id uuid REFERENCES compounds(id),name text,
      dose numeric,dose_unit text,start_week int,end_week int,duration_weeks int,frequency text,days_of_week int[],day_of_week int,time_of_day text);
    CREATE TABLE protocol_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,protocol_id uuid,compound_id uuid,date date NOT NULL,event_type text,description text);
    CREATE TABLE injection_logs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),compound_id uuid,dose numeric,observed_at timestamptz,notes text);`)
  for (const file of ['202609090001_dosing_semantics_v1.sql', '202609100001_advisory_dosing.sql', '202609110001_continue_latest_phase.sql', '202609140001_structured_protocol_events.sql', '202609160001_historical_protocol_context_v1.sql', '202609200001_planned_protocols.sql', '202609220001_protocol_save_dates.sql', '202609230001_protocol_edit_date_hotfix.sql', '202609240001_scheduled_protocols.sql', '202609260001_restore_preparation_fingerprint.sql']) await db.exec(readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'))
  await db.exec("SET app.user_id='00000000-0000-0000-0000-000000000099'; SET timezone='UTC'")
  return db
}

test('RC2: current RPC preserves corrected editor payloads and atomically rejects invalid historical writes', async t => {
  const db = await syntheticDatabase(), evidence = []
  const evidenceView = (snapshot, ids) => ({ compound: snapshot.compounds.find(row => row.id === ids.cid), selectedPhase: snapshot.phases.find(row => row.id === ids.phid), otherPhases: snapshot.phases.filter(row => row.compound_id === ids.cid && row.id !== ids.phid), injectionLogs: snapshot.injection_logs.filter(row => row.compound_id === ids.cid), protocolEventIds: snapshot.protocol_events.filter(row => row.protocol_id === ids.id).map(row => row.id) })
  const save = async (id, rows) => (await db.query('SELECT save_protocol_with_events_v2($1,$2,$3,$4::jsonb) AS id', [id, 'Synthetic protocol', '2026-01-01', JSON.stringify(rows)])).rows[0].id
  const state = async () => {
    const result = {}
    for (const table of ['protocols', 'compounds', 'phases', 'protocol_events', 'injection_logs']) result[table] = (await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows
    return result
  }
  async function seed(preparation = 'ready', custom = {}) {
    const fixture = synthetic(preparation), draft = { ...hydrate(fixture.compound, fixture.phase, false), id: undefined, phase_id: undefined }
    const rows = form.protocolCompoundPayload([draft]), id = await save(null, rows)
    const compound = (await db.query('SELECT * FROM compounds WHERE protocol_id=$1', [id])).rows[0]
    await db.query("UPDATE compounds SET vial_strength=10,vial_unit='mg',bac_water_ml=2,reconstitution_date='2026-10-01',vials_in_stock=0 WHERE id=$1", [compound.id])
    const phase = (await db.query('SELECT * FROM phases WHERE compound_id=$1', [compound.id])).rows[0]
    const entry = { ...phase.dosing_entry, dose: '2.00', legacy_observation: 'Synthetic historical observation', ...custom }
    await db.query('UPDATE phases SET dosing_entry=$1::jsonb WHERE id=$2', [JSON.stringify(entry), phase.id])
    await db.query("INSERT INTO phases(user_id,compound_id,name,dose,dose_unit,dose_semantics_version,start_week,end_week,duration_weeks,frequency) VALUES(auth.uid(),$1,'Synthetic unselected historical phase',4,'mg',1,200,201,2,'daily')", [compound.id])
    await db.query("INSERT INTO injection_logs(compound_id,dose,observed_at,notes) VALUES($1,2,'2026-10-02T09:00:00Z','Synthetic observation: retain exactly')", [compound.id])
    return { id, cid: compound.id, phid: phase.id }
  }
  async function record(ids) {
    const compound = (await db.query('SELECT *,reconstitution_date::text AS reconstitution_date FROM compounds WHERE id=$1', [ids.cid])).rows[0]
    compound.phases = (await db.query('SELECT * FROM phases WHERE compound_id=$1 ORDER BY start_week', [ids.cid])).rows
    return { ...protocolFixture([compound]), id: ids.id }
  }
  async function payload(protocol, change = () => {}) {
    return withEditor(protocol, async h => { change(h); await h.button('Save changes').props.onClick(); assert.equal(h.calls.length, 1, h.alerts()); return h.calls[0].args.p_compounds })
  }
  try {
    await t.test('documented unsafe null clears the date, omission preserves it in the unchanged RPC', async () => {
      const ids = await seed(), original = await record(ids)
      const row = { id: ids.cid, name: original.compounds[0].name, phase: { ...original.compounds[0].phases[0], id: ids.phid } }
      await save(ids.id, [row]); const afterOmission = (await record(ids)).compounds[0].reconstitution_date; assert.equal(afterOmission, '2026-10-01')
      await save(ids.id, [{ ...row, reconstitution_date: null }]); const afterNull = (await record(ids)).compounds[0].reconstitution_date; assert.equal(afterNull, null)
      evidence.push({ case: 'unchanged RPC date presence contract', sourceDate: original.compounds[0].reconstitution_date, afterOmission, afterExplicitNull: afterNull })
    })
    for (const preparation of ['ready', 'mixing']) await t.test(`${preparation}: no-op keeps the full compound, raw entry, selected/unselected phases, events and logs`, async () => {
      const ids = await seed(preparation), before = await state()
      const rows = await payload(await record(ids))
      await save(ids.id, rows)
      const after = await state(); assert.deepEqual(after, before)
      evidence.push({ case: preparation + ' no-op', dateIncludedInPayload: Object.hasOwn(rows[0], 'reconstitution_date'), allDatabaseStateUnchanged: true, before: evidenceView(before, ids), after: evidenceView(after, ids) })
    })
    for (const [name, change] of [['notes', h => h.input('Notes', 'Synthetic changed notes')], ['dose', h => h.input('Medication dose', '3')], ['schedule', h => h.button('Evening').props.onClick()]]) await t.test(`${name}-only edits retain historical dates, preparation and observation rows`, async () => {
      const ids = await seed(), original = await record(ids), before = await state()
      const rows = await payload(original, change); await save(ids.id, rows)
      const after = await state(), compound = after.compounds.find(row => row.id === ids.cid), previous = before.compounds.find(row => row.id === ids.cid)
      assert.deepEqual(compound, name === 'notes' ? { ...previous, notes: 'Synthetic changed notes' } : previous)
      assert.deepEqual(after.injection_logs, before.injection_logs)
      assert.deepEqual(after.phases.filter(row => row.id !== ids.phid), before.phases.filter(row => row.id !== ids.phid))
      const oldPhase = before.phases.find(row => row.id === ids.phid), newPhase = after.phases.find(row => row.id === ids.phid)
      assert.deepEqual(newPhase, name === 'dose' ? { ...oldPhase, dosing_entry: { ...oldPhase.dosing_entry, dose: '3', review_status: 'unverified' } } : name === 'schedule' ? { ...oldPhase, time_of_day: 'evening' } : oldPhase)
      for (const event of before.protocol_events) assert.deepEqual(after.protocol_events.find(row => row.id === event.id), event)
      evidence.push({ case: name + '-only edit', dateIncludedInPayload: Object.hasOwn(rows[0], 'reconstitution_date'), before: evidenceView(before, ids), after: evidenceView(after, ids) })
    })
    await t.test('explicit recorded date correction changes only the requested compound fact', async () => {
      const ids = await seed('mixing'), before = await state()
      const rows = await payload(await record(ids), h => h.input('Reconstitution date', '2026-10-03'))
      await save(ids.id, rows)
      const after = await state()
      const expected = structuredClone(before); expected.compounds.find(row => row.id === ids.cid).reconstitution_date = after.compounds.find(row => row.id === ids.cid).reconstitution_date
      assert.deepEqual(after, expected); assert.equal((await record(ids)).compounds[0].reconstitution_date, '2026-10-03')
    })
    await t.test('database rejection after attempted compound updates rolls back date, notes, phases, events and logs', async () => {
      const ids = await seed(), rows = await payload(await record(ids)), before = await state()
      rows[0].notes = 'Must roll back'; rows[0].reconstitution_date = '2026-10-08'; rows[0].phase.dosing_entry.dose = '-1'
      await assert.rejects(save(ids.id, rows), /Invalid numeric input: dose/)
      assert.deepEqual(await state(), before)
    })
    await t.test('malformed missing raw entry is not a supported untouched RPC round-trip', async () => {
      const ids = await seed(), rows = await payload(await record(ids)), before = await state()
      rows[0].phase.dosing_entry = null
      await assert.rejects(save(ids.id, rows), /Dosing entry required/)
      assert.deepEqual(await state(), before)
    })
    if (process.env.RC2_SQL_EVIDENCE) writeFileSync(process.env.RC2_SQL_EVIDENCE, JSON.stringify({ syntheticOnly: true, database: 'In-memory PGlite; unchanged repository RPC SQL', liveDatabaseAccess: false, injectionLogFixture: 'Minimal synthetic observation table; existing RPC SQL does not access it.', cases: evidence }, null, 2) + '\n', { flag: 'wx' })
  } finally { await db.close() }
})

for (const stock of [undefined, null, 0, 3]) test(`RC2: untouched stock ${String(stock)} and missing date preserve their source distinction`, async () => {
  const { compound } = synthetic('ready', null)
  if (stock === undefined) { delete compound.vials_in_stock; delete compound.reconstitution_date }
  else compound.vials_in_stock = stock
  const before = structuredClone(compound)
  await withEditor(protocolFixture([compound]), async h => {
    await h.button('Save changes').props.onClick(); assert.equal(h.calls.length, 1, h.alerts())
    const row = h.calls[0].args.p_compounds[0]
    assert.equal(Object.hasOwn(row, 'vials_in_stock'), false); assert.equal(Object.hasOwn(row, 'reconstitution_date'), false)
    assert.deepEqual(compound, before)
  })
})

for (const date of ['2026-10-07', '']) test(`RC2: deliberate date ${date || 'clearing'} works independently of historical ready preparation`, async () => {
  const { compound, phase } = synthetic()
  await withEditor(protocolFixture([compound]), async h => {
    h.input('Reconstitution date', date)
    await h.button('Save changes').props.onClick(); assert.equal(h.calls.length, 1, h.alerts())
    const row = h.calls[0].args.p_compounds[0]
    assert.equal(row.reconstitution_date, date || null); assert.deepEqual(row.phase.dosing_entry, phase.dosing_entry)
    assert.equal(compound.reconstitution_date, '2026-10-01')
  })
})

test('RC2: a deliberate phase preparation correction never erases the independent recorded compound date', async () => {
  const { compound, phase } = synthetic(), before = structuredClone(compound)
  await withEditor(protocolFixture([compound]), async h => {
    h.field('Preparation source').props.onChange({ target: { checked: false } })
    await h.button('Save changes').props.onClick(); assert.equal(h.calls.length, 1, h.alerts())
    const row = h.calls[0].args.p_compounds[0]
    assert.equal(Object.hasOwn(row, 'reconstitution_date'), false)
    assert.deepEqual(row.phase.dosing_entry, { ...phase.dosing_entry, preparation: 'mixing', is_premixed: false, review_status: 'unverified' })
    assert.deepEqual(compound, before)
  })
})

test('RC2: untouched raw optional semantics, unsupported saved scale, lexical values and extra observations survive dose-only edit', async () => {
  const { compound, phase } = synthetic()
  delete phase.dosing_entry.preparation; delete phase.dosing_entry.is_premixed
  phase.dosing_entry.syringe_scale = '50'; phase.dosing_entry.vial_strength = '010.00'; phase.dosing_entry.legacy_observation = 'Synthetic value retained'; phase.dosing_entry.review_status = 'unverified'
  await withEditor(protocolFixture([compound]), async h => {
    h.input('Medication dose', '3')
    await h.button('Save changes').props.onClick(); assert.equal(h.calls.length, 1, h.alerts())
    assert.deepEqual(h.calls[0].args.p_compounds[0].phase.dosing_entry, { ...phase.dosing_entry, dose: '3' })
  })
})

test('RC2: null route, schedule and time remain null on an unrelated notes edit', async () => {
  const { compound, phase } = synthetic()
  Object.assign(phase, { route: null, frequency: null, days_of_week: null, day_of_week: null, time_of_day: null })
  await withEditor(protocolFixture([compound]), async h => {
    h.input('Notes', 'Only notes'); await h.button('Save changes').props.onClick(); assert.equal(h.calls.length, 1, h.alerts())
    const payload = h.calls[0].args.p_compounds[0].phase
    for (const key of ['route', 'frequency', 'days_of_week', 'day_of_week', 'time_of_day']) assert.equal(payload[key], null, key)
  })
})

for (const kind of ['missing raw entry', 'malformed raw entry', 'missing historical text', 'inconsistent duration', 'unsupported historical frequency', 'clear known stock']) test(`RC2: ${kind} cannot silently round-trip and is visibly blocked without an RPC`, async () => {
  const { compound, phase } = synthetic(), before = () => structuredClone(compound)
  if (kind === 'missing raw entry') { phase.dosing_entry = null; phase.dose = 2; phase.dose_unit = 'mg'; phase.dose_semantics_version = 1 }
  if (kind === 'malformed raw entry') delete phase.dosing_entry.dose
  if (kind === 'missing historical text') delete phase.dosing_entry.vial_label
  if (kind === 'inconsistent duration') phase.duration_weeks = 7
  if (kind === 'unsupported historical frequency') phase.frequency = 'weekly'
  const saved = before()
  await withEditor(protocolFixture([compound]), async h => {
    h.input('Notes', 'Retain unsaved draft')
    if (kind === 'clear known stock') h.input('Vials in stock', '')
    await h.button('Save changes').props.onClick()
    assert.equal(h.calls.length, 0); assert.ok(h.button('Save changes'))
    const guidance = { 'missing raw entry': /historical dosing entry.*Add phase/s, 'malformed raw entry': /Medication dose.*Review/s, 'missing historical text': /Vial label.*Review/s, 'inconsistent duration': /Phase start week.*Phase duration weeks/s, 'unsupported historical frequency': /review the Schedule fields/i, 'clear known stock': /known stock count to unknown.*Vials in stock/s }
    assert.match(h.alerts(), guidance[kind]); assert.match(h.alerts(), /No changes were saved.*Cancel/s)
    assert.equal(h.field('Notes').props.value, 'Retain unsaved draft'); assert.deepEqual(compound, saved)
  })
})

test('RC2: deliberate zero stock is sent explicitly while untouched null remains unknown', async () => {
  const { compound } = synthetic(); compound.vials_in_stock = null
  await withEditor(protocolFixture([compound]), async h => {
    h.input('Vials in stock', '0'); await h.button('Save changes').props.onClick(); assert.equal(h.calls.length, 1, h.alerts())
    assert.equal(h.calls[0].args.p_compounds[0].vials_in_stock, 0); assert.equal(compound.vials_in_stock, null)
  })
})

test('RC2: selecting another saved phase preserves its exact entry and pending independent compound edits', async () => {
  const { compound, phase } = synthetic('mixing')
  const other = { ...structuredClone(phase), id: '00000000-0000-0000-0000-000000000023', start_week: 200, end_week: 202, duration_weeks: 3, dosing_entry: { ...phase.dosing_entry, dose: '7.50', preparation: 'ready', is_premixed: true, vial_strength: '', vial_unit: '', bac_water_ml: '' } }
  compound.phases.push(other)
  const before = structuredClone(compound)
  await withEditor(protocolFixture([compound]), async h => {
    h.input('Notes', 'Pending compound notes'); h.input('Reconstitution date', '2026-10-06')
    h.input('Select phase', other.id)
    await h.button('Save changes').props.onClick(); assert.equal(h.calls.length, 1, h.alerts())
    const row = h.calls[0].args.p_compounds[0]
    assert.equal(row.notes, 'Pending compound notes'); assert.equal(row.reconstitution_date, '2026-10-06')
    assert.equal(row.phase.id, other.id); assert.deepEqual(row.phase.dosing_entry, other.dosing_entry)
    assert.deepEqual(compound, before)
  })
})

test('RC2: adding a new phase retains independent compound history and never reuses a historical phase identity', async () => {
  const { compound, phase } = synthetic(), before = structuredClone(compound)
  await withEditor(protocolFixture([compound]), async h => {
    h.button('Add phase').props.onClick()
    h.input('Medication dose', '5'); h.input('Medication dose unit', 'mg')
    await h.button('Save changes').props.onClick(); assert.equal(h.calls.length, 1, h.alerts())
    const row = h.calls[0].args.p_compounds[0]
    assert.equal(row.phase.id, null); assert.equal(Object.hasOwn(row, 'reconstitution_date'), false)
    assert.equal(row.id, compound.id); assert.equal(row.phase.dosing_entry.dose, '5')
    assert.deepEqual(compound, before); assert.equal(compound.phases[0].id, phase.id)
  })
})

for (const dose of ['', '0']) test(`RC2: historical ${dose === '' ? 'missing' : 'explicit zero'} medication amount is not reinterpreted on notes-only save`, async () => {
  const { compound, phase } = synthetic()
  phase.dosing_entry.dose = dose; phase.dosing_entry.preparation = 'unknown'; delete phase.dosing_entry.is_premixed
  phase.dosing_entry.review_status = 'unverified'
  await withEditor(protocolFixture([compound]), async h => {
    h.input('Notes', 'Synthetic note only'); await h.button('Save changes').props.onClick(); assert.equal(h.calls.length, 1, h.alerts())
    assert.deepEqual(h.calls[0].args.p_compounds[0].phase.dosing_entry, phase.dosing_entry)
  })
})

test('RC2: deliberate weekday changes are detected without changing dose, route, dates or source arrays', async () => {
  const { compound, phase } = synthetic(), before = structuredClone(compound)
  await withEditor(protocolFixture([compound]), async h => {
    h.button('Sun').props.onClick(); await h.button('Save changes').props.onClick(); assert.equal(h.calls.length, 1, h.alerts())
    const row = h.calls[0].args.p_compounds[0]
    assert.deepEqual(row.phase.days_of_week, [1, 2, 3, 4, 5, 6]); assert.equal(row.phase.day_of_week, 1); assert.equal(row.phase.frequency, '6x/week')
    assert.deepEqual(row.phase.dosing_entry, phase.dosing_entry); assert.equal(row.phase.route, phase.route)
    assert.equal(Object.hasOwn(row, 'reconstitution_date'), false); assert.deepEqual(compound, before)
  })
})

for (const edit of [false, true]) test(`RC2: historical duplicate weekdays are ${edit ? 'rejected when an edited schedule still contains duplicates' : 'preserved exactly when untouched'}`, async () => {
  const { compound, phase } = synthetic(); Object.assign(phase, { frequency: '2x/week', days_of_week: [1, 1], day_of_week: 1 })
  const before = structuredClone(compound)
  await withEditor(protocolFixture([compound]), async h => {
    if (edit) h.button('Wed').props.onClick()
    await h.button('Save changes').props.onClick()
    if (edit) { assert.equal(h.calls.length, 0); assert.match(h.alerts(), /Schedule.*each weekday only once/s); assert.ok(h.button('Save changes')) }
    else { assert.equal(h.calls.length, 1, h.alerts()); assert.deepEqual(h.calls[0].args.p_compounds[0].phase.days_of_week, [1, 1]) }
    assert.deepEqual(compound, before)
  })
})

for (const stock of [null, 3]) test(`RC2: whitespace-only stock preserves ${stock === null ? 'unknown' : 'the known count'} instead of silently becoming zero`, async () => {
  const { compound } = synthetic(); compound.vials_in_stock = stock
  await withEditor(protocolFixture([compound]), async h => {
    h.input('Vials in stock', ' '); await h.button('Save changes').props.onClick()
    if (stock === null) { assert.equal(h.calls.length, 1, h.alerts()); assert.equal(Object.hasOwn(h.calls[0].args.p_compounds[0], 'vials_in_stock'), false) }
    else { assert.equal(h.calls.length, 0); assert.match(h.alerts(), /Vials in stock/) }
    assert.equal(compound.vials_in_stock, stock)
  })
})
