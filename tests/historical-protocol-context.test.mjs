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
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name.endsWith('/supabase') || name === '../supabase') return { createClient() { throw new Error('client must be injected') } }
    if (!name.startsWith('.')) return require(name)
    for (const suffix of ['', '.ts']) { try { return load(new URL(name + suffix, url).href) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    throw new Error(`Missing ${name}`)
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}

const history = load('../lib/health/longitudinal/history.ts')
const overlay = load('../lib/health/protocolOverlay.ts')
const interventions = load('../lib/health/longitudinal/interventions.ts')
const mutations = load('../lib/health/protocolMutations.ts')
const timeline = load('../lib/health/timeline.ts')
const migration = readFileSync(new URL('../supabase/migrations/202609160001_historical_protocol_context_v1.sql', import.meta.url), 'utf8')
const overlaySource = readFileSync(new URL('../lib/health/protocolOverlay.ts', import.meta.url), 'utf8')
const manageSource = readFileSync(new URL('../app/protocol/manage/page.tsx', import.meta.url), 'utf8')
const overlayLoaderSource = readFileSync(new URL('../lib/health/loadProtocolOverlay.ts', import.meta.url), 'utf8')

const phase = (extra = {}) => ({ id: 'ph1', start_week: 1, end_week: null, dose: 5, dose_unit: 'mg', dose_semantics_version: 1,
  dosing_entry: null, frequency: '1x/week', route: 'SubQ', days_of_week: [], ...extra })
const compound = (extra = {}) => ({ id: 'c1', name: 'Fictional compound', phases: [phase()], ...extra })
const protocol = (extra = {}) => ({ id: 'p1', name: 'Fictional protocol', start_date: '2026-01-01', status: 'active', completed_date: null,
  continued_from_protocol_id: null, compounds: [compound()], ...extra })
const event = (extra = {}) => ({ id: 'e1', date: '2026-01-01', event_type: 'started', description: null, protocol_id: 'p1', compound_id: null,
  metadata: { version: 1 }, ...extra })
const snapshot = (extra = {}) => ({ phaseId: 'ph1', compoundId: 'c1', startWeek: 1, endWeek: null, medicationDose: 5, medicationUnit: 'mg',
  doseConfirmed: true, frequency: '1x/week', route: 'SubQ', dosingEntry: null, ...extra })
const syringeEntry = (extra = {}) => ({ version: 2, mode: 'syringe', review_status: 'confirmed', dose: '', dose_unit: '', syringe_markings: '20', syringe_scale: '100',
  injection_volume: '', vial_strength: '10', vial_unit: 'mg', bac_water_ml: '2', concentration_value: '', concentration_unit: '', vial_label: '', ...extra })
const source = (protocols = [protocol()], protocolEvents = [event()]) => ({ protocols, protocolEvents })
const rpcClient = () => ({ calls: [], rpc(name, payload) { this.calls.push([name, payload]); return Promise.resolve({ data: null, error: null }) } })

test('canonical activity uses an exclusive completion boundary', () => {
  const p = protocol({ status: 'completed', completed_date: '2026-03-10' })
  assert.equal(history.protocolActivityAtDate(p, '2026-03-09', []), 'active')
  assert.equal(history.protocolActivityAtDate(p, '2026-03-10', []), 'inactive')
})

test('overlay lifecycle compatibility delegates to canonical completion semantics', () => {
  const p = protocol({ status: 'completed', completed_date: '2026-03-10' })
  assert.equal(overlay.protocolActiveOnDate(p, '2026-03-09'), true)
  assert.equal(overlay.protocolActiveOnDate(p, '2026-03-10'), false)
})

test('same-day conflicting lifecycle events remain ambiguous regardless of IDs', () => {
  const rows = [event({ id: 'z', date: '2026-02-01', event_type: 'paused' }), event({ id: 'a', date: '2026-02-01', event_type: 'resumed' })]
  assert.equal(history.protocolActivityAtDate(protocol(), '2026-02-01', rows), 'ambiguous')
  assert.equal(history.protocolActivityAtDate(protocol(), '2026-02-01', [...rows].reverse()), 'ambiguous')
  assert.equal(overlay.protocolActiveOnDate(protocol(), '2026-02-01', rows), false)
})

test('pause and resume establish separate active intervals', () => {
  const rows = [event(), event({ id: 'pause', date: '2026-02-01', event_type: 'paused' }), event({ id: 'resume', date: '2026-02-10', event_type: 'resumed' })]
  assert.equal(history.protocolActivityAtDate(protocol(), '2026-02-05', rows), 'inactive')
  assert.equal(history.protocolActivityAtDate(protocol(), '2026-02-10', rows), 'active')
})

test('reactivation preserves the prior completed interval boundary', () => {
  const p = protocol({ status: 'active', completed_date: null })
  const rows = [event(), event({ id: 'done', date: '2026-03-01', event_type: 'completed' }), event({ id: 'again', date: '2026-04-01', event_type: 'reactivated' })]
  assert.equal(history.protocolActivityAtDate(p, '2026-02-28', rows), 'active')
  assert.equal(history.protocolActivityAtDate(p, '2026-03-01', rows), 'inactive')
  assert.equal(history.protocolActivityAtDate(p, '2026-03-20', rows), 'inactive')
  assert.equal(history.protocolActivityAtDate(p, '2026-04-01', rows), 'active')
})

test('reactivation without a known prior completion date does not manufacture earlier activity', () => {
  const p = protocol({ status: 'active', completed_date: null })
  const rows = [event(), event({ id: 'again', date: '2026-04-01', event_type: 'reactivated' })]
  assert.equal(history.protocolActivityAtDate(p, '2026-03-20', rows), 'ambiguous')
})

test('reactivation metadata preserves a legacy completion boundary after completed_date is cleared', () => {
  const p = protocol({ status: 'active', completed_date: null })
  const rows = [event(), event({ id: 'again', date: '2026-04-01', event_type: 'reactivated',
    metadata: { version: 1, previousCompletedDate: '2026-03-01T00:00:00+00:00' } })]
  assert.equal(history.protocolActivityAtDate(p, '2026-02-28', rows), 'active')
  assert.equal(history.protocolActivityAtDate(p, '2026-03-01', rows), 'inactive')
  assert.equal(history.protocolActivityAtDate(p, '2026-03-20', rows), 'inactive')
  assert.equal(history.protocolActivityAtDate(p, '2026-04-01', rows), 'active')
})

test('same-name protocols remain distinct by protocol ID', () => {
  const a = protocol({ id: 'p-a', name: 'Same name', compounds: [{ ...compound(), id: 'c-a' }] })
  const b = protocol({ id: 'p-b', name: 'Same name', compounds: [{ ...compound(), id: 'c-b' }] })
  const states = history.healthStateAtDate(source([a, b], []), '2026-02-01')
  assert.deepEqual(states.map(item => item.protocolId), ['p-a', 'p-b'])
})

test('same-name compounds remain distinct by compound ID', () => {
  const p = protocol({ compounds: [compound({ id: 'c-a', name: 'Same' }), compound({ id: 'c-b', name: 'Same', phases: [phase({ id: 'ph-b' })] })] })
  const states = history.healthStateAtDate(source([p], []), '2026-02-01')
  assert.deepEqual(states.map(item => item.compoundId), ['c-a', 'c-b'])
})

test('continued-from identity is not inferred from matching names', () => {
  const a = protocol({ id: 'p-a', name: 'Same', continued_from_protocol_id: null })
  const b = protocol({ id: 'p-b', name: 'Same', continued_from_protocol_id: 'p-a', compounds: [{ ...compound(), id: 'c-b' }] })
  assert.equal(a.continued_from_protocol_id, null); assert.equal(b.continued_from_protocol_id, 'p-a')
  assert.equal(history.healthStateAtDate(source([a, b], []), '2026-02-01').length, 2)
})

test('quick dose change uses the exact effective date, not rounded week start', () => {
  const p = protocol({ compounds: [compound({ phases: [phase({ end_week: 5 }), phase({ id: 'ph2', start_week: 6, dose: 8 })] })] })
  const rows = [event(), event({ id: 'dose', date: '2026-02-10', event_type: 'dose_change', compound_id: 'c1', metadata: { version: 1, source: 'quick_dose_change', phaseId: 'ph2', previousState: snapshot({ endWeek: null }), newState: snapshot({ phaseId: 'ph2', startWeek: 6, medicationDose: 8 }) } })]
  assert.equal(history.healthStateAtDate(source([p], rows), '2026-02-09')[0].medication.value, 5)
  assert.equal(history.healthStateAtDate(source([p], rows), '2026-02-10')[0].medication.value, 8)
})

test('structured snapshots restore frequency and route historically', () => {
  const rows = [event(), event({ id: 'edit', date: '2026-03-01', event_type: 'route_change', compound_id: 'c1', metadata: { version: 1, phaseId: 'ph1', previousState: snapshot({ frequency: '2x/week', route: 'IM' }), newState: snapshot({ frequency: '1x/week', route: 'SubQ' }) } })]
  const state = history.healthStateAtDate(source([protocol()], rows), '2026-02-01')[0]
  assert.equal(state.frequency, '2x/week'); assert.equal(state.route, 'IM')
})

test('canonical replay never falls back to compounds.route', () => {
  const p = protocol({ compounds: [compound({ route: 'IM', phases: [phase({ route: null })] })] })
  assert.equal(history.healthStateAtDate(source([p], []), '2026-02-01')[0].route, null)
})

test('true medication IU stays distinct from mass medication', () => {
  assert.deepEqual(history.medicationForPhase(phase({ dose: 250, dose_unit: 'IU' })), { value: 250, unit: 'IU' })
  assert.deepEqual(history.medicationForPhase(phase({ dose: 5, dose_unit: 'mg' })), { value: 5, unit: 'mg' })
})

test('syringe markings are calculated from preparation and never relabeled as medication IU', () => {
  const value = history.medicationForPhase(phase({ dose: null, dose_unit: null, dose_semantics_version: null, dosing_entry: syringeEntry() }))
  assert.deepEqual(value, { value: 1, unit: 'mg' })
})

test('volume without medication interpretation is not medication mass', () => {
  const entry = { ...syringeEntry(), mode: 'volume', syringe_markings: '', injection_volume: '0.2', vial_strength: '', bac_water_ml: '' }
  assert.equal(history.medicationForPhase(phase({ dose: null, dose_unit: null, dose_semantics_version: null, dosing_entry: entry })), null)
})

test('conflicting same-day phase snapshots remain unresolved', () => {
  const rows = [event(), event({ id: 'a', date: '2026-02-01', event_type: 'dose_change', compound_id: 'c1', metadata: { version: 1, phaseId: 'ph1', newState: snapshot({ medicationDose: 6 }) } }),
    event({ id: 'b', date: '2026-02-01', event_type: 'dose_change', compound_id: 'c1', metadata: { version: 1, phaseId: 'ph1', newState: snapshot({ medicationDose: 7 }) } })]
  const state = history.healthStateAtDate(source([protocol()], rows), '2026-02-01')[0]
  assert.equal(state.medication, null); assert.equal(state.route, null); assert.ok(state.limitations.some(item => /unambiguous/.test(item)))
})

test('phase continuation does not fill the earlier expired gap', () => {
  const p = protocol({ compounds: [compound({ phases: [phase({ end_week: 2 })] })] })
  const rows = [event(), event({ id: 'cont', date: '2026-02-01', event_type: 'phase_continued', compound_id: 'c1', metadata: { version: 1, phaseId: 'ph1', previousEndWeek: 2, newEndWeek: null, newState: snapshot() } })]
  assert.equal(history.healthStateAtDate(source([p], rows), '2026-01-25')[0].phaseId, null)
  assert.equal(history.healthStateAtDate(source([p], rows), '2026-02-01')[0].phaseId, 'ph1')
})

test('saved-plan fallback remains explicitly limited', () => {
  const state = history.healthStateAtDate(source([protocol()], []), '2026-02-01')[0]
  assert.equal(state.provenance, 'saved_plan'); assert.ok(state.limitations.some(item => /current saved plan/.test(item)))
})

test('compound addition has an explicit prospective boundary and is not projected backward', () => {
  const p = protocol({ compounds: [compound()] })
  const added = event({ id: 'add', date: '2026-03-01', event_type: 'compound_added', compound_id: 'c1',
    metadata: { version: 1, compoundId: 'c1', compoundName: 'Fictional compound', newStates: [snapshot()] } })
  assert.equal(history.healthStateAtDate(source([p], [event(), added]), '2026-02-15').length, 0)
  assert.equal(history.healthStateAtDate(source([p], [event(), added]), '2026-03-01')[0].compoundId, 'c1')
})

test('conflicting same-day compound add/remove events do not use row order', () => {
  const p = protocol({ compounds: [compound()] })
  const added = event({ id: 'z-add', date: '2026-03-01', event_type: 'compound_added', compound_id: 'c1', metadata: { version: 1, compoundId: 'c1' } })
  const removed = event({ id: 'a-remove', date: '2026-03-01', event_type: 'compound_removed', compound_id: 'c1', metadata: { version: 1, compoundId: 'c1' } })
  assert.equal(history.healthStateAtDate(source([p], [event(), added, removed]), '2026-03-01').length, 0)
  assert.equal(history.healthStateAtDate(source([p], [event(), removed, added]), '2026-03-01').length, 0)
})

test('removed compound snapshots preserve earlier state without name matching', () => {
  const p = protocol({ compounds: [] })
  const removed = event({ id: 'remove', date: '2026-03-01', event_type: 'compound_removed', compound_id: null,
    metadata: { version: 1, compoundId: 'gone-id', compoundName: 'Removed compound', previousStates: [snapshot({ compoundId: 'gone-id' })] } })
  const before = history.healthStateAtDate(source([p], [event(), removed]), '2026-02-15')
  assert.equal(before.length, 1); assert.equal(before[0].compoundId, 'gone-id'); assert.equal(before[0].name, 'Removed compound')
  assert.ok(before[0].limitations.some(item => /Compound record is absent/.test(item)))
  assert.equal(history.healthStateAtDate(source([p], [event(), removed]), '2026-03-01').length, 0)
})

test('boundary-only snapshots prevent a later saved boundary from rewriting earlier history', () => {
  const p = protocol({ compounds: [compound({ phases: [phase({ end_week: 8 })] })] })
  const boundary = event({ id: 'boundary', date: '2026-02-10', event_type: 'phase_boundary_change', compound_id: 'c1', metadata: { version: 1, phaseId: 'ph1', previousState: snapshot({ endWeek: 4 }), newState: snapshot({ endWeek: 8 }) } })
  assert.equal(history.healthStateAtDate(source([p], [event(), boundary]), '2026-02-05')[0].phaseId, null)
  assert.equal(history.healthStateAtDate(source([p], [event(), boundary]), '2026-02-10')[0].phaseId, 'ph1')
})

test('preparation-only snapshots preserve the preparation used for historical dose interpretation', () => {
  const p = protocol({ compounds: [compound({ phases: [phase({ dose: null, dose_unit: null, dose_semantics_version: null, dosing_entry: syringeEntry({ vial_strength: '20' }) })] })] })
  const prep = event({ id: 'prep', date: '2026-03-01', event_type: 'preparation_change', compound_id: 'c1', metadata: { version: 1, phaseId: 'ph1',
    previousState: snapshot({ doseConfirmed: false, medicationDose: null, medicationUnit: null, dosingEntry: syringeEntry({ vial_strength: '10' }) }),
    newState: snapshot({ doseConfirmed: false, medicationDose: null, medicationUnit: null, dosingEntry: syringeEntry({ vial_strength: '20' }) }) } })
  assert.equal(history.healthStateAtDate(source([p], [event(), prep]), '2026-02-15')[0].medication.value, 1)
  assert.equal(history.healthStateAtDate(source([p], [event(), prep]), '2026-03-01')[0].medication.value, 2)
})

test('protocol overlay context is a presentation adapter over canonical state', () => {
  assert.match(overlaySource, /healthStateAtDate\(/)
  assert.doesNotMatch(overlaySource, /function priorStructuredState/)
  assert.doesNotMatch(overlaySource, /currentPhase\(/)
  const context = overlay.contextAtDate(protocol(), '2026-02-01', [event()])[0]
  assert.equal(context.protocolId, 'p1'); assert.equal(context.compoundId, 'c1'); assert.equal(context.dose, '5 mg')
})

test('removed-compound overlay marker uses preserved metadata identity', () => {
  const p = protocol({ compounds: [] })
  const marker = overlay.overlayMarkers([p], [event({ id: 'remove', date: '2026-03-01', event_type: 'compound_removed', compound_id: null,
    metadata: { version: 1, compoundId: 'gone-id', compoundName: 'Removed compound' } })]).find(item => item.id === 'event:remove')
  assert.equal(marker.compoundId, 'gone-id'); assert.match(marker.title, /Removed compound/)
})

test('reactivation is an explicit longitudinal intervention', () => {
  const p = protocol({ status: 'active' })
  const rows = [event(), event({ id: 'done', date: '2026-03-01', event_type: 'completed' }), event({ id: 'again', date: '2026-04-01', event_type: 'reactivated' })]
  assert.ok(interventions.detectInterventions({ protocols: [p], protocolEvents: rows, panels: [], journal: [] }, '2026-05-01').some(item => item.kind === 'reactivated'))
})

test('timeline recognizes reactivation and history-only edit event names', () => {
  const sourceText = readFileSync(new URL('../lib/health/timeline.ts', import.meta.url), 'utf8')
  for (const token of ['reactivated', 'phase_boundary_change', 'preparation_change']) assert.ok(sourceText.includes(token))
})

test('reactivation mutation uses the existing transition RPC', async () => {
  const client = rpcClient(); await mutations.transitionProtocol({ protocolId: 'p1', action: 'reactivate', effectiveDate: '2026-04-01' }, client)
  assert.equal(client.calls[0][0], 'transition_protocol_v1'); assert.equal(client.calls[0][1].p_action, 'reactivate')
})

test('manage page no longer reactivates by direct table update', () => {
  assert.match(manageSource, /transitionProtocol\(\{ protocolId: confirmReactivate\.id, action: 'reactivate'/)
  assert.doesNotMatch(manageSource, /status:\s*'active'[\s\S]{0,120}completed_date:\s*null/)
})

test('new migration records reactivation and retains the prior completion date in event metadata', () => {
  assert.match(migration, /p_action='reactivate'/); assert.match(migration, /event_name:='reactivated'/); assert.match(migration, /'previousCompletedDate',previous_completed/)
})

test('new migration captures removed compound identity and prior phase snapshots prospectively', () => {
  assert.match(migration, /'compound_removed'/); assert.match(migration, /'compoundId',removed_id/); assert.match(migration, /'previousStates',previous_compound->'phaseStates'/)
})

test('new migration captures compound additions prospectively with identity and phase snapshots', () => {
  assert.match(migration, /'compound_added'/); assert.match(migration, /'compoundId',item\.compound_id/); assert.match(migration, /'newStates',item\.phase_states/)
})

test('new migration captures boundary-only edits with previous and new state', () => {
  assert.match(migration, /'phase_boundary_change'/); assert.match(migration, /previous->'startWeek' IS DISTINCT FROM current_state->'startWeek'/)
  assert.match(migration, /jsonb_build_object\('previousState',previous,'newState',current_state\)/)
})

test('new migration captures preparation-only edits without calling them medication-dose changes', () => {
  assert.match(migration, /'preparationFingerprint'/); assert.match(migration, /'preparation_change'/)
  assert.match(migration, /previous->'doseFingerprint' IS NOT DISTINCT FROM current_state->'doseFingerprint'/)
})

test('new migration is function-only and performs no historical backfill', () => {
  const beforeFunctions = migration.slice(0, migration.indexOf('CREATE OR REPLACE FUNCTION'))
  assert.doesNotMatch(beforeFunctions, /\bUPDATE\b|\bDELETE\b|\bINSERT\b/i)
  assert.doesNotMatch(migration, /CREATE TABLE|ALTER TABLE|INSERT INTO protocol_events\s*SELECT/i)
})

test('new migration retains security-invoker and owner-scoped mutation checks', () => {
  assert.match(migration, /SECURITY INVOKER/g); assert.match(migration, /auth\.uid\(\)/); assert.match(migration, /user_id=uid/)
})

test('history consolidation adds no AI or provider dependency', () => {
  const combined = [overlaySource, readFileSync(new URL('../lib/health/longitudinal/history.ts', import.meta.url), 'utf8'), migration].join('\n')
  assert.doesNotMatch(combined, /openai|provider call|chat\.completions|responses\.create/i)
})

test('protocol overlay loader does not query a non-canonical compounds.route field', () => {
  assert.doesNotMatch(overlayLoaderSource, /compounds\(id,name,route,/)
  assert.match(overlayLoaderSource, /phases\([^)]*route/)
})

test('history consolidation adds no parallel persisted state model', () => {
  assert.doesNotMatch(migration, /HistoricalProtocolState|CREATE TABLE|HealthState|HealthVersion/i)
})


test('reactivation dialog surfaces mutation errors instead of failing silently', () => {
  assert.match(manageSource, /const \[reactivating, setReactivating\] = useState\(false\)/)
  assert.match(manageSource, /setReactivating\(true\)[\s\S]{0,900}finally\s*\{\s*setReactivating\(false\)/)
  assert.match(manageSource, /confirmReactivate[\s\S]{0,1400}role="alert"[\s\S]{0,1600}Reactivating…/)
  assert.match(manageSource, /disabled=\{reactivating\}/)
})

test('confirmation dialog cannot overflow horizontally from padded full-width content', () => {
  const css = readFileSync(new URL('../app/protocol/manage/protocols.css', import.meta.url), 'utf8')
  assert.match(css, /\.protocol-confirm-dialog \{[^}]*box-sizing:\s*border-box[^}]*overflow-x:\s*hidden/s)
  assert.match(css, /\.protocol-confirm-dialog > div \{[^}]*box-sizing:\s*border-box[^}]*width:\s*100% !important[^}]*min-width:\s*0/s)
})
