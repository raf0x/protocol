import assert from 'node:assert/strict'
import {test} from 'node:test'
import {readFileSync} from 'node:fs'
import ts from 'typescript'
const load=async(file)=>{
 const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
 return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}
const {phaseEndWeek,expiredLatestPhase}=await load('../lib/health/phaseLifecycle.ts')
const {currentPhase}=await load('../lib/health/dosing.ts')
const {quickEntryPayload}=await load('../lib/health/dosingEntry.ts')
const old={id:'old',start_week:1,end_week:4}
test('ongoing active phase remains current; resolver stays strict for expired phase',()=>{
 const ongoing={...old,end_week:null}
 assert.equal(currentPhase([ongoing],'2026-04-20','2026-09-09'),ongoing)
 assert.equal(expiredLatestPhase([ongoing],'active','2026-04-20','2026-09-09'),null)
 assert.equal(currentPhase([old],'2026-04-20','2026-09-09'),null)
 assert.equal(expiredLatestPhase([old],'active','2026-04-20','2026-09-09'),old)
})
test('completed, future, overlapping and tied phases do not offer inferred continuation',()=>{
 assert.equal(expiredLatestPhase([old],'completed','2026-04-20','2026-09-09'),null)
 assert.equal(expiredLatestPhase([old,{id:'future',start_week:40,end_week:44}],'active','2026-04-20','2026-09-09'),null)
 assert.equal(expiredLatestPhase([old,{...old,id:'tie'}],'active','2026-04-20','2026-09-09'),null)
})
test('last new phase defaults ongoing; explicit phase lengths and previous boundaries stay intact',()=>{
 assert.equal(phaseEndWeek(5,''),null)
 assert.equal(phaseEndWeek(5,'12'),16)
 assert.equal(phaseEndWeek(1,'4'),4)
 assert.equal(quickEntryPayload({name:'Any medication'}).compounds[0].phase.end_week,null)
 const latest={id:'latest',start_week:5,end_week:8}, phases=[old,latest]
 assert.equal(expiredLatestPhase(phases,'active','2026-04-20','2026-09-09'),latest)
 assert.deepEqual(phases,[{id:'old',start_week:1,end_week:4},{id:'latest',start_week:5,end_week:8}])
 assert.throws(()=>phaseEndWeek(1,'-1'))
})
