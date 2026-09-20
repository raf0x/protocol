import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'

const runtime=process.env.DOSING_PGLITE_PATH?pathToFileURL(process.env.DOSING_PGLITE_PATH):new URL('../node_modules/.mpp007-test/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url)
test('inventory migration, ownership, constraints, confirmation, retries and protocol isolation', {skip:!existsSync(runtime)}, async()=>{
  const {PGlite}=await import(runtime.href), db=new PGlite()
  const owner='00000000-0000-0000-0000-000000000001',other='00000000-0000-0000-0000-000000000002'
  const item={item_name:'Test item',form:'lyophilized vial',vial_strength:10,strength_unit:'mg',quantity:2,acquisition_date:'2026-09-01',expiration_date:'2027-09-01',lot_number:'batch',reconstitution_status:'not reconstituted',reconstitution_date:null,notes:null}
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
      CREATE TABLE auth.users(id uuid PRIMARY KEY); INSERT INTO auth.users VALUES('${owner}'),('${other}');
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE protocols(id int PRIMARY KEY,status text); INSERT INTO protocols VALUES(1,'active'),(2,'planned');
      CREATE TABLE compounds(id int PRIMARY KEY,vials_in_stock int); INSERT INTO compounds VALUES(1,7);
      CREATE TABLE phases(id int PRIMARY KEY); INSERT INTO phases VALUES(1);
      CREATE TABLE schedules(id int PRIMARY KEY); INSERT INTO schedules VALUES(1);
      CREATE TABLE doses(id int PRIMARY KEY); INSERT INTO doses VALUES(1);
      CREATE TABLE protocol_events(id int PRIMARY KEY,event_type text); INSERT INTO protocol_events VALUES(1,'started');`)
    const snapshot=async()=>Promise.all(['protocols','compounds','phases','schedules','doses','protocol_events'].map(async table=>(await db.query(`SELECT * FROM ${table} ORDER BY id`)).rows))
    const before=await snapshot()
    const migration=readFileSync(new URL('../supabase/migrations/202609210001_inventory.sql',import.meta.url),'utf8')
    await db.exec(migration); await db.exec(migration)
    await db.exec(`SET ROLE authenticated; SET app.user_id='${owner}'`)
    const call=async(rows=[item],id=randomUUID(),confirmed=true)=>(await db.query('SELECT import_inventory_v1($1,$2::jsonb,$3) AS result',[id,JSON.stringify(rows),confirmed])).rows[0].result
    const count=async()=>Number((await db.query('SELECT count(*) FROM inventory_items')).rows[0].count)
    await assert.rejects(call([item],randomUUID(),false),/confirm/); assert.equal(await count(),0)
    await assert.rejects(call([item,{...item,quantity:0}]),/check constraint/); assert.equal(await count(),0)
    const invalid=[{quantity:1.5},{item_name:''},{form:'tablet'},{strength_unit:'mL'},{vial_strength:-1},{strength_unit:null},{acquisition_date:'2026-02-30'},{acquisition_date:'2026-9-1'},{expiration_date:'2026-08-01'},{reconstitution_status:'reconstituted'},{reconstitution_date:'2026-09-01'},{reconstitution_status:'reconstituted',reconstitution_date:'2026-08-01'},{user_id:other},{protocol_id:'fake'}]
    for(const patch of invalid) await assert.rejects(call([{...item,...patch}]),undefined,JSON.stringify(patch))
    await assert.rejects(call([]),/1 and 500/); await assert.rejects(call(Array(501).fill(item)),/1 and 500/)
    assert.equal(await count(),0)
    const id=randomUUID()
    const results=await Promise.all([call([item],id),call([item],id)])
    assert.deepEqual(results,[{inserted:1,duplicates:0},{inserted:1,duplicates:0}]); assert.equal(await count(),1)
    const saved=(await db.query('SELECT * FROM inventory_items')).rows[0]
    assert.equal(saved.user_id,owner); assert.ok(saved.id); assert.ok(saved.created_at); assert.ok(saved.updated_at)
    assert.deepEqual(await call([item,item]),{inserted:0,duplicates:2})
    // Numeric scale cannot bypass the duplicate key.
    const scaled=JSON.stringify([item]).replace('"vial_strength":10','"vial_strength":10.00')
    assert.deepEqual((await db.query('SELECT import_inventory_v1($1,$2::jsonb,true) AS result',[randomUUID(),scaled])).rows[0].result,{inserted:0,duplicates:1})
    await assert.rejects(call([{...item,quantity:3}],id),/different rows/)
    await assert.rejects(db.query('INSERT INTO inventory_items(user_id,item_name,form,quantity,reconstitution_status,identity_key) VALUES($1,$2,$3,1,$4,$5)',[owner,'bypass','other','unknown','fake']),/permission denied/)
    await assert.rejects(db.query('UPDATE inventory_items SET quantity=3'),/permission denied/)
    await assert.rejects(db.query('SELECT * FROM inventory_imports'),/permission denied/)
    await db.exec(`SET app.user_id='${other}'`)
    assert.equal(await count(),0)
    await db.query('DELETE FROM inventory_items WHERE id=$1',[saved.id])
    assert.deepEqual(await call([item],id),{inserted:1,duplicates:0}); assert.equal(await count(),1)
    await db.exec(`SET app.user_id='${owner}'`); assert.equal(await count(),1)
    await db.query('DELETE FROM inventory_items WHERE id=$1',[saved.id]); assert.equal(await count(),0)
    assert.deepEqual(await call([item],id),{inserted:1,duplicates:0}); assert.equal(await count(),0,'retry after deletion must not resurrect')
    await db.exec("SET app.user_id=''"); await assert.rejects(call(),/Sign in/)
    await db.exec('SET ROLE anon'); await assert.rejects(call(),/permission denied/)
    await db.exec('RESET ROLE')
    assert.deepEqual(await snapshot(),before,'inventory must never alter protocol, stock, phases, schedules, doses or events')
    await db.exec(migration)
    assert.equal((await db.query('SELECT count(*)::int AS n FROM inventory_items')).rows[0].n,1,'rerun preserves existing inventory')
  } finally { await db.close() }
})
