import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

for (const scenario of ['fresh', 'partial', 'all-existing', 'incompatible-type', 'incompatible-default', 'incompatible-constraint']) test(`migration compatibility: ${scenario}`, {skip: !process.env.DOSING_PGLITE_PATH}, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.DOSING_PGLITE_PATH).href)
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE ROLE authenticated;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE protocols(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, name text,start_date date,status text DEFAULT 'active',continued_from_protocol_id uuid);
      CREATE TABLE compounds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,protocol_id uuid REFERENCES protocols(id),name text,vial_strength numeric,vial_unit text,bac_water_ml numeric,reconstitution_date date,notes text,vials_in_stock int,ml_per_dose numeric);
      CREATE TABLE phases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,compound_id uuid REFERENCES compounds(id),name text,dose numeric,dose_unit text,start_week int,end_week int,duration_weeks int,frequency text,days_of_week int[],day_of_week int,time_of_day text);
      CREATE TABLE protocol_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,protocol_id uuid,date date,event_type text,description text);
      INSERT INTO protocols(id,user_id,name,start_date) VALUES('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Legacy','2026-01-01');
      INSERT INTO compounds(id,user_id,protocol_id,name,ml_per_dose) VALUES('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Legacy',0.5);
      INSERT INTO phases(user_id,compound_id,name,dose,dose_unit,start_week,end_week) VALUES('00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Legacy',10,'IU',1,4);
    `)
    const migration=readFileSync(new URL('../supabase/migrations/202609090001_dosing_semantics_v1.sql', import.meta.url),'utf8')
    if (scenario !== 'fresh') {
      await db.exec(`ALTER TABLE phases ADD COLUMN syringe_units numeric;
        UPDATE phases SET syringe_units=10;`)
    }
    if (scenario === 'all-existing') await db.exec(`
      ALTER TABLE compounds ADD COLUMN concentration_value numeric, ADD COLUMN concentration_unit text;
      ALTER TABLE phases ADD COLUMN dose_semantics_version smallint, ADD COLUMN injection_volume_ml numeric,
        ADD COLUMN syringe_scale numeric, ADD COLUMN route text;
      UPDATE phases SET route='historical unspecified route';
      UPDATE compounds SET concentration_value=-1,concentration_unit='unknown legacy unit';
    `)
    if (scenario === 'incompatible-type') await db.exec('ALTER TABLE phases ALTER COLUMN syringe_units TYPE text')
    if (scenario === 'incompatible-default') await db.exec('ALTER TABLE phases ADD COLUMN dose_semantics_version smallint DEFAULT 1')
    if (scenario === 'incompatible-constraint') await db.exec('ALTER TABLE compounds ADD CONSTRAINT compounds_concentration_v1 CHECK (true)')
    const snapshot=async()=>({phases:(await db.query('SELECT * FROM phases')).rows,compounds:(await db.query('SELECT * FROM compounds')).rows})
    const original=await snapshot()
    if (scenario.startsWith('incompatible')) {
      await assert.rejects(db.exec(migration), /[Ii]ncompatible/)
      await db.exec('ROLLBACK')
      assert.deepEqual(await snapshot(),original)
      assert.equal((await db.query("SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name='phases' AND column_name='injection_volume_ml'")).rows[0].n,0)
      return
    }
    await db.exec(migration)
    const migrated=await snapshot()
    for (const table of ['phases','compounds']) for (const [key,value] of Object.entries(original[table][0])) assert.deepEqual(migrated[table][0][key],value)
    await db.exec(migration) // all columns, constraints, functions and trigger already exist
    assert.deepEqual(await snapshot(),migrated)
    assert.equal((await db.query("SELECT count(*)::int AS n FROM pg_trigger WHERE tgname='phases_require_dosing_v1'")).rows[0].n,1)

    const before=(await db.query('select dose,dose_unit,dose_semantics_version,injection_volume_ml from phases')).rows[0]
    assert.equal(Number(before.dose),10);assert.equal(before.dose_unit,'IU');assert.equal(before.dose_semantics_version,null);assert.equal(before.injection_volume_ml,null)
    for(const table of ['protocols','compounds','phases','protocol_events']) await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY owner ON ${table} TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid()); GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated;`)
    await db.exec(`SET ROLE authenticated; SET app.user_id='00000000-0000-0000-0000-000000000001';`)
    const compound=(unit,dose,concentration)=>({name:'Medication',concentration_value:concentration,concentration_unit:unit+'/mL',phase:{dose,dose_unit:unit,dose_semantics_version:1,start_week:1,end_week:8,frequency:'2x/week',syringe_scale:100}})
    const save=async (items,id=null)=>db.query('select save_protocol_dosing_v1($1,$2,$3,$4::jsonb) as id',[id,'Example','2026-01-01',JSON.stringify(items)])
    const {rows:[{id}]}=await save([compound('mg',75,200),compound('IU',250,2500)])
    const rows=(await db.query('select dose,dose_unit,injection_volume_ml,syringe_units,syringe_scale from phases where dose_semantics_version=1 order by dose')).rows
    assert.equal(Number(rows[0].dose),75);assert.equal(Number(rows[0].injection_volume_ml),0.375);assert.equal(Number(rows[0].syringe_units),37.5)
    assert.equal(rows[1].dose_unit,'IU');assert.equal(Number(rows[1].dose),250);assert.equal(Number(rows[1].injection_volume_ml),0.1);assert.equal(Number(rows[1].syringe_units),10)
    const count=async()=>Number((await db.query('select count(*) from protocols')).rows[0].count)
    const prior=await count()
    await assert.rejects(save([compound('mg',5,10),{...compound('IU',250,2500),concentration_unit:'mg/mL'}]))
    assert.equal(await count(),prior)
    await assert.rejects(save([{...compound('mg',5,10),phase:{...compound('mg',5,10).phase,dose_unit:'mL'}}]))
    await db.exec(`SET app.user_id='00000000-0000-0000-0000-000000000002';`)
    await assert.rejects(save([compound('mg',5,10)],id))
    await db.exec(`SET app.user_id='00000000-0000-0000-0000-000000000001';`)
    await save([{...compound('mg',5,10), id:'20000000-0000-0000-0000-000000000001', phase:{...compound('mg',5,10).phase,start_week:5,end_week:12}}], '10000000-0000-0000-0000-000000000001')
    assert.equal(Number((await db.query("select count(*) from phases where compound_id='20000000-0000-0000-0000-000000000001'")).rows[0].count),2)
    assert.equal(Number((await db.query("select ml_per_dose from compounds where id='20000000-0000-0000-0000-000000000001'")).rows[0].ml_per_dose),0.5)
    await assert.rejects(save([{...compound('mg',5,10), id:'20000000-0000-0000-0000-000000000001', phase:{...compound('mg',5,10).phase,start_week:3,end_week:8}}], '10000000-0000-0000-0000-000000000001'))
    const after=(await db.query("select dose,dose_unit,dose_semantics_version from phases where compound_id='20000000-0000-0000-0000-000000000001' and dose_semantics_version is null")).rows[0]
    assert.deepEqual(after,{dose:before.dose,dose_unit:before.dose_unit,dose_semantics_version:null})
  } finally { await db.close() }
})
