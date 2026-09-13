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
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
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
const identity = load('../lib/health/protocolIdentity.ts')
const timeline = load('../lib/health/timelinePresentation.ts')
const { normalizeTimeline } = load('../lib/health/timeline.ts')
const longitudinal = load('../lib/health/longitudinal/presentation.ts')
const { detectInterventions } = load('../lib/health/longitudinal/interventions.ts')
const treatment = (protocolId = 'p1', compoundId = 'c1') => ({ protocolId, compoundId })
const intervention = (id, protocolId = 'p1', compoundId = 'c1', extra = {}) => ({
  id, protocolId, compoundId, phaseId: 'phase1', date: '2026-01-01', kind: 'started',
  treatmentName: 'Same display name', title: 'Do not parse this title', before: null, after: null,
  provenance: 'event', sources: [], limitations: [], ...extra,
})
const timelineEvent = (item, extra = {}) => ({ id: item.id, sourceId: item.id, sourceType: 'protocol_events',
  date: item.date, category: 'Protocol', title: item.title,
  metadata: { protocolId: item.protocolId, compoundId: item.compoundId, phaseId: item.phaseId,
    compoundName: item.treatmentName, protocolName: 'Same display name', eventType: item.kind }, ...extra })
const options = items => longitudinal.longitudinalTreatmentOptions(items)
const selected = (items, target) => longitudinal.treatmentProtocolChangeOptions(items, target).map(item => item.id)
const selectedTimeline = (items, target) => {
  const events = items.map(item => timelineEvent(item))
  return events.filter(timeline.timelineTreatmentPredicate(events, target)).map(item => item.id)
}

test('same display name with different protocol IDs always produces separate identities', () => {
  const items = [intervention('a'), intervention('b', 'p2')]
  assert.equal(options(items).length, 2)
  assert.equal(new Set(options(items).map(item => item.label)).size, 1)
  assert.notEqual(options(items)[0].key, options(items)[1].key)
  assert.deepEqual(selected(items, treatment()), ['a'])
  assert.deepEqual(selectedTimeline(items, treatment()), ['a'])
})
test('same protocol/compound pair is one identity even with distinct phases and reactivation', () => {
  const items = [intervention('a'), intervention('b', 'p1', 'c1', { phaseId: 'phase2', kind: 'phase_started' }),
    intervention('c', 'p1', 'c1', { kind: 'reactivated', date: '2026-06-01' })]
  assert.equal(options(items).length, 1)
  assert.deepEqual(options(items)[0].interventionIds, ['a', 'b', 'c'])
  assert.ok(identity.sameTreatmentIdentity(items[0], items[1]))
  assert.equal(identity.treatmentIdentityKey(items[0]), identity.treatmentIdentityKey(items[2]))
})
test('different compound IDs remain distinct within a single episode including blend names', () => {
  const items = [intervention('a'), intervention('b', 'p1', 'c2')]
  assert.equal(options(items).length, 2)
  assert.deepEqual(selected(items, treatment()), ['a'])
  assert.deepEqual(selectedTimeline(items, treatment()), ['a'])
})
test('completed and restarted same-name treatments with different protocol IDs remain separate', () => {
  const items = [intervention('old', 'old-protocol', 'c1', { kind: 'stopped' }), intervention('new', 'new-protocol', 'c1')]
  assert.equal(options(items).length, 2)
  assert.deepEqual(selected(items, treatment('new-protocol')), ['new'])
})
test('sole-compound association is collection-scoped, does not mutate lifecycle identity and preserves event IDs', () => {
  const items = [intervention('lifecycle', 'p1', null), intervention('dose'), intervention('phase', 'p1', 'c1', { phaseId: 'phase2' })]
  const before = structuredClone(items)
  assert.equal(options(items).length, 1)
  assert.deepEqual(options(items)[0].identity, treatment())
  assert.deepEqual(selected(items, treatment()), ['lifecycle', 'dose', 'phase'])
  assert.deepEqual(selectedTimeline(items, treatment()), ['lifecycle', 'dose', 'phase'])
  assert.deepEqual(items, before)
  assert.equal(items[0].compoundId, null)
})
test('multiple known compounds keep lifecycle events protocol-scoped, never assign by matching name', () => {
  const items = [intervention('lifecycle', 'p1', null), intervention('a'), intervention('b', 'p1', 'c2')]
  assert.equal(options(items).length, 3)
  assert.deepEqual(options(items).find(item => item.scope === 'protocol').identity, treatment('p1', null))
  assert.deepEqual(selected(items, treatment()), ['a'])
  assert.deepEqual(selectedTimeline(items, treatment()), ['a'])
  // Explicit episode selection includes all treatment events in that episode.
  assert.deepEqual(selected(items, treatment('p1', null)), ['lifecycle', 'a', 'b'])
})
test('unknown compound never borrows another protocol compound, even with the same name', () => {
  const items = [intervention('lifecycle', 'p1', null), intervention('other', 'p2')]
  assert.equal(options(items).length, 2)
  assert.deepEqual(selected(items, treatment('p2')), ['other'])
  assert.deepEqual(selected(items, treatment()), [])
  assert.deepEqual(selectedTimeline(items, treatment('p2')), ['other'])
})
test('key uses exact IDs only, round-trips safely through URLSearchParams and avoids delimiter collisions', () => {
  const pair = treatment('episode:/?"α', 'compound:,?&')
  const key = identity.treatmentIdentityKey(pair)
  const query = new URLSearchParams({ treatment: key })
  assert.deepEqual(identity.parseTreatmentIdentityKey(query.get('treatment')), pair)
  assert.notEqual(identity.treatmentIdentityKey(treatment('a:b', 'c')), identity.treatmentIdentityKey(treatment('a', 'b:c')))
  assert.notEqual(identity.treatmentIdentityKey(treatment('p1', null)), identity.treatmentIdentityKey(treatment('p1', 'null')))
  assert.equal(identity.treatmentScope(pair), 'compound')
  assert.equal(identity.treatmentScope(treatment('p1', null)), 'protocol')
  const renamed = { ...pair, name: 'Never in key', phaseId: 'never-phase', status: 'completed', date: '2040-01-01' }
  assert.equal(identity.treatmentIdentityKey(renamed), key)
  assert.doesNotMatch(key, /Never in key|never-phase|completed|2040/)
})
test('invalid identities and malformed or noncanonical URL keys do not get repaired', () => {
  for (const pair of [[null, 'c'], ['', 'c'], ['  ', 'c'], [7, null], ['p', false], ['p', '']]) assert.equal(identity.treatmentIdentity(...pair), null)
  for (const key of ['', 't2:["p",null]', 't1:[]', 't1:["p"]', 't1:["p",null,3]', 't1:{"protocolId":"p"}', 't1:["p",false]', 't1:not-json']) assert.equal(identity.parseTreatmentIdentityKey(key), null)
  assert.deepEqual(identity.treatmentIdentity(' p ', 'c'), { protocolId: ' p ', compoundId: 'c' })
  assert.equal(identity.sameTreatmentIdentity(treatment('P'), treatment('p')), false)
})
test('options are deterministic under collection shuffling; labels are not identity', () => {
  const items = [intervention('z', 'p1', null), intervention('b', 'p1', 'c1', { treatmentName: 'Zulu' }), intervention('a', 'p1', 'c1', { treatmentName: 'Alpha' }), intervention('c', 'p2')]
  assert.deepEqual(options(items), options([...items].reverse()))
  const events = items.map(item => timelineEvent(item))
  assert.deepEqual(timeline.timelineTreatmentOptions(events), timeline.timelineTreatmentOptions([...events].reverse()))
  assert.equal(options(items)[0].label, 'Alpha')
  assert.deepEqual(options(items).map(o => o.key), options(items.map(item => ({ ...item, treatmentName: 'New label' }))).map(o => o.key))
})
test('Timeline and Longitudinal derive identical identity keys and retain all secondary event IDs', () => {
  const items = [intervention('start', 'p1', null), intervention('dose'), intervention('other', 'p2', 'c2')]
  const a = options(items), b = timeline.timelineTreatmentOptions(items.map(item => timelineEvent(item)))
  assert.deepEqual(a.map(o => [o.key, o.identity, o.scope]), b.map(o => [o.key, o.identity, o.scope]))
  assert.deepEqual(a.map(o => o.interventionIds), b.map(o => o.eventIds))
})
test('unknown selections match nothing; All preserves existing change options and Timeline journal entries', () => {
  const items = [intervention('a'), intervention('a')]
  assert.deepEqual(selected(items, treatment('unknown')), [])
  assert.deepEqual(selectedTimeline(items, treatment('unknown')), [])
  assert.deepEqual(longitudinal.treatmentProtocolChangeOptions(items, null), longitudinal.protocolChangeOptions(items))
  const events = [timelineEvent(items[0]), timelineEvent(items[0], { id: 'journal', category: 'Journal' })]
  assert.equal(timeline.timelineTreatmentOptions(events).length, 1)
  assert.equal(events.filter(timeline.timelineTreatmentPredicate(events, null)).length, 2)
  assert.equal(events.filter(timeline.timelineTreatmentPredicate(events, treatment())).length, 1)
})
test('existing change deep links and comparison predicates remain unchanged', () => {
  const id = 'event:exact/id&1'
  const url = new URL(longitudinal.protocolChangeUrl('view=changes&other=kept', id), 'https://example.test')
  assert.equal(url.searchParams.get('change'), id); assert.equal(url.searchParams.get('other'), 'kept')
  const item = intervention(id)
  const obs = [item, intervention('different')].map(intervention => ({ intervention, changes: [{ delta: 1 }], baseline: { type: 'lab' }, followups: [{ type: 'lab' }] }))
  assert.deepEqual(longitudinal.comparableLabObservations(obs, id), [obs[0]])
  assert.deepEqual(longitudinal.comparableLabObservations(obs, 'unknown'), [])
  assert.equal(new URL(longitudinal.protocolChangeUrl(url.search, ''), url).searchParams.has('change'), false)
})
test('legacy intervention without structured display name uses a neutral label, never title parsing', () => {
  const item = intervention('legacy', 'p1', 'c1', { treatmentName: undefined, title: 'Secret name started' })
  assert.equal(options([item])[0].label, 'Recorded compound')
})
test('detector supplies structured label on event, saved lifecycle and phase paths without changing titles or IDs', () => {
  const source = { protocols: [{ id: 'p1', name: 'Episode label', start_date: '2026-01-01', status: 'active', compounds: [{ id: 'c1', name: 'Compound label', phases: [
    { id: 'phase1', start_week: 1, end_week: 1, dose: 1, dose_unit: 'mg', dose_semantics_version: 1, frequency: 'weekly' },
    { id: 'phase2', start_week: 2, end_week: null, dose: 2, dose_unit: 'mg', dose_semantics_version: 1, frequency: 'weekly' },
  ] }] }], protocolEvents: [{ id: 'e1', protocol_id: 'p1', compound_id: 'c1', date: '2026-01-10', event_type: 'route_change', metadata: { version: 1 } }], panels: [], journal: [] }
  const events = detectInterventions(source, '2026-02-01')
  const lifecycle = events.find(e => e.id === 'protocol:p1:started:2026-01-01')
  assert.equal(lifecycle.treatmentName, 'Episode label'); assert.equal(lifecycle.title, 'Episode label started')
  const explicit = events.find(e => e.id === 'event:e1')
  assert.equal(explicit.treatmentName, 'Compound label'); assert.equal(explicit.title, 'Compound label route changed')
  const boundary = events.find(e => e.id === 'phase:c1:2026-01-08:dose_increased')
  assert.equal(boundary.treatmentName, 'Compound label'); assert.equal(boundary.title, 'Compound label dose increased')
  assert.deepEqual(boundary.after, { value: 2, unit: 'mg' })
})
test('Timeline exposes protocol name without replacing a null compound ID or parsing its title', () => {
  const row = { id: 'event1', date: '2026-01-01', event_type: 'started', description: null, protocol_id: 'p1', compound_id: null,
    protocols: { id: 'p1', name: 'Episode label', status: 'active', start_date: '2026-01-01', compounds: [{ id: 'c1', name: 'Compound label', phases: [] }] }, compounds: null }
  const event = normalizeTimeline([row], [])[0]
  assert.equal(event.title, 'Compound label started')
  assert.equal(event.metadata.compoundId, null); assert.equal(event.metadata.protocolName, 'Episode label')
  const option = timeline.timelineTreatmentOptions([event])[0]
  assert.equal(option.label, 'Episode label'); assert.equal(option.scope, 'protocol')
})
