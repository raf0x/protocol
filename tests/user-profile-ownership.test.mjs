import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8')
const runtime=process.env.DOSING_PGLITE_PATH?pathToFileURL(process.env.DOSING_PGLITE_PATH):new URL('../node_modules/.mpp007-test/node_modules/@electric-sql/pglite/dist/index.js',import.meta.url)
const accountA='00000000-0000-0000-0000-000000000001',accountB='00000000-0000-0000-0000-000000000002'

function profileQueries(file) {
  const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),queries=[]
  function visit(node) {
    if(ts.isCallExpression(node)&&node.getText(source).startsWith("supabase.from('user_profiles')")&&!ts.isPropertyAccessExpression(node.parent)) queries.push(node.getText(source))
    ts.forEachChild(node,visit)
  }
  visit(source);return queries
}
function client(db) {
  const ident=value=>{assert.match(value,/^[a-z_]+$/);return `"${value}"`}
  return {from(table){
    assert.equal(table,'user_profiles');let fields='*',values=null,ownerColumn,ownerId,single=false
    const query={select(value){fields=value;return query},update(value){values=value;return query},eq(key,value){ownerColumn=key;ownerId=value;return query},limit(){return query},single(){single=true;return query},maybeSingle(){single=true;return query},async then(resolve,reject){
      try {
        const result=values?await db.query(`UPDATE public.user_profiles SET ${Object.keys(values).map((key,i)=>`${ident(key)}=$${i+1}`).join(',')} WHERE ${ident(ownerColumn)}=$${Object.keys(values).length+1} RETURNING *`,[...Object.values(values),ownerId]):
          await db.query(`SELECT ${fields==='*'?'*':fields.split(',').map(ident).join(',')} FROM public.user_profiles WHERE ${ident(ownerColumn)}=$1`,[ownerId])
        return resolve({data:single?result.rows[0]??null:result.rows,error:null})
      }catch(error){return reject(error)}
    }};return query
  }}
}

test('real Today/Profile queries use id ownership for two accounts; RLS rejects cross-owner and anonymous access',async()=>{
  const {PGlite}=await import(runtime.href),db=new PGlite()
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('app.user_id',true),'')::uuid$$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE user_profiles(id uuid PRIMARY KEY,weight_unit text,ai_processing_consent boolean DEFAULT false,ai_processing_consent_version int);
      ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
      CREATE POLICY owner ON user_profiles TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
      GRANT SELECT,UPDATE ON user_profiles TO authenticated;
      INSERT INTO user_profiles(id,weight_unit) VALUES('${accountA}','lbs'),('${accountB}','lbs');
      SET ROLE authenticated;`)
    const todayQueries=profileQueries('../app/protocol/page.tsx'),profilePageQueries=profileQueries('../app/profile/page.tsx')
    assert.equal(todayQueries.length,2);assert.equal(profilePageQueries.length,2)
    const queries=[...todayQueries,...profilePageQueries]
    for(const account of [accountA,accountB]) {
      await db.exec(`SET app.user_id='${account}'`)
      assert.equal((await client(db).from('user_profiles').select('weight_unit').eq('id',account).single()).data.weight_unit,'lbs','previous account writes did not change this account')
      for(const query of queries) {
        const result=await new Function('supabase','user','profileFields','unit','userId','newUnit',`return ${query}`)(client(db),{id:account},'weight_unit,ai_processing_consent,ai_processing_consent_version','kg',account,'kg')
        assert.ok(result.data,'profile access succeeds without a nonexistent-column probe')
        if(query.includes('.update(')) assert.deepEqual(result.data.map(row=>[row.id,row.weight_unit]),[[account,'kg']])
      }
      const other=account===accountA?accountB:accountA
      assert.deepEqual((await client(db).from('user_profiles').select('*').eq('id',other)).data,[])
      assert.deepEqual((await client(db).from('user_profiles').update({weight_unit:'forged'}).eq('id',other)).data,[])
    }
    await db.exec('SET ROLE anon')
    await assert.rejects(async()=>await client(db).from('user_profiles').select('*').eq('id',accountA),/permission denied/)
    await assert.rejects(async()=>await client(db).from('user_profiles').update({weight_unit:'forged'}).eq('id',accountB),/permission denied/)
  }finally{await db.close()}
})

test('empty profiles and ownership errors never trigger a nonexistent-column fallback',async()=>{
  const code=ts.transpileModule(read('../lib/userProfileOwnership.ts'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
  const {resolveUserProfileOwnership}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  for(const response of [{data:null,error:null},{data:[],error:null},{data:null,error:{code:'42501'}}]) {
    const calls=[]
    await resolveUserProfileOwnership(async key=>{calls.push(key);return response},data=>Array.isArray(data)?data.length>0:data!==null)
    assert.deepEqual(calls,['id'])
  }
})

test('read-only diagnostics find columns, views, functions, triggers and policies; account deletion preserves the other account',async()=>{
  const {PGlite}=await import(runtime.href),db=new PGlite()
  try {
    await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('app.user_id',true),'')::uuid$$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE auth.users(id uuid PRIMARY KEY);
      INSERT INTO auth.users VALUES('${accountA}'),('${accountB}');
      CREATE TABLE user_profiles(id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,weight_unit text);
      CREATE TABLE journal_entries(user_id uuid,notes text);
      ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
      CREATE POLICY owner ON user_profiles TO authenticated USING(id=auth.uid()) WITH CHECK(id=auth.uid());
      GRANT SELECT,UPDATE ON user_profiles TO authenticated;
      CREATE VIEW profile_summary AS SELECT id FROM user_profiles;
      CREATE FUNCTION profile_trigger() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN PERFORM 1 FROM user_profiles WHERE id=NEW.id; RETURN NEW; END$$;
      CREATE TRIGGER profile_change BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION profile_trigger();
      INSERT INTO user_profiles VALUES('${accountA}','lbs'),('${accountB}','kg');
      INSERT INTO journal_entries VALUES('${accountA}','A'),('${accountB}','B');`)
    const original=read('../supabase/migrations/202609150001_launch_blockers_v1.sql')
    const begin=original.indexOf('CREATE OR REPLACE FUNCTION public.delete_my_account_data_v1(')
    await db.exec(original.slice(begin,original.indexOf('END $function$;',begin)+'END $function$;'.length))
    await db.exec(`REVOKE ALL ON FUNCTION delete_my_account_data_v1(text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION delete_my_account_data_v1(text) TO authenticated,service_role;
      SET ROLE authenticated; SET app.user_id='${accountA}'`)
    await assert.rejects(db.query("SELECT delete_my_account_data_v1('DELETE')"),error=>error.code==='42703','reproduce the dynamic SQL caller before replacing it')
    await db.exec('RESET ROLE')
    assert.equal((await db.query('SELECT * FROM user_profiles')).rows.length,2,'the old failed call rolled back')
    assert.equal((await db.query('SELECT * FROM journal_entries')).rows.length,2,'a failed profile deletion rolls back earlier account deletions too')
    await db.exec('BEGIN READ ONLY')
    const diagnosis=(await db.exec(read('../supabase/preflight/user_profiles_ownership.sql')))[0].rows[0].user_profiles_diagnosis
    await db.exec('ROLLBACK')
    assert.deepEqual(diagnosis.columns.map(c=>c.name),['id','weight_unit'])
    assert.ok(diagnosis.views.some(v=>v.relname==='profile_summary'))
    assert.ok(diagnosis.functions.some(f=>f.proname==='delete_my_account_data_v1'))
    assert.ok(diagnosis.triggers.some(t=>t.tgname==='profile_change'))
    assert.equal(diagnosis.policies[0].qual,'(id = auth.uid())')
    const contract=async()=> (await db.query("SELECT oid,proowner,proacl::text,prosecdef,proconfig,pg_get_function_identity_arguments(oid) AS signature,pg_get_function_arguments(oid) AS arguments,pg_get_function_result(oid) AS result FROM pg_proc WHERE oid='public.delete_my_account_data_v1(text)'::regprocedure")).rows
    const before=await contract(),migration=read('../supabase/migrations/202609250001_profile_owner_key.sql')
    assert.equal(before[0].signature,'p_confirmation text');assert.equal(before[0].arguments,'p_confirmation text');assert.equal(before[0].result,'void')
    assert.equal(before[0].prosecdef,true);assert.deepEqual(before[0].proconfig,['search_path=public, pg_temp'])
    const expected=original.slice(begin,original.indexOf('END $function$;',begin)+'END $function$;'.length)
      .replace("'push_subscriptions','app_rate_limits','user_profiles']","'push_subscriptions','app_rate_limits']")
    const stripComments=value=>value.replace(/--[^\n]*/g,'').replace(/\s+/g,' ').trim()
    const replacement=migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION'),migration.indexOf('END $function$;')+'END $function$;'.length)
    assert.equal(stripComments(replacement),stripComments(expected),'the only executable change removes profiles from the user_id loop')
    for(let pass=0;pass<2;pass++) {
      await db.exec(migration)
      assert.deepEqual(await contract(),before,'signature identity, owner, all grants and security survive each application')
      const body=(await db.query("SELECT prosrc FROM pg_proc WHERE oid='public.delete_my_account_data_v1(text)'::regprocedure")).rows[0].prosrc
      assert.doesNotMatch(body,/user_profiles\s*\.\s*user_id/)
      assert.doesNotMatch(body.match(/FOREACH[\s\S]*?END LOOP/)[0],/user_profiles/)
      assert.match(body,/DELETE FROM public\.user_profiles WHERE id=uid/)
      assert.deepEqual((await db.query("SELECT has_function_privilege('anon','public.delete_my_account_data_v1(text)','EXECUTE') AS anon,has_function_privilege('authenticated','public.delete_my_account_data_v1(text)','EXECUTE') AS authenticated,has_function_privilege('service_role','public.delete_my_account_data_v1(text)','EXECUTE') AS service_role")).rows[0],{anon:false,authenticated:true,service_role:true})
    }
    await db.exec(`SET ROLE authenticated; SET app.user_id='${accountA}'`)
    await assert.rejects(db.query("SELECT delete_my_account_data_v1('wrong')"),/Type DELETE/)
    await db.query("SELECT delete_my_account_data_v1('DELETE')")
    await db.exec('RESET ROLE')
    assert.deepEqual((await db.query('SELECT id FROM user_profiles')).rows,[{id:accountB}])
    assert.deepEqual((await db.query('SELECT user_id FROM journal_entries')).rows,[{user_id:accountB}])
    await db.exec('SET ROLE anon')
    await assert.rejects(db.query("SELECT delete_my_account_data_v1('DELETE')"),/permission denied/)
    await db.exec("SET ROLE authenticated; SET app.user_id=''")
    await assert.rejects(db.query("SELECT delete_my_account_data_v1('DELETE')"),/Not authenticated/)
    await db.exec(`SET app.user_id='${accountB}'`)
    await db.query("SELECT delete_my_account_data_v1('DELETE')")
    await db.exec('RESET ROLE')
    assert.equal((await db.query('SELECT * FROM user_profiles')).rows.length,0)
  }finally{await db.close()}
})
