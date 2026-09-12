import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
function load(path, overrides = {}) {
  const url = path.startsWith('file:') ? new URL(path) : new URL(path, import.meta.url)
  if (!Object.keys(overrides).length && cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name in overrides) return overrides[name]
    if (name === 'server-only') return {}
    if (!name.startsWith('.')) return require(name)
    for (const suffix of ['', '.ts']) { try { return load(new URL(name + suffix, url).href, overrides) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    throw new Error(`Missing module ${name}`)
  }, out, out.exports)
  if (!Object.keys(overrides).length) cache.set(url.href, out.exports)
  return out.exports
}
const { buildLongitudinal } = load('../lib/health/longitudinal/engine.ts')
const { detectInterventions } = load('../lib/health/longitudinal/interventions.ts')
const { healthStateAtDate, medicationForPhase, compareMedication } = load('../lib/health/longitudinal/history.ts')
const { normalizeMeasurements } = load('../lib/health/longitudinal/measurements.ts')
const { buildAnalystContext } = load('../lib/health/analyst/evidence.ts')
const { analystInput } = load('../lib/health/analyst/prompts.ts')
const phase = (extra = {}) => ({ id: 'phase-a', start_week: 1, end_week: null, dose: 4, dose_unit: 'mg', dose_semantics_version: 1, frequency: '1x/week', route: 'SubQ', ...extra })
const protocol = (extra = {}) => ({ id: 'plan-a', name: 'Fictional plan', start_date: '2026-01-10', status: 'active', completed_date: null,
  compounds: [{ id: 'compound-a', name: 'Fictional compound', phases: [phase()] }], ...extra })
const event = (extra = {}) => ({ id: 'event-a', date: '2026-01-10', event_type: 'started', description: null, protocol_id: 'plan-a', compound_id: null, metadata: { version: 1 }, ...extra })
const journal = (id, date, weight = 160, extra = {}) => ({ id, date, weight, sleep: null, mood: null, energy: null, hunger: null, notes: null, ...extra })
const panel = (id, date, value, unit = 'mg/dL', extra = {}) => ({ id, user_id: 'fictional-owner', test_date: date, source_type: 'manual', panel_name: 'Fictional panel', provider: null, notes: null,
  results: [{ id: `result-${id}`, lab_panel_id: id, user_id: 'fictional-owner', biomarker_name: 'Glucose', canonical_name: null, value, value_text: null, unit,
    reference_low: 4, reference_high: 20, reference_text: null, status: 'normal', status_source: 'reported', category: null, ...extra }] })
const source = (extra = {}) => ({ protocols: [protocol()], protocolEvents: [event()], panels: [], journal: [journal('before', '2026-01-05'), journal('after', '2026-01-31', 156)], ...extra })
const state = (data, date) => healthStateAtDate(data, date)[0]
const run = (data = source(), options) => buildLongitudinal(data, '2026-05-01', options)
const observation = (data = source(), options) => run(data, options).observations.find(item => item.metric.key === 'weight' && item.intervention.kind === 'started')
const snapshot = (extra = {}) => ({ phaseId: 'phase-a', compoundId: 'compound-a', startWeek: 1, endWeek: null, medicationDose: 4, medicationUnit: 'mg', doseConfirmed: true, frequency: '1x/week', route: 'SubQ', dosingEntry: null, ...extra })
const change = (extra = {}) => event({ date: '2026-02-10', event_type: 'dose_change', compound_id: 'compound-a', metadata: { version: 1, phaseId: 'phase-a', previousState: snapshot(), newState: snapshot({ medicationDose: 6 }) }, ...extra })
const entry = (extra = {}) => ({ version: 2, mode: 'syringe', review_status: 'confirmed', dose: '', dose_unit: '', syringe_markings: '24', syringe_scale: '100', injection_volume: '', vial_strength: '20', vial_unit: 'mg', bac_water_ml: '2', concentration_value: '', concentration_unit: '', vial_label: '', ...extra })

test('protocol start has one canonical intervention, not duplicate record/event entries', () => assert.equal(run().interventions.filter(item => item.kind === 'started').length, 1))
test('protocol stop uses its recorded date and ends the next derived period', () => {
  const data = source({ protocols: [protocol({ status: 'completed', completed_date: '2026-02-01' })] })
  assert.ok(run(data).interventions.some(item => item.kind === 'stopped' && item.date === '2026-02-01'))
  assert.equal(healthStateAtDate(data, '2026-02-01').length, 0)
})
test('dose increase comes from confirmed structured states', () => assert.equal(detectInterventions(source({ protocolEvents: [change()] }), '2026-05-01')[0].kind, 'dose_increased'))
test('dose decrease comes from confirmed structured states', () => assert.equal(detectInterventions(source({ protocolEvents: [change({ metadata: { version: 1, phaseId: 'phase-a', previousState: snapshot(), newState: snapshot({ medicationDose: 2 }) } })] }), '2026-05-01')[0].kind, 'dose_decreased'))
test('a saved phase transition is detected with its actual week boundary', () => {
  const data = source({ protocols: [protocol({ compounds: [{ id: 'compound-a', name: 'Fictional', phases: [phase({ end_week: 2 }), phase({ id: 'phase-b', start_week: 3 })] }] })] })
  assert.ok(run(data).interventions.some(item => item.kind === 'phase_started' && item.date === '2026-01-24'))
})
test('historical phase is not replaced by the current later phase', () => {
  const data = source({ protocols: [protocol({ compounds: [{ id: 'compound-a', name: 'Fictional', phases: [phase({ end_week: 2 }), phase({ id: 'phase-b', start_week: 3, dose: 8 })] }] })] })
  assert.equal(state(data, '2026-01-12').medication.value, 4); assert.equal(state(data, '2026-02-01').medication.value, 8)
})
test('true medication IU remains IU', () => assert.deepEqual(medicationForPhase(phase({ dose: 320, dose_unit: 'IU' })), { value: 320, unit: 'IU' }))
test('syringe markings never become medication IU', () => {
  const medication = medicationForPhase(phase({ dose: null, dosing_entry: entry() }))
  assert.equal(medication.unit, 'mg'); assert.ok(Math.abs(medication.value - 2.4) < 1e-10)
})
test('mg medication remains mass medication', () => assert.equal(medicationForPhase(phase()).unit, 'mg'))
test('mcg medication remains mcg', () => assert.equal(medicationForPhase(phase({ dose: 250, dose_unit: 'mcg' })).unit, 'mcg'))
test('reconstituted peptide uses only its own recorded preparation data', () => {
  const dose = medicationForPhase(phase({ dosing_entry: entry({ vial_strength: '8', bac_water_ml: '4', syringe_markings: '25' }) }))
  assert.deepEqual(dose, { value: .5, unit: 'mg' })
})
test('incomplete syringe entries do not borrow current compound concentration', () => {
  const dose = medicationForPhase(phase({ dosing_entry: entry({ vial_strength: '', bac_water_ml: '' }) }))
  assert.equal(dose, null)
})
test('overlap checks the full baseline-to-last-followup interval', () => {
  const data = source({ protocolEvents: [event(), event({ id: 'later', protocol_id: 'plan-b', date: '2026-01-28' })] })
  assert.equal(observation(data).confounders.length, 1)
})
test('a change between baseline and intervention is a confounder too', () => {
  const data = source({ protocolEvents: [event(), event({ id: 'earlier', protocol_id: 'plan-b', date: '2026-01-06' })] })
  assert.equal(observation(data).confounders.length, 1)
})
test('no baseline is insufficient, not a fabricated zero', () => {
  const item = observation(source({ journal: [journal('after', '2026-01-31')] })); assert.equal(item.baseline, null); assert.equal(item.changes.length, 0); assert.equal(item.strength.level, 'insufficient')
})
test('no follow-up does not invent a measurement', () => assert.equal(observation(source({ journal: [journal('before', '2026-01-05')] })).strength.level, 'insufficient'))
test('incompatible lab units cannot be compared', () => {
  const data = source({ journal: [], panels: [panel('pre', '2026-01-05', 10), panel('post', '2026-01-31', 2, 'mmol/L')] })
  assert.ok(run(data).observations.every(item => !item.changes.length)); assert.ok(run(data).observations.every(item => item.limitations.some(reason => /Other units/.test(reason))))
})
test('single follow-up has limited coverage', () => assert.equal(observation().strength.level, 'limited'))
test('consistent repeated follow-ups with a close baseline have explainable repeated coverage', () => {
  const item = observation(source({ journal: [journal('pre', '2026-01-05'), journal('a', '2026-01-15', 159), journal('b', '2026-01-25', 158), journal('c', '2026-02-05', 157)] }))
  assert.equal(item.strength.level, 'repeated'); assert.ok(item.strength.reasons.some(reason => /not assessed/.test(reason)))
})
test('same-day intervention readings are excluded from baseline and follow-up', () => {
  const item = observation(source({ journal: [journal('same', '2026-01-10'), journal('post', '2026-01-15')] }))
  assert.equal(item.baseline, null); assert.ok(item.limitations.some(reason => /within-day order/.test(reason)))
})
test('distinct same-day protocols remain separate even with identical names', () => {
  const data = source({ protocols: [protocol(), protocol({ id: 'plan-b', compounds: [] })], protocolEvents: [event(), event({ id: 'event-b', protocol_id: 'plan-b' })] })
  assert.equal(run(data).interventions.filter(item => item.kind === 'started').length, 2); assert.equal(observation(data).confounders.length, 1)
})
test('absolute, percentage and elapsed-time math is deterministic', () => {
  const item = observation(); assert.equal(item.changes[0].delta, -4); assert.equal(item.changes[0].percent, -2.5); assert.equal(item.changes[0].daysAfter, 21); assert.equal(item.changes[0].daysBetween, 26)
})
test('derived Health Versions are nonoverlapping half-open periods', () => {
  const data = source({ protocolEvents: [event(), change()] })
  const versions = run(data).versions; assert.equal(versions[0].endExclusive, versions[1].start)
  const ids = versions.flatMap(item => item.measurementIds); assert.equal(ids.length, new Set(ids).size)
})
test('future protocols, events and measurements are not shown', () => {
  const data = source({ protocols: [protocol({ start_date: '2027-01-01' })], protocolEvents: [event({ date: '2027-01-01' })], journal: [journal('future', '2027-01-02')] })
  assert.equal(run(data).interventions.length, 0); assert.equal(normalizeMeasurements(data, '2026-05-01').length, 0)
})
test('deleted protocol retained events do not fabricate an active regimen', () => {
  const data = source({ protocols: [], protocolEvents: [event({ event_type: 'stopped' })] })
  assert.equal(healthStateAtDate(data, '2026-02-01').length, 0); assert.equal(run(data).interventions.length, 1); assert.ok(run(data).interventions[0].limitations.some(reason => /absent/.test(reason)))
})
test('legacy ambiguous IU remains unverified without mutating the source', () => {
  const data = source({ protocols: [protocol({ compounds: [{ id: 'compound-a', name: 'Anything', phases: [phase({ dose: 50, dose_unit: 'IU', dose_semantics_version: null })] }] })] })
  const original = JSON.stringify(data); assert.equal(state(data, '2026-02-01').medication, null); run(data); assert.equal(JSON.stringify(data), original)
})
test('Analyst receives deterministic structured deltas for protocol-related questions', () => {
  const context = buildAnalystContext(source(), 'How did weight change around my protocol changes?', '2026-05-01')
  const item = context.evidence.find(item => item.type === 'longitudinal_observation'); assert.ok(item); assert.equal(item.longitudinal.followups[0].delta, -4); assert.match(item.id, /^E\d+$/)
})
test('ordinary current snapshot does not send the new longitudinal projection', () => assert.equal(buildAnalystContext(source(), 'current health snapshot', '2026-05-01').evidence.some(item => item.longitudinal), false))
test('Analyst projection contains no raw entry, journal notes or source IDs', () => {
  const data = source(); data.journal[0].notes = 'PRIVATE NOTE CANARY'; data.protocols[0].compounds[0].phases[0].dosing_entry = entry({ vial_label: 'PRIVATE VIAL CANARY' })
  const context = buildAnalystContext(data, 'How did my protocol change my measurements?', '2026-05-01')
  const projection = JSON.stringify(context.evidence.filter(item => item.longitudinal))
  for (const canary of ['PRIVATE NOTE CANARY', 'PRIVATE VIAL CANARY', 'plan-a', 'compound-a', 'phase-a', 'journal:before']) assert.ok(!projection.includes(canary))
  assert.ok(analystInput(context).includes('longitudinal_observation'))
})
test('same-unit reference ranges and original lab source are retained', () => {
  const data = source({ journal: [], panels: [panel('pre', '2026-01-05', 10), panel('post', '2026-01-31', 12)] })
  const row = run(data).observations[0].baseline; assert.equal(row.reference.low, 4); assert.equal(row.original.sourceType, 'manual'); assert.equal(row.source.id, 'result-pre')
})
test('ordinal journal scores are point differences, not percentage improvement', () => {
  const data = source({ journal: [journal('pre', '2026-01-05', null, { mood: 2 }), journal('post', '2026-01-31', null, { mood: 4 })] })
  assert.equal(run(data).observations[0].changes[0].delta, 2); assert.equal(run(data).observations[0].changes[0].percent, null)
})
test('missing measurement units do not produce numerical changes', () => assert.equal(run(source({ journal: [], panels: [panel('pre', '2026-01-05', 2, ''), panel('post', '2026-01-31', 4, '')] })).observations[0].changes.length, 0))
test('zero baseline has no fabricated percent change', () => assert.equal(run(source({ journal: [], panels: [panel('pre', '2026-01-05', 0), panel('post', '2026-01-31', 4)] })).observations[0].changes[0].percent, null))
test('qualitative results are not silently parsed into numbers', () => assert.equal(normalizeMeasurements(source({ journal: [], panels: [panel('pre', '2026-01-05', null, 'mg/dL', { value_text: '<5' })] }), '2026-05-01').length, 0))
test('malformed dates and nonfinite values are excluded', () => {
  const data = source({ journal: [journal('invalid', '2026-02-30'), journal('infinite', '2026-02-01', Infinity)] })
  assert.equal(normalizeMeasurements(data, '2026-05-01').length, 0); assert.throws(() => buildLongitudinal(data, '2026-02-30'))
})
test('observation windows are configurable and validated', () => {
  assert.equal(observation(source(), { baselineDays: 2 }).baseline, null)
  assert.equal(observation(source(), { followupStartDays: 22 }).followups.length, 0)
  assert.throws(() => run(source(), { followupStartDays: 40, followupEndDays: 20 }))
})
test('conflicting same-day baselines are not arbitrarily selected', () => {
  assert.equal(observation(source({ journal: [journal('one', '2026-01-05'), journal('two', '2026-01-05', 170), journal('post', '2026-01-31')] })).baseline, null)
})
test('conflicting same-day follow-ups are not averaged', () => {
  assert.equal(observation(source({ journal: [journal('pre', '2026-01-05'), journal('one', '2026-01-31'), journal('two', '2026-01-31', 170)] })).followups.length, 0)
})
test('same-day duplicates do not inflate repeated measurement evidence', () => {
  assert.equal(observation(source({ journal: [journal('pre', '2026-01-05'), ...['a', 'b', 'c'].map(id => journal(id, '2026-01-31', 158))] })).strength.level, 'limited')
})
test('mass units can be compared centrally, without IU-to-mass conversion', () => {
  assert.equal(compareMedication({ value: 1, unit: 'mg' }, { value: 1000, unit: 'mcg' }), 0)
  assert.equal(compareMedication({ value: 10, unit: 'IU' }, { value: 10, unit: 'mg' }), null)
})
test('snapshot rewind restores old dose, route and explicit null frequency', () => {
  const data = source({ protocolEvents: [change({ metadata: { version: 1, phaseId: 'phase-a', previousState: snapshot({ frequency: null, route: null }), newState: snapshot({ medicationDose: 6, route: 'IM' }) } })] })
  assert.equal(state(data, '2026-01-20').medication.value, 4); assert.equal(state(data, '2026-01-20').route, null); assert.equal(state(data, '2026-01-20').frequency, null)
  assert.equal(state(data, '2026-02-11').medication.value, 6)
})
test('conflicting same-day snapshots yield unknown semantics, not UUID-order inference', () => {
  const data = source({ protocolEvents: [change(), change({ id: 'another', metadata: { version: 1, phaseId: 'phase-a', newState: snapshot({ medicationDose: 9 }) } })] })
  assert.equal(state(data, '2026-02-11').medication, null)
})
test('midweek quick change does not backdate new dose to the week boundary', () => {
  const data = source({ protocols: [protocol({ compounds: [{ id: 'compound-a', name: 'Example', phases: [phase({ end_week: 2 }), phase({ id: 'phase-b', start_week: 3, dose: 8 })] }] })],
    protocolEvents: [change({ date: '2026-01-27', metadata: { version: 1, source: 'quick_dose_change', phaseId: 'phase-b', previousPhaseId: 'phase-a', previousState: snapshot(), newState: snapshot({ phaseId: 'phase-b', startWeek: 3, medicationDose: 8 }) } })] })
  assert.equal(state(data, '2026-01-25').medication.value, 4); assert.equal(state(data, '2026-01-27').medication.value, 8)
  assert.equal(run(data).interventions.some(item => item.date === '2026-01-24'), false)
})
test('a future continuation does not fill an expired historical gap', () => {
  const data = source({ protocolEvents: [event(), change({ date: '2026-02-10', event_type: 'phase_continued', metadata: { version: 1, phaseId: 'phase-a', previousEndWeek: 2, newState: snapshot() } })] })
  assert.equal(state(data, '2026-02-01').medication, null); assert.equal(state(data, '2026-02-11').medication.value, 4)
  assert.ok(run(data).interventions.some(item => item.kind === 'phase_ended' && item.date === '2026-01-24'))
})
test('a newly added compound cannot appear before its addition date', () => {
  const data = source({ protocolEvents: [event(), event({ id: 'add', date: '2026-02-01', event_type: 'compound_added', compound_id: 'compound-a' })] })
  assert.equal(healthStateAtDate(data, '2026-01-20').length, 0); assert.equal(healthStateAtDate(data, '2026-02-02').length, 1)
})
test('removed compound stops appearing, without erasing its prior event', () => {
  const data = source({ protocolEvents: [event(), event({ id: 'remove', date: '2026-02-01', event_type: 'compound_removed', compound_id: 'compound-a' })] })
  assert.equal(healthStateAtDate(data, '2026-02-02').length, 0); assert.ok(run(data).interventions.some(item => item.kind === 'compound_removed'))
})
test('an expired phase stays expired', () => {
  const data = source({ protocols: [protocol({ compounds: [{ id: 'compound-a', phases: [phase({ end_week: 2 })] }] })] })
  assert.equal(state(data, '2026-02-01').medication, null)
})
test('undated completed legacy protocol does not establish historical activity', () => assert.equal(healthStateAtDate(source({ protocols: [protocol({ status: 'completed' })], protocolEvents: [] }), '2026-02-01').length, 0))
test('frequency and route changes are retained as independent overlapping changes', () => {
  const data = source({ protocolEvents: [event(), change({ id: 'frequency', event_type: 'frequency_change' }), change({ id: 'route', event_type: 'route_change' })] })
  assert.ok(run(data).interventions.some(item => item.kind === 'frequency_changed')); assert.ok(run(data).interventions.some(item => item.kind === 'route_changed'))
})
test('HTTP route authenticates before loading data and returns no-store', async () => {
  let loaded = false
  const route = load('../app/api/health-longitudinal/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ body, ...init }) } },
    '../../../lib/serverSupabase': { createAuthenticatedServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }) },
    '../../../lib/health/longitudinal/load': { loadLongitudinal: async () => { loaded = true } },
  })
  const response = await route.GET(); assert.equal(response.status, 401); assert.equal(loaded, false); assert.match(response.headers['Cache-Control'], /no-store/)
})
test('HTTP route uses authenticated owner and hides operational errors', async () => {
  const route = load('../app/api/health-longitudinal/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ body, ...init }) } },
    '../../../lib/serverSupabase': { createAuthenticatedServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } }, error: null }) } }) },
    '../../../lib/health/longitudinal/load': { loadLongitudinal: async (_client, id) => { assert.equal(id, 'owner'); throw new Error('PRIVATE DATABASE RECORD') } },
  })
  const response = await route.GET(); assert.equal(response.status, 503); assert.ok(!JSON.stringify(response).includes('PRIVATE'))
})
test('UI does not introduce entry forms, HTML injection or provider calls', () => {
  const ui = readFileSync(new URL('../components/health/LongitudinalChanges.tsx', import.meta.url), 'utf8')
  assert.ok(!/dangerouslySetInnerHTML|<input|<textarea|openai|localStorage/.test(ui)); assert.match(ui, /AbortController/); assert.match(ui, /no-store/)
})
test('consent and rate limiting remain before Analyst health loading', () => {
  const route = readFileSync(new URL('../app/api/health-analyst/route.ts', import.meta.url), 'utf8')
  const body = route.slice(route.indexOf('export async function'))
  assert.ok(body.indexOf('hasCurrentAiConsent') < body.indexOf('loadHealthAnalystContext'))
  assert.ok(body.indexOf('checkDurableRateLimit') < body.indexOf('loadHealthAnalystContext'))
})
test('an edit to an expired or future phase is not an intervention on the edit date', () => {
  for (const extra of [{ endWeek: 2 }, { startWeek: 20 }]) {
    const data = source({ protocolEvents: [change({ metadata: { version: 1, phaseId: 'phase-a', previousState: snapshot(extra), newState: snapshot({ ...extra, medicationDose: 8 }) } })] })
    assert.equal(run(data).interventions.some(item => item.kind === 'dose_increased'), false)
  }
})
test('a dose-changing phase transition is not its own duplicate confounder', () => {
  const data = source({ protocols: [protocol({ compounds: [{ id: 'compound-a', name: 'Example', phases: [phase({ end_week: 2 }), phase({ id: 'phase-b', start_week: 3, dose: 8 })] }] })] })
  const changes = run(data).interventions.filter(item => item.date === '2026-01-24')
  assert.equal(changes.length, 1); assert.equal(changes[0].kind, 'dose_increased')
})
test('navigating from changes to Analyst does not depend on a skipped lab request', () => {
  const ui = readFileSync(new URL('../components/health/HealthDashboard.tsx', import.meta.url), 'utf8')
  assert.ok(ui.includes("(analyst || status === 'ready')")); assert.ok(ui.includes('if (analyst || longitudinal) return'))
})
test('successful deterministic endpoint returns only the requested owner result', async () => {
  const route = load('../app/api/health-longitudinal/route.ts', {
    'next/server': { NextResponse: { json: (body, init) => ({ body, ...init }) } },
    '../../../lib/serverSupabase': { createAuthenticatedServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner-only' } }, error: null }) } }) },
    '../../../lib/health/longitudinal/load': { loadLongitudinal: async (_client, id) => { assert.equal(id, 'owner-only'); return run() } },
  })
  const response = await route.GET(); assert.equal(response.body.observations[0].changes[0].delta, -4); assert.match(response.headers['Cache-Control'], /private, no-store/)
})
test('new read-only loader makes no per-intervention reads or mutations', async () => {
  let calls = 0
  const { loadLongitudinal } = load('../lib/health/longitudinal/load.ts', { '../analyst/context': { loadHealthSourceData: async (_client, id) => { calls++; assert.equal(id, 'owner'); return source() } } })
  await loadLongitudinal({}, 'owner', '2026-05-01'); assert.equal(calls, 1)
  await assert.rejects(() => loadLongitudinal({}, '', '2026-05-01')); assert.equal(calls, 1)
})
test('protocol-context Analyst uses the new conservative snapshot resolver', () => {
  const data = source({ protocolEvents: [change(), change({ id: 'conflict', metadata: { version: 1, phaseId: 'phase-a', newState: snapshot({ medicationDose: 9 }) } })] })
  const context = buildAnalystContext(data, 'Review my protocol history', '2026-05-01')
  assert.ok(context.evidence.some(item => item.type === 'protocol_state' && item.detail.startsWith('Medication dose not confirmed')))
})
test('overflow during mass normalization cannot invent a dose decrease', () => {
  assert.equal(compareMedication({ value: Number.MAX_VALUE, unit: 'mg' }, { value: Number.MAX_VALUE, unit: 'mg' }), null)
})
test('recorded changes are stable when source order changes', () => {
  const data = source({ protocolEvents: [event(), change()] })
  const shuffled = { ...data, journal: [...data.journal].reverse(), protocolEvents: [...data.protocolEvents].reverse() }
  assert.deepEqual(run(data), run(shuffled))
})
