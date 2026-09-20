import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const code = ts.transpileModule(readFileSync(new URL('../lib/health/dosingEntry.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { entryFromForm } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)

const runtime = process.env.DOSING_PGLITE_PATH
  ? pathToFileURL(process.env.DOSING_PGLITE_PATH)
  : new URL('../node_modules/.mpp007-test/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url)

test('Planned saves and activation preserve identity, suppress premature history and serialize retries', { skip: !existsSync(runtime) }, async () => {
  const { PGlite } = await import(runtime.href)
  const db = new PGlite()
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE protocols(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,name text,start_date date NOT NULL,
        status text DEFAULT 'active' CHECK(status IN ('active','paused','completed','stopped')),completed_date timestamptz,continued_from_protocol_id uuid);
      CREATE TABLE compounds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,protocol_id uuid REFERENCES protocols(id),name text,
        vial_strength numeric,vial_unit text,bac_water_ml numeric,reconstitution_date date,notes text,vials_in_stock int,ml_per_dose numeric);
      CREATE TABLE phases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,compound_id uuid REFERENCES compounds(id),name text,
        dose numeric,dose_unit text,start_week int,end_week int,duration_weeks int,frequency text,days_of_week int[],day_of_week int,time_of_day text);
      CREATE TABLE protocol_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,protocol_id uuid,compound_id uuid,date date NOT NULL,event_type text,description text);`)
    for (const file of ['202609090001_dosing_semantics_v1.sql','202609100001_advisory_dosing.sql','202609140001_structured_protocol_events.sql','202609160001_historical_protocol_context_v1.sql','202609200001_planned_protocols.sql']) {
      await db.exec(readFileSync(new URL('../supabase/migrations/' + file, import.meta.url), 'utf8'))
    }
    for (const table of ['protocols','compounds','phases','protocol_events']) await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY owner ON ${table} TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());
      GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated;`)
    await db.exec(`SET ROLE authenticated; SET app.user_id='00000000-0000-0000-0000-000000000001';`)
    const entry = entryFromForm({input_mode:'medication',dose:'2',dose_unit:'mg',vial_strength:'10',vial_unit:'mg',bac_water_ml:'2',syringe_scale:'100',reviewed:true})
    const compounds = [{name:'Saved compound',notes:'Keep these notes',vials_in_stock:3,reconstitution_date:'2026-09-01',phase:{dosing_entry:entry,start_week:1,end_week:null,route:'SubQ',frequency:'daily',days_of_week:[0,1,2,3,4,5,6],time_of_day:'morning'}}]
    const save = (id = null, date = null, rows = compounds) => db.query('select save_protocol_with_events_v1($1,$2,$3,$4::jsonb) as id', [id,'Saved plan',date,JSON.stringify(rows)])
    const pid = (await save()).rows[0].id
    const protocol = async () => (await db.query('select * from protocols where id=$1',[pid])).rows[0]
    const children = async () => (await db.query('select to_jsonb(c) as compound,to_jsonb(ph) as phase from compounds c join phases ph on ph.compound_id=c.id where c.protocol_id=$1 order by ph.id',[pid])).rows
    const events = async () => (await db.query('select * from protocol_events where protocol_id=$1 order by id',[pid])).rows
    assert.equal((await protocol()).status,'planned'); assert.equal((await protocol()).start_date,null)
    assert.equal((await events()).length,0)
    const original = await children()
    compounds[0].id=original[0].compound.id; compounds[0].phase.id=original[0].phase.id
    compounds[0].notes='Edited while Planned'
    await save(pid)
    assert.equal((await events()).length,0)
    assert.equal((await children())[0].compound.id,original[0].compound.id)
    await assert.rejects(save(pid,'2026-09-15'), /Use Activate/)
    const before = await children()
    const activate = date => db.query("select transition_protocol_v1($1,'activate',$2)",[pid,date])
    await assert.rejects(activate(null), /Choose a start date/)
    await db.exec(`SET app.user_id='00000000-0000-0000-0000-000000000002';`)
    await assert.rejects(activate('2026-09-15'), /Protocol not found/)
    await db.exec(`SET app.user_id='00000000-0000-0000-0000-000000000001';`)
    await Promise.all([activate('2026-09-15'),activate('2026-09-15')])
    assert.equal((await protocol()).status,'active'); assert.equal((await protocol()).start_date.toISOString().slice(0,10),'2026-09-15')
    assert.deepEqual(await children(),before)
    assert.equal(Number((await db.query('select count(*) from protocols')).rows[0].count),1)
    assert.equal((await events()).filter(e=>e.event_type==='started').length,1)
    assert.equal((await events()).filter(e=>e.event_type==='phase_started').length,1)
    assert.ok((await events()).every(e=>e.date.toISOString().slice(0,10)==='2026-09-15'))
    await assert.rejects(activate('2026-09-16'), /Only a Planned protocol/)
    await assert.rejects(save(pid), /existing protocols require a start date/)
    // Normal creation still emits the same start boundaries.
    const ordinaryRows=structuredClone(compounds); delete ordinaryRows[0].id; delete ordinaryRows[0].phase.id
    const ordinary=(await save(null,'2026-09-15',ordinaryRows)).rows[0].id
    assert.equal((await db.query('select status from protocols where id=$1',[ordinary])).rows[0].status,'active')
    assert.equal(Number((await db.query('select count(*) from protocol_events where protocol_id=$1',[ordinary])).rows[0].count),2)
    // Existing lifecycle and stopped vocabulary remain intact.
    for (const action of ['pause','resume','complete','reactivate']) await db.query('select transition_protocol_v1($1,$2,$3)',[pid,action,'2026-09-16'])
    assert.equal((await protocol()).status,'active')
    await db.query("update protocols set status='stopped' where id=$1",[ordinary])
    assert.equal((await db.query('select status from protocols where id=$1',[ordinary])).rows[0].status,'stopped')
  } finally { await db.close() }
})
