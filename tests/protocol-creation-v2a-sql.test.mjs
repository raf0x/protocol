import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import React from 'react'
import ts from 'typescript'
import { reactHarness } from './helpers/reactHarness.mjs'

const require = createRequire(import.meta.url), cache = new Map()
let hooks = [], lastHooks
const renderer = reactHarness()
function load(path) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }, code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name.endsWith('.module.css')) return new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) })
    if (name === 'next/link') return { __esModule: true, default: props => React.createElement('a', props) }
    if (name.endsWith('/supabase')) return { createClient() { throw Error('Synthetic tests cannot access Supabase') } }
    if (name === 'react') return { ...React, ...renderer.hooks }
    if (!name.startsWith('.')) return require(name)
    return load(new URL(name + (existsSync(new URL(name + '.tsx', url)) ? '.tsx' : '.ts'), url))
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}
const catalog = load('../lib/protocols/catalog.ts'), form = load('../lib/protocols/form.ts'), quick = load('../lib/protocols/quickStart.ts')
const { protocolLifecycle } = load('../lib/health/protocolDates.ts')
const { interpretEntry, entryFromForm, entryFormState, dosingDisplay } = load('../lib/health/dosingEntry.ts')
const { measurementPreview, updateCreation } = load('../lib/protocols/creationMeasurement.ts')
const View = load('../components/protocols/ProtocolQuickStart.tsx').default
const Fields = load('../components/protocols/QuickProtocolFields.tsx').default
const Picker = load('../components/protocols/CompoundPicker.tsx').default
const Timing = load('../components/protocols/ProtocolStartDate.tsx').default
const item = Object.freeze({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', item_name: 'Test C', vial_strength: 200, strength_unit: 'mg', quantity: 8, form: 'lyophilized vial', reconstitution_status: 'unknown', reconstitution_date: null })
const previous = [{ start_date: '2026-08-01', compounds: [{ name: 'Test C', phases: [{ start_week: 1, dose: 5, dose_unit: 'mg', dose_semantics_version: 1, frequency: '1x/week', days_of_week: [0], route: 'SubQ', time_of_day: 'morning' }] }] }]
function nodes(node, predicate) {
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate))
  if (!node || typeof node !== 'object') return []
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]
}
function text(node) { if (Array.isArray(node)) return node.map(text).join(''); return node && typeof node === 'object' ? text(node.props?.children) : typeof node === 'string' || typeof node === 'number' ? String(node) : '' }
function ui(Component, props) { if (lastHooks !== hooks) { renderer.reset(); lastHooks = hooks } return renderer.render(React.createElement(Component, props)) }
const button = (view, name) => nodes(view, n => n.type === 'button' && text(n) === name)[0]
const field = (view, name) => nodes(view, n => n.props?.['aria-label'] === name)[0]


import { PGlite } from '@electric-sql/pglite'
test('new preparation JSON survives the unchanged canonical RPC, reload and owner isolation', async () => {
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE protocols(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,name text,start_date date NOT NULL,
        status text DEFAULT 'active' CHECK(status IN ('active','paused','completed','stopped')),completed_date timestamptz,continued_from_protocol_id uuid);
      CREATE TABLE compounds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,protocol_id uuid REFERENCES protocols(id),name text,
        vial_strength numeric,vial_unit text,bac_water_ml numeric,reconstitution_date date,notes text,vials_in_stock int,ml_per_dose numeric);
      CREATE TABLE phases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,compound_id uuid REFERENCES compounds(id),name text,
        dose numeric,dose_unit text,start_week int,end_week int,duration_weeks int,frequency text,days_of_week int[],day_of_week int,time_of_day text);
      CREATE TABLE protocol_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,protocol_id uuid,compound_id uuid,date date NOT NULL,event_type text,description text);`)

    for (const file of ['202609090001_dosing_semantics_v1.sql','202609100001_advisory_dosing.sql','202609110001_continue_latest_phase.sql','202609140001_structured_protocol_events.sql','202609160001_historical_protocol_context_v1.sql','202609200001_planned_protocols.sql','202609220001_protocol_save_dates.sql','202609230001_protocol_edit_date_hotfix.sql','202609240001_scheduled_protocols.sql','202609260001_restore_preparation_fingerprint.sql']) await db.exec(readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'))
    for (const table of ['protocols','compounds','phases','protocol_events']) await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY owner ON ${table} TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid()); GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated;`)
    await db.exec(`SET ROLE authenticated; SELECT set_config('app.user_id','00000000-0000-0000-0000-000000000001',false)`)
    const c = { ...form.newCompound(), name: 'Synthetic compound', preparation: 'mixing', vial_strength: '10', vial_unit: 'mg', bac_water_ml: '1.8', reconstitution_date: '2026-11-01', final_solution_volume_ml: '2.00', preparation_confirmed: true, input_mode: 'syringe', syringe_markings: '20', syringe_scale: '100', days_of_week: [1,4], route: 'SubQ' }
    const payload = form.protocolCompoundPayload([c])
    await db.query(`SELECT save_protocol_with_events_v2(NULL,'Synthetic compound','2026-11-05',$1::jsonb,NULL,'{}',NULL,'America/New_York')`, [JSON.stringify(payload)])
    const row = (await db.query('SELECT * FROM phases')).rows[0]
    assert.deepEqual(row.dosing_entry, payload[0].phase.dosing_entry)
    assert.deepEqual(entryFromForm(entryFormState(row)), row.dosing_entry)
    assert.equal(row.dosing_entry.final_solution_volume_ml, '2.00'); assert.equal(row.dosing_entry.preparation_confirmed, true)
    assert.equal(row.dose, null); assert.equal(row.dose_unit, null); assert.equal(row.frequency, '2x/week'); assert.deepEqual(row.days_of_week, [1,4])
    assert.equal(row.dosing_entry.concentration_value, '')
    const compound = (await db.query('SELECT *, reconstitution_date::text AS reconstitution_date FROM compounds')).rows[0]
    assert.equal(compound.vial_strength, null); assert.equal(compound.bac_water_ml, null)
    assert.equal(compound.reconstitution_date, '2026-11-01')
    const protocol = { ...(await db.query('SELECT * FROM protocols')).rows[0], start_date: '2020-01-01', compounds: [{ ...compound, phases: [row] }] }
    const before = JSON.stringify(protocol), noop = () => {}
    const detail = text(ui(load('../components/protocols/ProtocolDetail.tsx').default, { protocol, today: '2026-11-05', onBack:noop,onEdit:noop,onComplete:noop,onPause:noop,onResume:noop,onReactivate:noop,onDelete:noop,onReload:noop }))
    assert.match(detail, /10 mg/); assert.match(detail,/28-day check reminder/); assert.match(detail,/Nov 29/)
    for (const snapshot of [false,true]) {
      const hero = text(ui(load('../components/dashboard/HeroProtocolCard.tsx').default, { activeProtocols:[protocol],activeCompoundTab:compound.id,compoundIndex:0,snapshot,logs:{},allLogs:[],totalLost:null }))
      assert.match(hero,/Saved phase preparation/); assert.match(hero,/10 mg/); assert.match(hero,/Nov 1/); assert.match(hero,/Nov 29/); assert.doesNotMatch(hero,/Remaining not tracked|Estimated remaining|100%/); assert.match(hero,/Saved doses are not linked to an individual vial/); assert.match(hero,/BAC water added1.8 mL/); assert.match(hero,/Syringe volume0.2 mL/)
    }
    assert.equal(JSON.stringify(protocol),before)
    for (const schedule of [{ days_of_week: [0,1,2,3,4,5,6], frequency_mode: 'weekly', cycle_days: '' }, { days_of_week: [1,4], frequency_mode: 'weekly', cycle_days: '' }, { days_of_week: [], frequency_mode: 'rolling', cycle_days: '3' }]) {
      const draft = { ...c, ...schedule, route: '' }
      assert.equal(quick.quickStartIssue({ startDate: '2026-11-05', compounds: [draft] }), null)
      const unspecified = form.protocolCompoundPayload([draft])
      const created = (await db.query(`SELECT save_protocol_with_events_v2(NULL,'Unspecified route','2026-11-05',$1::jsonb,NULL,'{}',NULL,'America/New_York') AS id`, [JSON.stringify(unspecified)])).rows[0].id
      const saved = (await db.query('SELECT * FROM phases WHERE compound_id IN (SELECT id FROM compounds WHERE protocol_id=$1)', [created])).rows[0]
      assert.equal(saved.route, null)
      assert.equal(saved.frequency, unspecified[0].phase.frequency)
      assert.deepEqual(saved.days_of_week, unspecified[0].phase.days_of_week)
      assert.deepEqual(saved.dosing_entry, unspecified[0].phase.dosing_entry)
    }
    await db.exec(`SELECT set_config('app.user_id','00000000-0000-0000-0000-000000000002',false)`)
    assert.equal((await db.query('SELECT * FROM phases')).rows.length, 0)
  } finally { await db.close() }
})
