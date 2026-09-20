import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const runtime=process.env.DOSING_PGLITE_PATH?pathToFileURL(process.env.DOSING_PGLITE_PATH):new URL('../node_modules/.mpp007-test/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url)
const code=ts.transpileModule(readFileSync(new URL('../lib/health/dosingEntry.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {entryFromForm}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
test('date-aware save reuses canonical history, validates local boundaries, preserves IDs and Planned behavior', {skip:!existsSync(runtime)},async()=>{
  const {PGlite}=await import(runtime.href),db=new PGlite()
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
    const migration=readFileSync(new URL('../supabase/migrations/202609220001_protocol_save_dates.sql',import.meta.url),'utf8')
    for(const file of ['202609090001_dosing_semantics_v1.sql','202609100001_advisory_dosing.sql','202609140001_structured_protocol_events.sql','202609160001_historical_protocol_context_v1.sql','202609200001_planned_protocols.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
    await db.exec(migration);await db.exec(migration)
    for(const table of ['protocols','compounds','phases','protocol_events'])await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY owner ON ${table} TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid()); GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated;`)
    await db.exec("SET ROLE authenticated; SET app.user_id='00000000-0000-0000-0000-000000000001'; SET timezone='UTC'")
    const entry=entryFromForm({input_mode:'medication',dose:'2',dose_unit:'mg',vial_strength:'10',vial_unit:'mg',bac_water_ml:'2',reviewed:true})
    const compound={name:'Original',notes:'Retain',vials_in_stock:3,phase:{dosing_entry:entry,start_week:1,end_week:null,frequency:'daily',days_of_week:[0,1,2,3,4,5,6],time_of_day:'morning'}}
    const save=async(id,start,rows=[compound],effective=null,zone='UTC')=>(await db.query('SELECT save_protocol_with_events_v2($1,$2,$3,$4::jsonb,null,$5::uuid[],$6,$7) AS id',[id,'Protocol',start,JSON.stringify(rows),[],effective,zone])).rows[0].id
    const events=async id=>(await db.query('SELECT * FROM protocol_events WHERE protocol_id=$1 ORDER BY id',[id])).rows
    for(const zone of ['Pacific/Kiritimati','America/Los_Angeles']) {
      const {today,past,future}=(await db.query("SELECT (now() AT TIME ZONE $1)::date::text AS today, ((now() AT TIME ZONE $1)::date-1)::text AS past, ((now() AT TIME ZONE $1)::date+1)::text AS future",[zone])).rows[0]
      for(const date of [today,past]) {
        const id=await save(null,date,undefined,'1900-01-01',zone)
        const original=await events(id)
        assert.equal(original.filter(e=>e.event_type==='started').length,1)
        assert.equal(original.filter(e=>e.event_type==='phase_started').length,1)
        assert.ok(original.every(e=>e.date.toISOString().slice(0,10)===date&&e.metadata.effectiveDate===date))
        const c=(await db.query('SELECT id FROM compounds WHERE protocol_id=$1',[id])).rows[0]
        const ph=(await db.query('SELECT id FROM phases WHERE compound_id=$1',[c.id])).rows[0]
        const rows=[{...compound,id:c.id,phase:{...compound.phase,id:ph.id}}]
        assert.equal(await save(id,date,rows,null,zone),id)
        assert.deepEqual(await events(id),original,'unchanged edits must not duplicate or rewrite events')
        await save(id,date,rows,date,zone);await save(id,date,rows,today,zone)
        await assert.rejects(save(id,date,rows,'1900-01-01',zone),/Effective date cannot be before the protocol start date\./)
        await assert.rejects(save(id,date,rows,future,zone),/Effective date cannot be in the future\./)
        rows[0].phase.dosing_entry={...entry,dose:'3'}
        await save(id,date,rows,today,zone)
        const changed=await events(id)
        assert.ok(original.every(e=>changed.some(after=>JSON.stringify(after)===JSON.stringify(e))),'existing history stays intact')
        const dose=changed.find(e=>e.event_type==='dose_change');assert.equal(dose.metadata.previousDose,2);assert.equal(dose.metadata.newDose,3)
        assert.equal(dose.metadata.phaseId,ph.id);assert.equal(dose.metadata.compoundId,c.id)
      }
      await assert.rejects(save(null,future,undefined,null,zone),/Start date cannot be in the future\./)
    }
    assert.equal((await db.query('SHOW timezone')).rows[0].TimeZone,'UTC','function timezone cannot leak to subsequent queries')
    const planned=await save(null,null,undefined,'2099-01-01')
    assert.equal((await events(planned)).length,0)
    assert.equal((await db.query('SELECT status FROM protocols WHERE id=$1',[planned])).rows[0].status,'planned')
    await db.exec("SET app.user_id='00000000-0000-0000-0000-000000000002'")
    await assert.rejects(save(planned,null),/Protocol not found/)
  }finally{await db.close()}
})
