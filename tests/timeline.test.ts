import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

// Compile the pure module in memory so these tests need no extra runner dependency.
const dosingSource = readFileSync(new URL('../lib/health/dosing.ts', import.meta.url),'utf8')
const dosingCode = ts.transpileModule(dosingSource, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2021}}).outputText
const dosingUrl = `data:text/javascript;base64,${Buffer.from(dosingCode).toString('base64')}`
const entryCode=ts.transpileModule(readFileSync(new URL('../lib/health/dosingEntry.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
const entryUrl=`data:text/javascript;base64,${Buffer.from(entryCode).toString('base64')}`
const awaitEntryModule=await import(entryUrl)
const source = readFileSync(new URL('../lib/health/timeline.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2021 } }).outputText.replace("'./dosing'", JSON.stringify(dosingUrl)).replace("'./dosingEntry'", JSON.stringify(entryUrl))
const { normalizeTimeline, formatTimelineDate, deriveBaseline, groupTimeline, protocolMetadataChips } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const journal = { id: 'j1', date: '2026-09-08', weight: 176.5, notes: 'Feeling good', mood: 4, energy: 3, sleep: 0, hunger: 2 }
const protocol = { id: 'p1', date: '2026-09-07', event_type: 'started', description: 'Original dose', protocol_id: 'p', compound_id: 'c', protocols: { name: 'My protocol' }, compounds: { name: 'Compound' } }

test('mixed journal rows yield distinct weight and check-in events with shared provenance, newest first', () => {
  const events = normalizeTimeline([protocol], [journal])
  assert.deepEqual(events.map((event: { category: string }) => event.category).sort(), ['Journal', 'Protocol', 'Weight'])
  assert.equal(events.at(-1).sourceId, 'p1')
  assert.equal(new Set(events.map((event: { id: string }) => event.id)).size, 3)
  const checkin = events.find((event: { category: string }) => event.category === 'Journal')
  assert.equal(checkin.sourceId, 'j1')
  assert.match(checkin.description, /Sleep 0h/)
  assert.equal(events.at(-1).title, 'Compound started')
})

test('weight-only rows do not create redundant check-ins and missing weight is not zero', () => {
  const row = { ...journal, notes: null, mood: null, energy: null, sleep: null, hunger: null }
  assert.deepEqual(normalizeTimeline([], [row]).map((event: { category: string }) => event.category), ['Weight'])
  assert.deepEqual(normalizeTimeline([], [{ ...row, weight: null }]).map((event: { category: string }) => event.category), ['Journal'])
})

test('deleted relations and unknown event types retain historical descriptions', () => {
  const [event] = normalizeTimeline([{ ...protocol, protocols: null, compounds: null, event_type: 'custom_event' }], [])
  assert.equal(event.title, 'custom event')
  assert.equal(event.description, 'Original dose')
  assert.deepEqual(normalizeTimeline([], []), [])
})

test('calendar dates keep their day west of UTC; ties sort deterministically', () => {
  process.env.TZ = 'America/Los_Angeles'
  assert.equal(formatTimelineDate('2026-09-08'), 'Sep 8, 2026')
  const other = { ...journal, id: 'j2' }
  assert.deepEqual(normalizeTimeline([], [journal, other]), normalizeTimeline([], [other, journal]))
})


const phase = { dose_semantics_version: 1, id: 'phase1', start_week: 1, end_week: 4, dose: 5, dose_unit: 'mg', frequency: '1x/week' }
const enriched = { ...protocol, description: 'Started Compound', protocols: { id: 'p', name: 'Plan', start_date: '2026-09-01', status: 'active' }, compounds: { id: 'c', name: 'Compound', phases: [phase] } }

test('removes mechanical descriptions and exposes structured saved-plan context', () => {
  const [event] = normalizeTimeline([enriched], [])
  assert.equal(event.title, 'Compound started')
  assert.equal(event.description, undefined)
  assert.equal(event.metadata.dose, 5)
  assert.equal(event.metadata.protocolStatus, 'active')
  assert.equal(event.metadata.route, null)
  assert.deepEqual(protocolMetadataChips(event), ['5 mg', 'weekly'])
  const [recorded] = normalizeTimeline([{ ...enriched, description: 'Started Compound at 2.5mg' }], [])
  assert.equal(recorded.description, '2.5mg')
})

test('phase enrichment respects date boundaries, missing dates, and overlapping phases', () => {
  const later = { ...phase, id: 'phase2', start_week: 5, end_week: 8, dose: 10 }
  const row = { ...enriched, date: '2026-09-29', compounds: { ...enriched.compounds, phases: [later, phase] } }
  assert.equal(normalizeTimeline([row], [])[0].metadata.dose, 10)
  assert.equal(normalizeTimeline([{ ...row, date: '2026-12-01' }], [])[0].metadata.dose, null)
  assert.equal(normalizeTimeline([{ ...row, protocols: null }], [])[0].metadata.dose, null)
  assert.equal(normalizeTimeline([{ ...enriched, compounds: { ...enriched.compounds, phases: [phase, { ...phase, id: 'overlap' }] } }], [])[0].metadata.dose, null)
})

test('suppresses exact source/action/date duplicates without merging different protocols or changes', () => {
  assert.equal(normalizeTimeline([enriched, enriched], []).length, 1)
  assert.equal(normalizeTimeline([enriched, { ...enriched, id: 'duplicate' }], []).length, 1)
  assert.equal(normalizeTimeline([enriched, { ...enriched, id: 'distinct', protocol_id: 'another' }], []).length, 2)
  assert.equal(normalizeTimeline([enriched, { ...enriched, id: 'change', description: 'Started Compound at 10mg' }], []).length, 2)
  const blend = { ...enriched, protocol_id: 'blend', compounds: { ...enriched.compounds, name: 'GHK-Cu/KPV' } }
  const standalone = { ...enriched, id: 'standalone-event', protocol_id: 'standalone', compounds: { ...enriched.compounds, name: 'GHK-Cu' } }
  assert.equal(normalizeTimeline([blend, standalone], []).length, 2)
  const unlinked = { ...enriched, protocol_id: null, compound_id: null, protocols: null, compounds: null }
  assert.equal(normalizeTimeline([unlinked, { ...unlinked, id: 'other-unlinked' }], []).length, 2)
})

test('baseline uses active database records independently of events and excludes future observations', () => {
  const active = { ...enriched.protocols, compounds: [enriched.compounds] }
  const completed = { ...active, id: 'completed', status: 'completed' }
  const baseline = deriveBaseline([active, completed], [journal, { ...journal, id: 'future', date: '2027-01-01', weight: 999 }], normalizeTimeline([enriched], []), '2026-09-09')
  assert.equal(baseline.weight, 176.5)
  assert.equal(baseline.activeProtocolCount, 1)
  assert.deepEqual(baseline.activeProtocols[0].compounds.map((c: { name: string }) => c.name), ['Compound'])
  assert.equal(baseline.lastProtocolChangeDate, '2026-09-07')
  assert.equal(deriveBaseline([], [], [], '2026-09-09').weight, null)
})

test('groups multiple entries on one day and separates months and years in descending order', () => {
  const events = normalizeTimeline([enriched, { ...enriched, id: 'older', date: '2025-09-07' }], [journal])
  const groups = groupTimeline(events)
  assert.deepEqual(groups.map((g: { key: string }) => g.key), ['2026-09', '2025-09'])
  assert.equal(groups[0].days[0].events.length, 2)
  assert.equal(groups[0].days[0].date, '2026-09-08')
})


test('baseline selects today’s phase and retains the latest event title', () => {
  const active = { ...enriched.protocols, compounds: [{ ...enriched.compounds, phases: [phase, { ...phase, id: 'later', start_week: 5, end_week: 8, dose: 10 }] }] }
  const result = deriveBaseline([active], [], normalizeTimeline([enriched], []), '2026-09-29')
  assert.equal(result.activeProtocols[0].week, 5)
  assert.deepEqual(result.activeProtocols[0].compounds[0].details, ['10 mg', 'weekly'])
  assert.equal(result.lastProtocolChangeTitle, 'Compound started')
})

test('baseline omits expired, overlapping, undated, and future dosing context', () => {
  const active = { ...enriched.protocols, compounds: [enriched.compounds] }
  const derive = (row: unknown, today = '2026-09-09') => deriveBaseline([row], [], [], today).activeProtocols[0]
  assert.deepEqual(derive(active, '2026-12-01').compounds[0].details, [])
  assert.equal(derive(active, '2026-08-01').week, null)
  assert.deepEqual(derive(active, '2026-08-01').compounds[0].details, [])
  assert.equal(derive({ ...active, start_date: null }).week, null)
  assert.deepEqual(derive({ ...active, compounds: [{ ...enriched.compounds, phases: [phase, phase] }] }).compounds[0].details, [])
})

test('baseline sorts newest start then ID and preserves blend compounds', () => {
  const row = { ...enriched.protocols, compounds: [enriched.compounds, { ...enriched.compounds, id: 'second', name: 'Other', phases: [{ ...phase, dose: 2 }] }] }
  const result = deriveBaseline([{ ...row, id: 'older', start_date: '2026-08-01' }, row, { ...row, id: 'a' }], [], [], '2026-09-09')
  assert.deepEqual(result.activeProtocols.map((p: { id: string }) => p.id), ['a', 'p', 'older'])
  assert.equal(result.activeProtocols[0].compounds.length, 2)
  assert.deepEqual(result.activeProtocols[0].compounds[1].details, ['2 mg', 'weekly'])
})




test('legacy dose remains unreviewed even if numeric value and unit look valid', () => {
  const c = { ...enriched.compounds, phases: [{ ...phase, dose_semantics_version: null }] }
  const p = { ...enriched.protocols, compounds: [c] }
  const result = deriveBaseline([p], [], [], '2026-09-09')
  assert.deepEqual(result.activeProtocols[0].compounds[0].details, [])
  assert.match(result.activeProtocols[0].compounds[0].issue, /Legacy/)
  assert.match(deriveBaseline([p], [], [], '2027-09-09').activeProtocols[0].compounds[0].issue, /phase covers today/)
})


test('baseline prefers current raw entry over stale V1 columns and labels volume-only dose',()=>{
  const {entryFromForm}=awaitEntryModule
  const raw=entryFromForm({input_mode:'volume',injection_volume:'0.5'})
  const active={...enriched.protocols,compounds:[{...enriched.compounds,phases:[{...phase,dose:999,dose_unit:'IU',dose_semantics_version:1,dosing_entry:raw}]}]}
  const baseline=deriveBaseline([active],[],[],'2026-09-09')
  assert.equal(baseline.activeProtocols[0].compounds[0].details[0],'0.5 mL')
  assert.match(baseline.activeProtocols[0].compounds[0].issue,/Medication dose not calculated/)
})
