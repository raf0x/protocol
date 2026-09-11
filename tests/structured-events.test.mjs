import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
function load(path) {
  const url = path.startsWith('file:') ? new URL(path) : new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name.endsWith('/supabase') || name === '../supabase') return { createClient() { throw new Error('client must be injected') } }
    if (!name.startsWith('.')) return require(name)
    for (const suffix of ['', '.ts', '.tsx']) { try { return load(new URL(name + suffix, url).href) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    throw new Error(`Missing ${name}`)
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}

const migration = readFileSync(new URL('../supabase/migrations/202609140001_structured_protocol_events.sql', import.meta.url), 'utf8')
const manage = readFileSync(new URL('../app/protocol/manage/page.tsx', import.meta.url), 'utf8')
const quick = readFileSync(new URL('../app/api/create-protocol/route.ts', import.meta.url), 'utf8')
const detail = readFileSync(new URL('../components/protocols/ProtocolDetail.tsx', import.meta.url), 'utf8')
const doseAction = readFileSync(new URL('../components/protocols/DoseChangeAction.tsx', import.meta.url), 'utf8')
const mutations = load('../lib/health/protocolMutations.ts')
const timeline = load('../lib/health/timeline.ts')
const overlay = load('../lib/health/protocolOverlay.ts')
const client = (response = { data: 'saved-id', error: null }) => ({ calls: [], rpc(name, payload) { this.calls.push([name, payload]); return Promise.resolve(response) } })
const eventRow = (overrides = {}) => ({ id: 'e1', date: '2026-09-10', event_type: 'dose_change', description: 'Dosing updated', protocol_id: 'p1', compound_id: 'c1',
  metadata: { previousDose: 5, previousUnit: 'mg', newDose: 7.5, newUnit: 'mg', effectiveDate: '2026-09-10' },
  protocols: { id: 'p1', name: 'Plan', start_date: '2026-01-01', status: 'active', compounds: [] }, compounds: { id: 'c1', name: 'Compound', phases: [] }, ...overrides })

test('dose change uses one atomic mutation RPC', async () => { const c = client(); await mutations.changeProtocolDose({ protocolId:'p1',compoundId:'c1',dosingEntry:{},effectiveDate:'2026-09-10' },c); assert.equal(c.calls[0][0],'change_protocol_dose_v1') })
test('dose mutation payload carries the effective date', async () => { const c=client(); await mutations.changeProtocolDose({protocolId:'p',compoundId:'c',dosingEntry:{},effectiveDate:'2026-08-01'},c); assert.equal(c.calls[0][1].p_effective_date,'2026-08-01') })
test('protocol save uses the structured wrapper RPC', async () => { const c=client(); await mutations.saveProtocolWithEvents({protocolId:'p',name:'Plan',startDate:'2026-01-01',compounds:[],effectiveDate:'2026-09-10'},c); assert.equal(c.calls[0][0],'save_protocol_with_events_v1') })
test('failed event transaction is surfaced rather than reported as saved', async () => await assert.rejects(mutations.transitionProtocol({protocolId:'p',action:'pause',effectiveDate:'2026-09-10'},client({data:null,error:{message:'rollback'}})),/rollback/))
test('structured dose event stores previous and new dose and unit', () => { for (const field of ['previousDose','previousUnit','newDose','newUnit']) assert.match(migration,new RegExp(`'${field}'`)) })
test('unchanged dose is compared before an event is inserted', () => assert.match(migration,/doseFingerprint' IS DISTINCT FROM current_state->'doseFingerprint/))
test('notes-only edits are excluded from the dosing fingerprint', () => { const helper=migration.slice(migration.indexOf("'doseFingerprint'"),migration.indexOf('CREATE OR REPLACE FUNCTION public.save_protocol_with_events_v1')); assert.doesNotMatch(helper,/notes/) })
test('editor defaults changes to today', () => assert.match(manage,/effectiveDate: changeHappenedEarlier \? effectiveDate : today/))
test('editor offers a lightweight backdate option', () => assert.match(manage,/These changes happened earlier/))
test('new phase insertion creates phase_started history', () => assert.match(migration,/previous IS NULL[\s\S]+?'phase_started'/))
test('pause is a one-tap structured transition', async () => { const c=client(); await mutations.transitionProtocol({protocolId:'p',action:'pause',effectiveDate:'2026-09-10'},c); assert.equal(c.calls[0][1].p_action,'pause'); assert.match(detail,/Pause protocol/) })
test('resume is a one-tap structured transition', async () => { const c=client(); await mutations.transitionProtocol({protocolId:'p',action:'resume',effectiveDate:'2026-09-10'},c); assert.equal(c.calls[0][1].p_action,'resume'); assert.match(detail,/Resume protocol/) })
test('pause interval is reconstructable from ordered status events', () => { const p={id:'p',name:'P',start_date:'2026-01-01',status:'active',compounds:[]}; const events=[{id:'1',date:'2026-02-01',event_type:'paused',protocol_id:'p',compound_id:null},{id:'2',date:'2026-02-10',event_type:'resumed',protocol_id:'p',compound_id:null}]; assert.equal(overlay.protocolActiveOnDate(p,'2026-02-05',events),false); assert.equal(overlay.protocolActiveOnDate(p,'2026-02-11',events),true) })
test('completion updates state and emits history in one function', () => assert.match(migration,/UPDATE protocols SET status=next_status,completed_date=effective::timestamptz[\s\S]+INSERT INTO protocol_events/))
test('completion confirmation supports today or another date', () => { assert.match(manage,/This protocol ended earlier/); assert.match(manage,/completionHappenedEarlier \? completionDate : today/) })
test('later dose changes preserve the prior phase boundary and values', () => { assert.match(migration,/UPDATE phases SET end_week=wk-1/); assert.match(migration,/existing\.frequency,existing\.days_of_week/) })
test('incomplete dosing can still be represented in event state', () => assert.match(migration,/'doseConfirmed'.+CASE/s))
test('medication IU and syringe markings remain separate keys', () => { assert.match(migration,/'medicationUnit'/); assert.match(migration,/'syringeMarkings'/); assert.doesNotMatch(doseAction,/IU.*syringe|syringe.*IU/i) })
test('Timeline consumes structured dose metadata automatically', () => { const item=timeline.normalizeTimeline([eventRow()],[])[0]; assert.equal(item.description,'5 mg → 7.5 mg'); assert.equal(item.metadata.newDose,7.5) })
test('overlay consumes structured dose metadata without inventing a delta', () => { const p={id:'p1',name:'Plan',start_date:'2026-01-01',status:'active',compounds:[{id:'c1',name:'Compound',phases:[]}]}; const marker=overlay.overlayMarkers([p],[eventRow()]).find(row=>row.id==='event:e1'); assert.equal(marker.description,'5 mg → 7.5 mg') })
test('repeated delivery of the same source row is suppressed', () => assert.equal(timeline.normalizeTimeline([eventRow(),eventRow()],[]).length,1))
test('mutation functions are owner scoped and security invoker', () => { assert.match(migration,/SECURITY INVOKER/g); assert.match(migration,/auth\.uid\(\)/); assert.match(migration,/user_id=uid/) })
test('quick dose form asks only for the changed value and date', () => { assert.match(doseAction,/New medication dose/); assert.doesNotMatch(doseAction,/Compound name|Frequency mode|Route/) })
test('all supported writes share the reusable mutation module', () => { for (const fn of ['saveProtocolWithEvents','changeProtocolDose','transitionProtocol','continueLatestPhase']) assert.equal(typeof mutations[fn],'function') })
test('quick create automatically uses structured event capture', () => assert.match(quick,/save_protocol_with_events_v1/))
test('migration is additive and does not backfill historical rows', () => { const beforeFunctions=migration.slice(0,migration.indexOf('CREATE OR REPLACE FUNCTION')); assert.doesNotMatch(beforeFunctions,/\bUPDATE\b|\bDELETE\b/); assert.match(beforeFunctions,/ADD COLUMN IF NOT EXISTS metadata/) })
test('completed protocol reactivation remains the explicit legacy behavior', () => { assert.match(manage,/async function reactivateProtocol/); assert.doesNotMatch(migration,/p_action='reactivate'/) })
