import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import {pathToFileURL} from 'node:url'
import ts from 'typescript'
const code=ts.transpileModule(readFileSync(new URL('../lib/health/dosingEntry.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const {entryFromForm,interpretEntry,dosingDisplay,entryFormState,validDate,quickEntryPayload}=await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
const entry=(values={})=>entryFromForm({input_mode:'syringe',syringe_markings:'18',syringe_scale:'100',vial_strength:'50',vial_unit:'mg',bac_water_ml:'3',...values})
for(const unit of ['mg','mcg','IU']) test(`medication ${unit} stays a medication dose`,()=>{
  const e=entry({input_mode:'medication',dose:'250',dose_unit:unit,vial_unit:unit})
  assert.deepEqual(interpretEntry(e).medication,{value:250,unit})
})
test('mass markings calculate distinct quantities only with complete data',()=>{
 const r=interpretEntry(entry());assert.equal(r.medication.value,3);assert.equal(r.volume,.18);assert.equal(r.markings,18)
 const e=entry({vial_strength:'',bac_water_ml:''}), partial=interpretEntry(e)
 assert.equal(partial.medication,null);assert.equal(partial.volume,.18)
 assert.equal(dosingDisplay({dosing_entry:e}).primary,'18 U-100 units')
 assert.match(dosingDisplay({dosing_entry:e}).secondary,/Medication dose not calculated/)
})
test('volume only and incomplete scale can save without medication calculation',()=>{
 const e=entry({input_mode:'volume',injection_volume:'.5',vial_strength:'',bac_water_ml:'',syringe_scale:'',syringe_markings:''})
 assert.equal(interpretEntry(e).volume,.5);assert.equal(dosingDisplay({dosing_entry:e}).primary,'0.5 mL')
 assert.equal(interpretEntry(entry({syringe_scale:''})).medication,null)
})
test('legacy ambiguous entry remains raw and unknown; unknown math requires confirmation',()=>{
 const form=entryFormState({dose:50,dose_unit:'IU'})
 const e=entryFromForm(form);assert.equal(e.mode,'unknown');assert.equal(e.dose,'50');assert.equal(e.dose_unit,'IU');assert.equal(entryFormState({dosing_entry:e}).legacy_value,'50')
 assert.equal(interpretEntry(e).medication,null)
 const uncertain=entry({input_mode:'unknown',vial_label:'Label text retained'})
 assert.equal(interpretEntry(uncertain).medication,null);assert.equal(interpretEntry(uncertain).candidate.value,3)
 assert.equal(interpretEntry({...uncertain,review_status:'confirmed'}).medication.value,3)
 assert.equal(entryFormState({dosing_entry:uncertain}).vial_label,'Label text retained')
})
test('mass/IU mismatch and incomplete concentration produce warnings without throwing',()=>{
 const e=entry({input_mode:'medication',dose:'250',dose_unit:'IU'})
 const r=interpretEntry(e);assert.equal(r.medication.unit,'IU');assert.equal(r.volume,null);assert.match(r.warnings.join(' '),/no IU-to-mass/)
 assert.doesNotThrow(()=>interpretEntry(entry({concentration_value:'200',concentration_unit:''})))
 assert.doesNotThrow(()=>quickEntryPayload({name:'Any',dose:250,dose_unit:'IU',vial:5,vial_unit:'mg'}))
})
test('negative, nonnumeric and zero scale block; incomplete and zero amounts do not',()=>{
 for(const value of ['-1','NaN','Infinity','abc']) assert.throws(()=>entry({syringe_markings:value}))
 assert.throws(()=>entry({syringe_scale:'0'}))
 assert.doesNotThrow(()=>entry({syringe_markings:'0',vial_strength:'',bac_water_ml:''}))
 assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2026-02-28'),true)
 assert.throws(()=>quickEntryPayload({name:''}))
})

test('SQL V2 saves incomplete and legacy entries without changing legacy columns; invalid saves roll back', {skip:!process.env.DOSING_PGLITE_PATH}, async()=>{
 const {PGlite}=await import(pathToFileURL(process.env.DOSING_PGLITE_PATH).href), db=new PGlite()
 try {
 await db.exec(`CREATE ROLE authenticated;CREATE SCHEMA auth;
 CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;
 CREATE TABLE protocols(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,name text,start_date date,status text DEFAULT 'active',continued_from_protocol_id uuid);
 CREATE TABLE compounds(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,protocol_id uuid REFERENCES protocols(id),name text,vial_strength numeric,vial_unit text,bac_water_ml numeric,reconstitution_date date,notes text,vials_in_stock int,ml_per_dose numeric);
 CREATE TABLE phases(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,compound_id uuid REFERENCES compounds(id),name text,dose numeric NOT NULL,dose_unit text NOT NULL,start_week int,end_week int,duration_weeks int,frequency text,days_of_week int[],day_of_week int,time_of_day text);
 CREATE TABLE protocol_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),user_id uuid,protocol_id uuid,date date,event_type text,description text);
 INSERT INTO protocols(id,user_id,name,start_date) VALUES('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Old','2026-01-01');
 INSERT INTO compounds(id,user_id,protocol_id,name) VALUES('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Old');
 INSERT INTO phases(id,user_id,compound_id,dose,dose_unit,start_week,end_week) VALUES('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',50,'IU',1,12);`)
 for(const file of ['202609090001_dosing_semantics_v1.sql','202609100001_advisory_dosing.sql','202609100001_advisory_dosing.sql']) await db.exec(readFileSync(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'))
 assert.equal((await db.query('select dosing_entry from phases')).rows[0].dosing_entry,null)
 await db.exec(`GRANT USAGE ON SCHEMA auth TO authenticated;`)
 for(const table of ['protocols','compounds','phases','protocol_events']) await db.exec(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;CREATE POLICY owner ON ${table} TO authenticated USING(user_id=auth.uid()) WITH CHECK(user_id=auth.uid());GRANT SELECT,INSERT,UPDATE,DELETE ON ${table} TO authenticated;`)
 await db.exec(`SET ROLE authenticated;SET app.user_id='00000000-0000-0000-0000-000000000001';`)
 const save=(e,pid=null,cid=null,phid=null)=>db.query('select save_protocol_dosing_v2($1,$2,$3,$4::jsonb) as id',[pid,'Saved','2026-01-01',JSON.stringify([{id:cid,name:'Any compound',phase:{id:phid,dosing_entry:e,start_week:1,end_week:12,frequency:''}}])])
 const examples=[entry({vial_strength:'',bac_water_ml:''}),entry({input_mode:'medication',dose:'250',dose_unit:'IU'}),entry({input_mode:'volume',injection_volume:'.5',vial_strength:''}),entryFromForm(entryFormState({dose:50,dose_unit:'IU'})),entry({input_mode:'unknown',vial_label:'Unknown label'})]
 for(const e of examples) {
  const result=await save(e)
  const saved=(await db.query('select p.* from phases p join compounds c on c.id=p.compound_id where c.protocol_id=$1',[result.rows[0].id])).rows[0]
  assert.deepEqual(saved.dosing_entry,e);assert.equal(saved.dose,null);assert.equal(saved.dose_unit,null)
 }
 await save(examples[3],'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001')
 const legacy=(await db.query("select * from phases where id='30000000-0000-0000-0000-000000000001'")).rows[0]
 assert.equal(Number(legacy.dose),50);assert.equal(legacy.dose_unit,'IU');assert.equal(legacy.dose_semantics_version,null)
 const count=async()=>Number((await db.query('select count(*) from protocols')).rows[0].count), before=await count()
 for(const bad of [{...examples[0],syringe_markings:'-1'},{...examples[0],syringe_scale:'0'},{...examples[0],dose:'NaN'}]) await assert.rejects(save(bad))
 assert.equal(await count(),before)
 await db.exec(`SET app.user_id='00000000-0000-0000-0000-000000000002';`)
 await assert.rejects(save(examples[0],'10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'))
 await db.exec(`RESET ROLE;`)
 for(let i=0;i<2;i++) await db.exec(readFileSync(new URL('../supabase/migrations/202609110001_continue_latest_phase.sql',import.meta.url),'utf8'))
 await db.exec(`SET ROLE authenticated;SET app.user_id='00000000-0000-0000-0000-000000000001';`)
 const pid='10000000-0000-0000-0000-000000000001',cid='20000000-0000-0000-0000-000000000001',phid='30000000-0000-0000-0000-000000000001'
 const continuePhase=()=>db.query('select continue_latest_phase($1,$2,$3)',[pid,cid,phid])
 const phaseBefore=(await db.query('select * from phases where id=$1',[phid])).rows[0]
 await continuePhase()
 const phaseAfter=(await db.query('select * from phases where id=$1',[phid])).rows[0]
 assert.deepEqual(phaseAfter,{...phaseBefore,end_week:null,duration_weeks:null})
 await db.query('update protocols set status=$1 where id=$2',['completed',pid])
 await assert.rejects(continuePhase(),/active protocol/)
 assert.deepEqual((await db.query('select * from phases where id=$1',[phid])).rows[0],phaseAfter)
 await db.query('update protocols set status=$1 where id=$2',['active',pid])
 await db.query('update phases set end_week=4,duration_weeks=4 where id=$1',[phid])
 const later=(await db.query("insert into phases(user_id,compound_id,dose,dose_unit,start_week,end_week,duration_weeks,dosing_entry) values(auth.uid(),$1,NULL,NULL,5,8,4,$2::jsonb) returning id",[cid,JSON.stringify(examples[0])])).rows[0].id
 await assert.rejects(continuePhase(),/unique latest/)
 await db.query('select continue_latest_phase($1,$2,$3)',[pid,cid,later])
 assert.equal((await db.query('select end_week from phases where id=$1',[phid])).rows[0].end_week,4)
 assert.equal((await db.query('select end_week from phases where id=$1',[later])).rows[0].end_week,null)
 await db.exec(`SET app.user_id='00000000-0000-0000-0000-000000000002';`)
 await assert.rejects(db.query('select continue_latest_phase($1,$2,$3)',[pid,cid,later]))
 } finally {await db.close()}
})
