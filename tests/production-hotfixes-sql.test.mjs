import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const read = name => readFileSync(new URL('../supabase/migrations/' + name, import.meta.url), 'utf8')
const runtime = process.env.DOSING_PGLITE_PATH ? pathToFileURL(process.env.DOSING_PGLITE_PATH) : new URL('../node_modules/.mpp007-test/node_modules/@electric-sql/pglite/dist/index.js', import.meta.url)
const preparation = '202609260001_restore_preparation_fingerprint.sql'
const deletion = '202609260002_account_deletion_inventory.sql'
const a = '00000000-0000-0000-0000-000000000001', b = '00000000-0000-0000-0000-000000000002'
const contract = async db => (await db.query(`SELECT oid,proname,proowner,proacl::text,prosecdef,proconfig,provolatile,
  pg_get_function_arguments(oid) AS arguments,pg_get_function_result(oid) AS result,
  CASE WHEN proname IN ('protocol_phase_event_state_v1','delete_my_account_data_v1') THEN NULL ELSE prosrc END AS body
  FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY oid`)).rows
const snapshot = sql => sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.protocol_phase_event_state_v1'),sql.indexOf('$$;',sql.indexOf('CREATE OR REPLACE FUNCTION public.protocol_phase_event_state_v1'))+3)

test('snapshot hotfix restores preparation-only events without changing canonical saves, contracts or history', async () => {
  const { PGlite } = await import(runtime.href), db = new PGlite()
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
    for (const file of ['202609090001_dosing_semantics_v1.sql','202609100001_advisory_dosing.sql','202609110001_continue_latest_phase.sql','202609140001_structured_protocol_events.sql','202609200001_planned_protocols.sql','202609220001_protocol_save_dates.sql','202609230001_protocol_edit_date_hotfix.sql','202609240001_scheduled_protocols.sql']) await db.exec(read(file))
    for (const table of ['protocols','compounds','phases','protocol_events']) await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY owner ON ${table} TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid()); GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated;`)
    const before = await contract(db)
    assert.equal(snapshot(read(preparation)), snapshot(read('202609160001_historical_protocol_context_v1.sql')), 'restore the exact intended expression')
    const code = ts.transpileModule(readFileSync(new URL('../lib/health/dosingEntry.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
    const { entryFromForm } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
    const entry = entryFromForm({input_mode:'medication',dose:'2',dose_unit:'mg',vial_strength:'10',vial_unit:'mg',bac_water_ml:'2',reviewed:true})
    const rows = [{name:'Preparation test',phase:{dosing_entry:entry,start_week:1,end_week:null,frequency:'daily',time_of_day:'morning'}}]
    await db.exec(`SET ROLE authenticated; SET app.user_id='${a}'`)
    const save = async id => (await db.query('SELECT save_protocol_with_events_v2($1,$2,current_date,$3::jsonb) AS id',[id,'Hotfix',JSON.stringify(rows)])).rows[0].id
    const id = await save(null)
    const state = (await db.query('SELECT c.id AS compound,ph.id AS phase FROM compounds c JOIN phases ph ON ph.compound_id=c.id WHERE c.protocol_id=$1',[id])).rows[0]
    rows[0].id=state.compound; rows[0].phase.id=state.phase
    const events = async () => (await db.query('SELECT * FROM protocol_events ORDER BY id')).rows
    const original = await events()
    await db.exec('RESET ROLE')
    for (let pass=0;pass<2;pass++) {
      await db.exec(read(preparation))
      assert.deepEqual(await contract(db),before,'owner, ACL, signature, settings and every save/transition body stay unchanged')
      assert.deepEqual(await events(),original,'migration never backfills events')
    }
    await db.exec(`SET ROLE authenticated; SET app.user_id='${a}'`)
    await save(id)
    assert.deepEqual(await events(),original,'restoring snapshots creates no event on unchanged save')
    rows[0].phase.dosing_entry=entryFromForm({input_mode:'medication',dose:'2',dose_unit:'mg',vial_strength:'10',vial_unit:'mg',bac_water_ml:'3',reviewed:true})
    assert.equal(await save(id),id)
    const after=await events(), changes=after.filter(e=>e.event_type==='preparation_change')
    assert.equal(changes.length,1)
    assert.equal(after.filter(e=>e.event_type==='dose_change').length,0)
    assert.equal(changes[0].metadata.previousState.preparationFingerprint.bacWaterMl,'2')
    assert.equal(changes[0].metadata.newState.preparationFingerprint.bacWaterMl,'3')
    assert.deepEqual(changes[0].metadata.previousState.doseFingerprint,changes[0].metadata.newState.doseFingerprint)
    assert.ok(original.every(event=>after.some(row=>JSON.stringify(row)===JSON.stringify(event))))
    await save(id)
    assert.deepEqual(await events(),after,'retry does not duplicate preparation event')
  } finally { await db.close() }
})

test('inventory account deletion preserves contracts across retries, isolates users and rejects anonymous/unconfirmed calls', async () => {
  const { PGlite } = await import(runtime.href), db = new PGlite()
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('app.user_id',true),'')::uuid$$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      INSERT INTO auth.users VALUES('${a}'),('${b}');
      CREATE TABLE user_profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE);
      CREATE TABLE journal_entries(user_id uuid,notes text);
      INSERT INTO user_profiles VALUES('${a}'),('${b}');
      INSERT INTO journal_entries VALUES('${a}','A'),('${b}','B');`)
    await db.exec(read('202609210001_inventory.sql'))
    await db.exec(read('202609250001_profile_owner_key.sql'))
    await db.exec(`REVOKE ALL ON FUNCTION delete_my_account_data_v1(text) FROM PUBLIC,anon;
      GRANT EXECUTE ON FUNCTION delete_my_account_data_v1(text) TO authenticated,service_role;`)
    for (const user of [a,b]) {
      await db.exec(`SET ROLE authenticated; SET app.user_id='${user}'`)
      await db.query('SELECT import_inventory_v1(gen_random_uuid(),$1::jsonb,true)',[JSON.stringify([{item_name:'Owned vial',form:'lyophilized vial',quantity:2,reconstitution_status:'not reconstituted'}])])
    }
    await assert.rejects(db.query("SELECT delete_my_account_data_v1('DELETE')"),/Account deletion needs review for owner tables: inventory_imports, inventory_items/)
    await db.exec('RESET ROLE')
    const data = async () => (await db.query(`SELECT
      (SELECT jsonb_agg(i ORDER BY user_id) FROM inventory_items i) AS items,
      (SELECT jsonb_agg(i ORDER BY user_id) FROM inventory_imports i) AS imports,
      (SELECT jsonb_agg(p ORDER BY id) FROM user_profiles p) AS profiles,
      (SELECT jsonb_agg(j ORDER BY user_id) FROM journal_entries j) AS journal`)).rows[0]
    const original=await data(), before=await contract(db)
    for (let pass=0;pass<2;pass++) {
      await db.exec(read(deletion))
      assert.deepEqual(await contract(db),before,'identity, return type, owner, grants, security and search_path preserved')
      assert.deepEqual(await data(),original,'migration itself deletes nothing')
    }
    const body=(await db.query("SELECT prosrc FROM pg_proc WHERE oid='delete_my_account_data_v1(text)'::regprocedure")).rows[0].prosrc
    assert.doesNotMatch(body,/user_profiles\s*\.\s*user_id/)
    assert.doesNotMatch(body.match(/FOREACH[\s\S]*?END LOOP/)[0],/user_profiles/)
    await db.exec(`SET ROLE authenticated; SET app.user_id='${a}'`)
    for (const confirmation of ['wrong',null,'']) await assert.rejects(db.query('SELECT delete_my_account_data_v1($1)',[confirmation]),/Type DELETE/)
    await db.exec("SET app.user_id=''")
    await assert.rejects(db.query("SELECT delete_my_account_data_v1('DELETE')"),/Not authenticated/)
    await db.exec('SET ROLE anon')
    await assert.rejects(db.query("SELECT delete_my_account_data_v1('DELETE')"),/permission denied/)
    await db.exec('RESET ROLE')
    assert.deepEqual(await data(),original,'rejected requests delete nothing')
    // The fail-closed guard remains intact for unrelated future owner tables.
    await db.exec('CREATE TABLE unexpected_owner_data(user_id uuid)')
    await db.exec(`SET ROLE authenticated; SET app.user_id='${a}'`)
    await assert.rejects(db.query("SELECT delete_my_account_data_v1('DELETE')"),/Account deletion needs review for owner tables: unexpected_owner_data/)
    await db.exec('RESET ROLE; DROP TABLE unexpected_owner_data')
    await db.exec(`SET ROLE authenticated; SET app.user_id='${a}'`)
    await db.query("SELECT delete_my_account_data_v1('DELETE')")
    await db.query("SELECT delete_my_account_data_v1('DELETE')")
    await db.exec('RESET ROLE')
    const remaining=await data()
    for (const key of ['items','imports','journal']) assert.deepEqual(remaining[key],original[key].filter(row=>row.user_id===b),key+' preserves the other user verbatim')
    assert.deepEqual(remaining.profiles,[{id:b}])
    assert.equal((await db.query('SELECT * FROM auth.users')).rows.length,2,'explicit deletes do not rely on deleting auth accounts')
    await db.exec(`SET ROLE authenticated; SET app.user_id='${b}'`)
    await db.query("SELECT delete_my_account_data_v1('DELETE')")
    await db.exec('RESET ROLE')
    assert.deepEqual(await data(),{items:null,imports:null,profiles:null,journal:null})
  } finally { await db.close() }
})
