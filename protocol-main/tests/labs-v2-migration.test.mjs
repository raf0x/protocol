import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
const dependency=process.env.LABS_PGLITE_PATH
test('Labs V2 SQL: edit/import/delete, audit, review, ownership and reruns',{skip:!dependency},async t=>{
 const {PGlite}=await import(pathToFileURL(dependency).href);const db=new PGlite()
 const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222'
 await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth,public TO authenticated,anon;INSERT INTO auth.users VALUES('${a}'),('${b}');`)
 const v1=readFileSync(new URL('../supabase/migrations/202609120001_labs_v1.sql',import.meta.url),'utf8'),v2=readFileSync(new URL('../supabase/migrations/202609130001_labs_v2_edit_import.sql',import.meta.url),'utf8')
 await db.exec(v1);await db.exec(v2);await db.exec(`SET ROLE authenticated;SET request.jwt.claim.sub='${a}';`)
 const metadata={test_date:'2026-09-01',panel_name:'Example',source_type:'csv',source_filename:'example.csv',source_metadata:{parser:'test'},review_confirmed:true}
 const row={biomarker_name:'Marker',value:12,unit:'mg/L',reference_low:10,reference_high:20,source_row_index:2,source_raw:{cells:['Marker','12']},import_confidence:'medium',review_confirmed:true}
 const save=async(id,stamp,p,rows)=>(await db.query('SELECT public.save_lab_panel_v2($1,$2,$3::jsonb,$4::jsonb) AS id',[id,stamp,JSON.stringify(p),JSON.stringify(rows)])).rows[0].id
 const get=async(id)=>(await db.query('SELECT *,test_date::text AS date_text,updated_at::text AS stamp FROM public.lab_panels WHERE id=$1',[id])).rows[0]
 const children=async(id)=>(await db.query('SELECT *,updated_at::text AS stamp FROM public.lab_results WHERE lab_panel_id=$1 ORDER BY id',[id])).rows
 let id,original,child,latest
 try{
  await t.test('atomic mixed import requires explicit panel and row review and preserves provenance',async()=>{
   await assert.rejects(save(null,null,{...metadata,review_confirmed:false},[row]),/Confirm/)
   await assert.rejects(save(null,null,metadata,[{...row,review_confirmed:false}]),/confirmed/)
   assert.equal((await db.query('SELECT * FROM public.lab_panels')).rows.length,0)
   id=await save(null,null,metadata,[row,{...row,value:null,value_text:'Negative'}]);original=await get(id);child=(await children(id))[0]
   assert.equal(original.source_type,'csv');assert.equal(original.source_filename,'example.csv');assert.ok(original.source_metadata.reviewed_at);assert.deepEqual(child.source_raw,row.source_raw)
  })
  await t.test('edit metadata/results, add and remove rows atomically without replacing existing IDs or created_at',async()=>{
   await save(id,original.updated_at,{...metadata,test_date:'2026-08-01',panel_name:'Edited'},[{...row,id:child.id,value:15},{...row,biomarker_name:'Added',value:22}]);latest=await get(id)
   const updated=(await children(id)).find(r=>r.id===child.id)
   assert.equal(latest.date_text,'2026-08-01');assert.equal(latest.panel_name,'Edited');assert.equal(Number(updated.value),15)
   assert.equal(String(latest.created_at),String(original.created_at));assert.equal(String(updated.created_at),String(child.created_at));assert.notEqual(latest.stamp,original.stamp);assert.notEqual(updated.stamp,child.stamp);assert.equal((await children(id)).length,2)
  })
  await t.test('stale edits and invalid later rows roll back; imported raw fields remain unchanged',async()=>{
   await assert.rejects(save(id,original.updated_at,metadata,[row]),/changed/)
   const before=JSON.stringify(await get(id));await assert.rejects(save(id,latest.updated_at,metadata,[{...row,id:child.id,value:1},{...row,biomarker_name:''}]))
   assert.equal(JSON.stringify(await get(id)),before)
   await db.query("UPDATE public.lab_results SET source_raw='{}',created_at='2000-01-01' WHERE id=$1",[child.id])
   const record=(await children(id)).find(r=>r.id===child.id);assert.deepEqual(record.source_raw,row.source_raw);assert.equal(String(record.created_at),String(child.created_at))
  })
  await t.test('another owner cannot update/delete or inject a foreign result ID',async()=>{
   await db.exec(`SET request.jwt.claim.sub='${b}';`)
   await assert.rejects(save(id,latest.updated_at,metadata,[row]),/not available/)
   await assert.rejects(db.query('SELECT public.delete_lab_panel_v2($1,$2)',[id,latest.updated_at]),/not available/)
   assert.equal((await db.query('UPDATE public.lab_panels SET panel_name=$1 WHERE id=$2 RETURNING id',['bad',id])).rows.length,0)
   assert.equal((await db.query('DELETE FROM public.lab_panels WHERE id=$1 RETURNING id',[id])).rows.length,0)
   await assert.rejects(save(null,null,metadata,[{...row,id:child.id}]),/not available/)
   await db.exec(`SET request.jwt.claim.sub='${a}';`)
  })
  await t.test('migration rerun preserves imported rows and current timestamps',async()=>{
   const before=JSON.stringify(await get(id)),rowsBefore=JSON.stringify(await children(id));await db.exec('RESET ROLE');await db.exec(v2);await db.exec(`SET ROLE authenticated;SET request.jwt.claim.sub='${a}';`)
   assert.equal(JSON.stringify(await get(id)),before);assert.equal(JSON.stringify(await children(id)),rowsBefore)
  })
  await t.test('owned delete checks version and cascades results only after confirmation call',async()=>{
   await assert.rejects(db.query('SELECT public.delete_lab_panel_v2($1,$2)',[id,original.updated_at]),/changed/)
   await db.query('SELECT public.delete_lab_panel_v2($1,$2)',[id,(await get(id)).updated_at]);assert.equal(await get(id),undefined);assert.equal((await children(id)).length,0)
  })
 }finally{await db.close()}
})
