import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const dependency = process.env.LABS_PGLITE_PATH
const migration = readFileSync(new URL('../supabase/migrations/202609120001_labs_v1.sql',import.meta.url),'utf8')
test('Labs SQL: atomic saves, reference statuses, ownership isolation, permissions, and safe rerun', { skip: !dependency }, async t => {
  const { PGlite } = await import(pathToFileURL(dependency).href)
  const db = new PGlite()
  const alice='11111111-1111-4111-8111-111111111111', bob='22222222-2222-4222-8222-222222222222'
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;
    INSERT INTO auth.users VALUES ('${alice}'),('${bob}');`)
  await db.exec(migration)
  await db.exec(`SET ROLE authenticated; SET request.jwt.claim.sub='${alice}';`)
  const panel={test_date:'2026-09-01',panel_name:'SQL test',user_id:bob}
  const row={biomarker_name:'Marker',value:12,unit:'test-unit',reference_low:10,reference_high:20}
  const save=async(results,p=panel)=>(await db.query('SELECT public.save_lab_panel_v1($1::jsonb,$2::jsonb) AS id',[JSON.stringify(p),JSON.stringify(results)])).rows[0].id
  let panelId
  try {
    await t.test('create panel and multiple results; server derives statuses and preserves explicit abnormal',async()=>{
      panelId=await save([row,{...row,value:9},{...row,value:21},{...row,value:12,status:'abnormal',status_source:'reported'},{...row,reference_low:null,reference_high:null}])
      const results=(await db.query('SELECT status FROM public.lab_results')).rows.map(row=>row.status).sort()
      assert.deepEqual(results,['abnormal','high','low','normal','unknown'])
      assert.equal((await db.query('SELECT user_id FROM public.lab_panels')).rows[0].user_id,alice)
    })
    await t.test('invalid later row rolls back the whole new panel; empty/missing/nonfinite/inverted results rejected',async()=>{
      const before=(await db.query('SELECT count(*)::int AS n FROM public.lab_panels')).rows[0].n
      for(const results of [[row,{...row,biomarker_name:''}],[],[{...row,value:null}],[{...row,value:'NaN'}],[{...row,reference_low:30}]]) await assert.rejects(save(results))
      await assert.rejects(save([row],{...panel,test_date:'2026-02-30'}))
      assert.equal((await db.query('SELECT count(*)::int AS n FROM public.lab_panels')).rows[0].n,before)
    })
    await t.test('other users cannot read, spoof ownership, attach children, update or delete',async()=>{
      await db.exec(`SET request.jwt.claim.sub='${bob}';`)
      assert.equal((await db.query('SELECT * FROM public.lab_panels')).rows.length,0)
      assert.equal((await db.query('SELECT * FROM public.lab_results')).rows.length,0)
      await assert.rejects(db.query('INSERT INTO public.lab_panels(user_id,test_date) VALUES($1,$2)',[alice,'2026-09-01']))
      await assert.rejects(db.query('INSERT INTO public.lab_results(user_id,lab_panel_id,biomarker_name,value) VALUES($1,$2,$3,1)',[bob,panelId,'Foreign child']))
      await assert.rejects(db.query('UPDATE public.lab_panels SET panel_name=$1 WHERE id=$2',['Changed',panelId]))
      await assert.rejects(db.query('DELETE FROM public.lab_panels WHERE id=$1',[panelId]))
      await save([row])
      assert.equal((await db.query('SELECT * FROM public.lab_panels')).rows.length,1)
    })
    await t.test('anonymous requests cannot read or invoke save',async()=>{
      await db.exec('RESET ROLE; SET ROLE anon;')
      await assert.rejects(db.query('SELECT * FROM public.lab_panels'))
      await assert.rejects(save([row]))
    })
    await t.test('rerun preserves all existing lab rows and timestamps',async()=>{
      await db.exec('RESET ROLE;')
      const before=JSON.stringify((await db.query('SELECT * FROM public.lab_panels ORDER BY id')).rows)
      const resultsBefore=JSON.stringify((await db.query('SELECT * FROM public.lab_results ORDER BY id')).rows)
      await db.exec(migration)
      assert.equal(JSON.stringify((await db.query('SELECT * FROM public.lab_panels ORDER BY id')).rows),before)
      assert.equal(JSON.stringify((await db.query('SELECT * FROM public.lab_results ORDER BY id')).rows),resultsBefore)
    })
  } finally { await db.close() }
})
