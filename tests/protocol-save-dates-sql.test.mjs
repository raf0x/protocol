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
    const migration=readFileSync(new URL('../supabase/migrations/202609220001_protocol_save_dates.sql',import.meta.url),'utf8')
    for(const file of ['202609090001_dosing_semantics_v1.sql','202609100001_advisory_dosing.sql','202609110001_continue_latest_phase.sql','202609140001_structured_protocol_events.sql','202609160001_historical_protocol_context_v1.sql','202609200001_planned_protocols.sql'])await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
    await db.exec(migration);await db.exec(migration)
    const hotfix=readFileSync(new URL('../supabase/migrations/202609230001_protocol_edit_date_hotfix.sql',import.meta.url),'utf8')
    await db.exec(hotfix);await db.exec(hotfix)
    for(const table of ['protocols','compounds','phases','protocol_events'])await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY; CREATE POLICY owner ON ${table} TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid()); GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated;`)
    const rls=async()=> (await db.query(`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity,p.polname,p.polroles,p.polcmd,
      pg_get_expr(p.polqual,p.polrelid) AS using,pg_get_expr(p.polwithcheck,p.polrelid) AS check
      FROM pg_class c JOIN pg_policy p ON p.polrelid=c.oid ORDER BY c.relname,p.polname`)).rows
    const beforeRls=await rls()
    // Reproduce the production direct anon grant, plus a PUBLIC grant, while
    // retaining the three roles that must keep access.
    await db.exec('GRANT EXECUTE ON FUNCTION public.continue_latest_phase(uuid,uuid,uuid) TO PUBLIC,anon,authenticated,service_role,postgres')
    const preflight=readFileSync(new URL('../supabase/preflight/202609240001_scheduled_protocols.sql',import.meta.url),'utf8')
    assert.match((await db.query(preflight)).rows.find(row=>row.expected_signature.includes('continue_latest_phase')).preflight_result,/FAIL: execution privileges/)
    const continuationGrants=async()=> (await db.query(`SELECT r.rolname,has_function_privilege(r.oid,'public.continue_latest_phase(uuid,uuid,uuid)','EXECUTE') AS execute
      FROM pg_roles r WHERE r.rolname IN ('anon','authenticated','service_role','postgres') ORDER BY r.rolname`)).rows
    const expectedContinuationGrants=[{rolname:'anon',execute:false},{rolname:'authenticated',execute:true},{rolname:'postgres',execute:true},{rolname:'service_role',execute:true}]
    const contract=async()=> (await db.query(`SELECT p.oid,p.proname,pg_get_function_identity_arguments(p.oid) AS identity,
      pg_get_function_arguments(p.oid) AS arguments,pg_get_function_result(p.oid) AS result,
      pg_get_userbyid(p.proowner) AS owner,p.proacl::text,p.prosecdef,p.proconfig,p.pronargdefaults,
      CASE WHEN p.proname IN ('save_protocol_with_events_v2','continue_latest_phase') THEN NULL ELSE p.prosrc END AS body
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' ORDER BY p.oid`)).rows
    const beforeContract=await contract()
    const withoutContinuationAcl=rows=>rows.map(row=>row.proname==='continue_latest_phase'?{...row,proacl:null}:row)
    const scheduledMigration=readFileSync(new URL('../supabase/migrations/202609240001_scheduled_protocols.sql',import.meta.url),'utf8')
    await db.exec(scheduledMigration)
    const afterContract=await contract()
    assert.deepEqual(withoutContinuationAcl(afterContract),withoutContinuationAcl(beforeContract),'only the intended continuation ACL changes; other contracts survive replacement')
    assert.deepEqual(await continuationGrants(),expectedContinuationGrants)
    assert.ok((await db.query(preflight)).rows.every(row=>row.preflight_result.startsWith('PASS contract')))
    await db.exec(scheduledMigration)
    assert.deepEqual(await contract(),afterContract,'repeat application preserves the corrected ACL and function contracts')
    assert.deepEqual(await continuationGrants(),expectedContinuationGrants)
    assert.ok((await db.query(preflight)).rows.every(row=>row.preflight_result.startsWith('PASS contract')))
    assert.deepEqual(await rls(),beforeRls,'RLS flags and ownership policies are untouched')
    const wrapper=beforeContract.filter(row=>row.proname==='save_protocol_with_events_v2')
    assert.equal(wrapper.length,1);assert.equal(wrapper[0].result,'uuid');assert.equal(wrapper[0].pronargdefaults,4)
    assert.equal(wrapper[0].prosecdef,false);assert.ok(wrapper[0].proconfig.includes('search_path=public'))
    assert.ok(wrapper[0].proconfig.includes('TimeZone=UTC'))
    const privileges=(await db.query(`SELECT has_function_privilege('anon','public.save_protocol_with_events_v2(uuid,text,date,jsonb,uuid,uuid[],date,text)','EXECUTE') AS anon,
      has_function_privilege('authenticated','public.save_protocol_with_events_v2(uuid,text,date,jsonb,uuid,uuid[],date,text)','EXECUTE') AS authenticated`)).rows[0]
    assert.deepEqual(privileges,{anon:false,authenticated:true})
    await db.exec("SET ROLE authenticated; SET app.user_id='00000000-0000-0000-0000-000000000001'; SET timezone='UTC'")
    const entry=entryFromForm({input_mode:'medication',dose:'2',dose_unit:'mg',vial_strength:'10',vial_unit:'mg',bac_water_ml:'2',reviewed:true})
    const compound={name:'Original',notes:'Retain',vials_in_stock:3,phase:{dosing_entry:entry,start_week:1,end_week:null,frequency:'daily',days_of_week:[0,1,2,3,4,5,6],time_of_day:'morning'}}
    const save=async(id,start,rows=[compound],effective=null,zone='UTC')=>(await db.query('SELECT save_protocol_with_events_v2($1,$2,$3,$4::jsonb,null,$5::uuid[],$6,$7) AS id',[id,'Protocol',start,JSON.stringify(rows),[],effective,zone])).rows[0].id
    const events=async id=>(await db.query('SELECT * FROM protocol_events WHERE protocol_id=$1 ORDER BY id',[id])).rows
    // Old callers may omit every optional parameter; PostgREST uses named args.
    const defaultSave=await db.query(`SELECT save_protocol_with_events_v2(p_protocol_id=>NULL,p_name=>'Default payload',p_start_date=>current_date,p_compounds=>$1::jsonb) AS id`,[JSON.stringify([compound])])
    assert.ok(defaultSave.rows[0].id)
    await assert.rejects(save(null,'2099-01-01',undefined,null,'Not/AZone'),/Choose a valid timezone/)
    await db.exec("SET app.user_id=''")
    await assert.rejects(save(null,'2099-01-01'),/Not authenticated/)
    await db.exec('SET ROLE anon')
    await assert.rejects(save(null,'2099-01-01'),/permission denied/)
    await assert.rejects(db.query('SELECT public.continue_latest_phase(null,null,null)'),/permission denied for function continue_latest_phase/)
    await db.exec("SET ROLE authenticated; SET app.user_id='00000000-0000-0000-0000-000000000001'")
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
        if(date===past) {
          const prior=await events(id)
          rows[0].reconstitution_date=today
          assert.equal(await save(id,today,rows,null,zone),id,'exact reproduction: reconstitution change + start moved to today + no override succeeds')
          const updated=(await db.query('SELECT start_date::text FROM protocols WHERE id=$1',[id])).rows[0]
          assert.equal(updated.start_date,today)
          const after=await events(id)
          assert.ok(prior.every(e=>after.some(row=>JSON.stringify(row)===JSON.stringify(e))),'start-date edit must retain prior history verbatim')
          assert.equal((await db.query('SELECT reconstitution_date::text FROM compounds WHERE id=$1',[c.id])).rows[0].reconstitution_date,today)
          // Reconstitution-date-only edits need not emit a dosing event. A later
          // dose change makes the default SQL effective date directly observable.
          rows[0].phase.dosing_entry={...entry,dose:'4'}
          await save(id,today,rows,null,zone)
          const added=(await events(id)).filter(e=>!after.some(old=>old.id===e.id))
          assert.ok(added.some(e=>e.event_type==='dose_change'))
          assert.ok(added.every(e=>e.date.toISOString().slice(0,10)===today&&e.metadata.effectiveDate===today))
          await assert.rejects(save(id,today,rows,past,zone),/Effective date cannot be before the protocol start date\./)
          assert.equal(await save(id,today,rows,today,zone),id,'explicit effective = new start = today is inclusive')
          assert.equal((await db.query('SELECT id FROM compounds WHERE protocol_id=$1',[id])).rows[0].id,c.id)
          assert.equal((await db.query('SELECT id FROM phases WHERE compound_id=$1',[c.id])).rows[0].id,ph.id)
          await db.query("SELECT transition_protocol_v2($1,'complete',null,$2)",[id,zone])
          await db.query("SELECT transition_protocol_v2($1,'complete',null,$2)",[id,zone])
          const completed=(await events(id)).filter(e=>e.event_type==='completed')
          assert.equal(completed.length,1,'completion retries cannot duplicate events')
          assert.equal(completed[0].date.toISOString().slice(0,10),today)
          assert.equal(completed[0].metadata.effectiveDate,today)
        }
      }
      const plannedRows=[{...compound,reconstitution_date:today}]
      const scheduled=await save(null,future,plannedRows,null,zone)
      const originalScheduledEvents=await events(scheduled)
      assert.equal(originalScheduledEvents.length,2)
      assert.ok(originalScheduledEvents.every(e=>e.date.toISOString().slice(0,10)===future&&e.metadata.effectiveDate===future))
      const sc=(await db.query('SELECT id FROM compounds WHERE protocol_id=$1',[scheduled])).rows[0]
      const sp=(await db.query('SELECT id FROM phases WHERE compound_id=$1',[sc.id])).rows[0]
      await assert.rejects(db.query('SELECT continue_latest_phase($1,$2,$3)',[scheduled,sc.id,sp.id]),/Only an active protocol/)
      assert.deepEqual(await events(scheduled),originalScheduledEvents,'pre-start continuation cannot create history')
      const later=(await db.query('SELECT ($1::date+2)::text AS date',[future])).rows[0].date
      const revised=[{...compound,id:sc.id,notes:'Scheduled notes',vials_in_stock:5,reconstitution_date:past,phase:{...compound.phase,id:sp.id,end_week:6,frequency:'every3days',days_of_week:[],dosing_entry:{...entry,dose:'4'}}}]
      assert.equal(await save(scheduled,later,revised,null,zone),scheduled)
      await save(scheduled,later,revised,'1900-01-01',zone)
      const rescheduled=await events(scheduled)
      assert.deepEqual(rescheduled.map(e=>e.id),originalScheduledEvents.map(e=>e.id),'rescheduling preserves event identity and creates no duplicates')
      assert.ok(rescheduled.every(e=>e.date.toISOString().slice(0,10)===later&&e.metadata.effectiveDate===later))
      assert.equal(rescheduled.find(e=>e.event_type==='phase_started').metadata.newDose,4)
      assert.equal(rescheduled.filter(e=>e.event_type==='started').length,1)
      const stored=(await db.query('SELECT c.*,ph.id AS phase_id,ph.frequency,ph.end_week FROM compounds c JOIN phases ph ON ph.compound_id=c.id WHERE c.id=$1',[sc.id])).rows[0]
      assert.equal(stored.notes,'Scheduled notes');assert.equal(stored.vials_in_stock,5);assert.equal(stored.phase_id,sp.id)
      assert.equal(stored.reconstitution_date.toISOString().slice(0,10),past);assert.equal(stored.frequency,'every3days');assert.equal(stored.end_week,6)
      assert.equal((await db.query('SELECT status FROM protocols WHERE id=$1',[scheduled])).rows[0].status,'active','Scheduled is derived, not stored')
      // Moving a not-yet-started plan to today does not require activation either.
      await save(scheduled,today,revised,null,zone)
      assert.equal((await events(scheduled)).filter(e=>e.event_type==='started').length,1)
    }
    assert.equal((await db.query('SHOW timezone')).rows[0].TimeZone,'UTC','function timezone cannot leak to subsequent queries')
    // Previously saved future starts must not veto correction to a valid new start.
    const {today,future}=(await db.query("SELECT current_date::text AS today,(current_date+1)::text AS future")).rows[0]
    const legacy=(await db.query('SELECT save_protocol_with_events_v1(null,$1,$2,$3::jsonb) AS id',['Legacy future start',future,JSON.stringify([compound])])).rows[0].id
    const lc=(await db.query('SELECT id FROM compounds WHERE protocol_id=$1',[legacy])).rows[0]
    const lp=(await db.query('SELECT id FROM phases WHERE compound_id=$1',[lc.id])).rows[0]
    const legacyRows=[{...compound,id:lc.id,phase:{...compound.phase,id:lp.id}}]
    await assert.rejects(db.query("SELECT transition_protocol_v2($1,'complete',null,'UTC')",[legacy]),/Completion date cannot be before the protocol start date/)
    assert.equal(await save(legacy,today,legacyRows,null),legacy,'both v2 and nested v1 must use the submitted start date')
    await db.query("SELECT transition_protocol_v2($1,'complete',null,'UTC')",[legacy])
    assert.equal((await db.query('SELECT status FROM protocols WHERE id=$1',[legacy])).rows[0].status,'completed')
    const planned=await save(null,null,undefined,'2099-01-01')
    assert.equal((await events(planned)).length,0)
    assert.equal((await db.query('SELECT status FROM protocols WHERE id=$1',[planned])).rows[0].status,'planned')
    const pc=(await db.query('SELECT id FROM compounds WHERE protocol_id=$1',[planned])).rows[0]
    const pp=(await db.query('SELECT id FROM phases WHERE compound_id=$1',[pc.id])).rows[0]
    assert.equal(await save(planned,null,[{...compound,id:pc.id,reconstitution_date:today,phase:{...compound.phase,id:pp.id}}],null),planned)
    assert.equal((await events(planned)).length,0,'Planned edits still create no start event')
    const protectedScheduled=await save(null,future)
    const protectedEvents=await events(protectedScheduled)
    const ongoing=await save(null,'2000-01-01',[{...compound,phase:{...compound.phase,end_week:1}}])
    const ongoingPhase=(await db.query('SELECT ph.id,c.id AS compound_id FROM phases ph JOIN compounds c ON c.id=ph.compound_id WHERE c.protocol_id=$1',[ongoing])).rows[0]
    await db.query('SELECT continue_latest_phase($1,$2,$3)',[ongoing,ongoingPhase.compound_id,ongoingPhase.id])
    await db.query('SELECT continue_latest_phase($1,$2,$3)',[ongoing,ongoingPhase.compound_id,ongoingPhase.id])
    assert.equal((await events(ongoing)).filter(e=>e.event_type==='phase_continued').length,1,'started continuation remains idempotent')
    await db.exec("SET app.user_id='00000000-0000-0000-0000-000000000002'")
    await assert.rejects(db.query('SELECT continue_latest_phase($1,$2,$3)',[ongoing,ongoingPhase.compound_id,ongoingPhase.id]),/Only an active protocol you own/)
    await assert.rejects(save(planned,null),/Protocol not found/)
    await assert.rejects(save(protectedScheduled,future),/Protocol not found/)
    assert.equal((await events(protectedScheduled)).length,0,'RLS hides another owner\'s future events')
    assert.equal((await db.query('UPDATE protocols SET name=$1 WHERE id=$2 RETURNING id',['Forged',protectedScheduled])).rows.length,0)
    await assert.rejects(db.query('INSERT INTO protocol_events(user_id,protocol_id,date,event_type) VALUES($1,$2,current_date,$3)',
      ['00000000-0000-0000-0000-000000000001',protectedScheduled,'started']),/row-level security/)
    await db.exec("SET app.user_id='00000000-0000-0000-0000-000000000001'")
    assert.deepEqual(await events(protectedScheduled),protectedEvents,'failed cross-owner writes preserve prospective history')
  }finally{await db.close()}
})
