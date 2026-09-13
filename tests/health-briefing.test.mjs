import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
let hookState = [], cursor = 0, effects = [], overlayCalls = [], overlayResult
const fakeReact = {
  useState(initial) { const index = cursor++; if (!(index in hookState)) hookState[index] = initial; return [hookState[index], value => { hookState[index] = value }] },
  useMemo(fn) { return fn() },
  useEffect(fn) { effects.push(fn) },
}
function load(path) {
  const url = path.startsWith('file:') ? new URL(path) : new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name.endsWith('.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) }
    if (name === 'react') return fakeReact
    if (name === 'react/jsx-runtime') {
      const make = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null })
      return { jsx: make, jsxs: make, Fragment: Symbol.for('fragment') }
    }
    if (name === 'next/link') return { __esModule: true, default: props => ({ type: 'a', props }) }
    if (name.endsWith('/loadProtocolOverlay')) return { loadProtocolOverlay(...args) { overlayCalls.push(args); return overlayResult } }
    if (name.endsWith('/supabase')) return { createClient() { throw new Error('Test must inject an owner-scoped client') } }
    if (!name.startsWith('.')) return require(name)
    for (const suffix of ['', '.ts', '.tsx']) { try { return load(new URL(name + suffix, url).href) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    throw new Error(`Missing module ${name}`)
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}
const { buildHealthBriefing, briefingInterventions } = load('../lib/health/healthBriefing.ts')
const { buildLabFindingsSummaryModel } = load('../lib/health/labFindingsSummary.ts')
const { biomarkerHistories } = load('../lib/health/labs.ts')
const { healthStateAtDate } = load('../lib/health/longitudinal/history.ts')
const { detectInterventions } = load('../lib/health/longitudinal/interventions.ts')
const { HealthBriefingView, default: Controller } = load('../components/health/HealthBriefing.tsx')
const { readProtocolOverlay, loadProtocolOverlay } = load('../lib/health/loadProtocolOverlay.ts')

const file = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
function tree(node) {
  if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') return node
  if (Array.isArray(node)) return node.map(tree)
  if (typeof node.type === 'function') return tree(node.type(node.props))
  return { ...node, props: { ...node.props, children: tree(node.props?.children) } }
}
function text(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(text).join('')
  return text(node.props?.children)
}
function nodes(node, predicate) {
  if (!node || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(item => nodes(item, predicate))
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]
}
const view = model => tree(HealthBriefingView({ model }))
const copy = model => text(view(model))
let serial = 0
const row = (name = 'Fictional marker', value = 10, extra = {}) => ({ id: `result-${++serial}`, lab_panel_id: '', user_id: 'fictional-owner', biomarker_name: name, canonical_name: null, value, value_text: null, unit: 'mg/dL', reference_low: 1, reference_high: 20, reference_text: null, status: value > 20 ? 'high' : 'normal', status_source: 'reported', category: null, ...extra })
const panel = (id, date, results) => ({ id, user_id: 'fictional-owner', test_date: date, panel_name: 'Fictional panel', provider: 'Fictional lab', notes: null, source_type: 'manual', created_at: `${date}T12:00:00Z`, updated_at: `${date}T12:00:00Z`, results: results.map(result => ({ ...result, lab_panel_id: id })) })
const pair = (a = 10, b = 30, first = '2026-08-01', last = '2026-09-01') => [panel('old', first, [row(undefined, a)]), panel('new', last, [row(undefined, b)])]
const phase = extra => ({ id: 'phase-a', start_week: 1, end_week: null, dose: 7, dose_unit: 'mg', dose_semantics_version: 1, dosing_entry: null, frequency: '1x/week', days_of_week: [], route: 'SubQ', ...extra })
const compound = extra => ({ id: 'compound-a', name: 'Fictional compound', phases: [phase()], ...extra })
const protocol = extra => ({ id: 'protocol-a', name: 'Fictional protocol', start_date: '2026-01-01', completed_date: null, status: 'active', compounds: [compound()], ...extra })
const event = (id = 'event-a', date = '2026-08-15', extra = {}) => ({ id, date, event_type: 'route_change', description: null, protocol_id: 'protocol-a', compound_id: 'compound-a', metadata: { version: 1 }, ...extra })
const ready = (protocols = [], events = [], asOf = '2026-09-15') => ({ status: 'ready', asOf, data: { protocols, events } })
const build = (panels = pair(), protocols = ready()) => buildHealthBriefing({ panels, histories: biomarkerHistories(panels), protocols })
const contextModel = events => build(pair(), ready([protocol()], events))

test('no labs and active protocol shows recorded state without fabricated findings', () => {
  const m = build([], ready([protocol()]))
  assert.equal(m.findings.state, 'empty'); assert.deepEqual(m.findings.headlines, [])
  assert.match(copy(m), /No lab history is recorded yet/); assert.match(copy(m), /7 mg/)
  assert.equal(m.protocolContext.items.length, 0)
})
test('empty account adds no empty briefing dashboard', () => {
  const m = build([], ready()); assert.equal(m.state, 'empty'); assert.equal(view(m), null)
})
test('latest date, panel metadata and count come from the unique latest panel', () => {
  const p = pair(); p[1].results.push(row('Second', 11))
  const s = build(p).currentSnapshot
  assert.equal(s.latestDate, '2026-09-01'); assert.equal(s.biomarkerCount, 2)
  assert.deepEqual(s.latestPanel, { id: 'new', panel_name: 'Fictional panel', provider: 'Fictional lab' })
})
test('current state is exactly canonical replay at the explicit as-of date', () => {
  const ps = [protocol()], es = [event('paused', '2026-09-10', { event_type: 'paused' })]
  for (const date of ['2026-09-09', '2026-09-10']) assert.deepEqual(build(pair(), ready(ps, es, date)).currentSnapshot.compounds, healthStateAtDate({ protocols: ps, protocolEvents: es }, date))
})
for (const [unit, value] of [['mg', 7], ['mcg', 80], ['IU', 160]]) test(`confirmed medication ${unit} remains medication dose`, () => {
  const p = protocol({ compounds: [compound({ phases: [phase({ dose: value, dose_unit: unit })] })] })
  assert.match(copy(build(pair(), ready([p]))), new RegExp(`${value} ${unit}`))
})
for (const legacy of [{ dose: 18, dose_unit: 'IU', syringe_units: 18, syringe_scale: 100 }, { dose: 0.18, dose_unit: 'mL', injection_volume_ml: 0.18 }]) test(`unconfirmed ${legacy.dose_unit} is never substituted for medication`, () => {
  const p = protocol({ compounds: [compound({ phases: [phase({ ...legacy, dose_semantics_version: null })] })] })
  const m = build(pair(), ready([p]))
  assert.equal(m.currentSnapshot.compounds[0].medication, null); assert.match(copy(m), /Dose not confirmed/)
  assert.doesNotMatch(copy(m), /18 IU|0\.18 mL|18 units/)
})
test('frequency and phase-owned route survive, without a compound route fallback', () => {
  const m = build(pair(), ready([protocol()]))
  assert.match(copy(m), /weekly · SubQ/)
  const p = protocol({ compounds: [compound({ route: 'IM', phases: [phase({ route: null })] })] })
  assert.equal(build(pair(), ready([p])).currentSnapshot.compounds[0].route, null)
})
test('same-name protocols and compounds retain distinct identities', () => {
  const ps = [protocol({ id: 'a', compounds: [compound({ id: 'a1' }), compound({ id: 'a2' })] }), protocol({ id: 'b', compounds: [compound({ id: 'b1' })] })]
  const rows = build(pair(), ready(ps)).currentSnapshot.compounds
  assert.deepEqual(rows.map(item => [item.protocolId, item.compoundId, item.phaseId]), [['a', 'a1', 'phase-a'], ['a', 'a2', 'phase-a'], ['b', 'b1', 'phase-a']])
})
test('five active compounds all render without a remainder', () => {
  const ps = [protocol({ compounds: Array.from({ length: 5 }, (_, i) => compound({ id: `c-${i}` })) })]
  const m = build(pair(), ready(ps)); assert.equal(m.currentSnapshot.compounds.length, 5); assert.equal(m.currentSnapshot.additionalCompounds, 0)
  assert.doesNotMatch(copy(m), /more recorded compounds/)
})
test('six active compounds render five plus one without name merging', () => {
  const ps = [protocol({ compounds: Array.from({ length: 6 }, (_, i) => compound({ id: `c-${i}` })) })]
  const m = build(pair(), ready(ps)); assert.equal(m.currentSnapshot.compounds.length, 5); assert.equal(m.currentSnapshot.additionalCompounds, 1)
  assert.match(copy(m), /\+1 more recorded compounds/)
})
test('headline model remains identical to the shipped findings presentation model', () => {
  const p = pair(); assert.deepEqual(build(p).findings, buildLabFindingsSummaryModel(p, biomarkerHistories(p)))
})
for (const [a, b, type] of [[10, 30, 'newly_outside_range'], [30, 10, 'returned_to_range'], [10, 12, 'increased'], [12, 10, 'decreased']]) test(`${type} preserves the existing deterministic headline`, () => {
  assert.equal(build(pair(a, b)).findings.headlines[0].type, type)
})
test('unchanged readings do not fabricate headline context', () => {
  const m = build(pair(10, 10), ready([protocol()], [event()]))
  assert.equal(m.findings.headlines.length, 0); assert.equal(m.protocolContext.items.length, 0)
})
test('headline count remains four, with canonical priorities', () => {
  const p = [panel('old', '2026-08-01', Array.from({ length: 8 }, (_, i) => row(`Marker ${i}`, 10))), panel('new', '2026-09-01', Array.from({ length: 8 }, (_, i) => row(`Marker ${i}`, 30 + i)))]
  assert.equal(build(p).findings.headlines.length, 4)
  assert.deepEqual(build(p).findings, buildLabFindingsSummaryModel(p, biomarkerHistories(p)))
})
test('latest-panel ambiguity never chooses a count/name using IDs or insertion order', () => {
  const p = [...pair(), panel('other', '2026-09-01', [row('Other', 1)])]
  for (const panels of [p, [...p].reverse()]) {
    const m = build(panels, ready([protocol()])); assert.equal(m.findings.state, 'ambiguous_latest')
    assert.equal(m.currentSnapshot.latestPanel, null); assert.equal(m.currentSnapshot.biomarkerCount, null)
    assert.equal(m.currentSnapshot.compounds.length, 1); assert.match(copy(m), /will not guess which panel is newest/)
  }
})
test('previous-panel ambiguity is a single grouped explanation', () => {
  const m = build([...pair(), panel('other', '2026-08-01', [row('Other', 1)])])
  assert.equal(m.findings.previousPanelAmbiguous, true)
  assert.equal((copy(m).match(/Some older results share the same test date/g) || []).length, 1)
})
test('missing-from-latest biomarkers remain grouped once, outside headlines', () => {
  const p = pair(); p[0].results.push(row('Missing one', 10), row('Missing two', 11))
  const m = build(p)
  assert.equal(m.findings.missingFromLatestCount, 2)
  assert.match(copy(m), /2 previously measured biomarkers were not recorded/)
  assert.ok(!m.findings.headlines.some(item => item.type === 'missing_from_latest_panel'))
})
test('evidence details retain current/previous/delta facts and trend links', () => {
  const rendered = view(build())
  assert.ok(nodes(rendered, node => node.type === 'details').length)
  assert.match(text(rendered), /Current: 30 mg\/dL/); assert.match(text(rendered), /Previous: 10 mg\/dL/)
  assert.match(text(rendered), /Change: \+20 mg\/dL \(\+200%\)/)
  assert.ok(nodes(rendered, node => node.type === 'a' && node.props.href.startsWith('/health?biomarker=')).length)
})
test('only strictly-between events enter context, excluding both boundary dates', () => {
  const m = contextModel([event('prior', '2026-08-01'), event('between', '2026-08-15'), event('current', '2026-09-01')])
  assert.deepEqual(m.protocolContext.items.map(item => item.id), ['event:between'])
})
test('canonical event title, identity and source references are preserved', () => {
  const ps = [protocol()], es = [event()]
  const canonical = detectInterventions({ protocols: ps, protocolEvents: es, panels: [], journal: [] }, '2026-09-15').find(item => item.id === 'event:event-a')
  assert.deepEqual(build(pair(), ready(ps, es)).protocolContext.items[0], canonical)
})
test('multiple windows form a union, not a false global time range', () => {
  const findings = [...build(pair(10, 30, '2026-06-01', '2026-06-20')).findings.headlines, ...build(pair(10, 30, '2026-08-01', '2026-09-01')).findings.headlines]
  const items = ['2026-06-10', '2026-07-10', '2026-08-10'].map((date, i) => ({ id: `i-${i}`, date }))
  assert.deepEqual(briefingInterventions(findings, items).map(item => item.id), ['i-2', 'i-0'])
})
test('one intervention in overlapping windows is included once by exact ID', () => {
  const findings = build().findings.headlines, item = { id: 'canonical-event', date: '2026-08-15' }
  assert.equal(briefingInterventions([...findings, ...findings], [item, item]).length, 1)
  assert.equal(briefingInterventions(findings, [item, { ...item, id: 'different-event' }]).length, 2)
})
test('distinct same-name interventions are not merged and context is capped at three', () => {
  const m = contextModel(Array.from({ length: 5 }, (_, i) => event(`event-${i}`, `2026-08-${10 + i}`)))
  assert.equal(m.protocolContext.items.length, 3); assert.equal(m.protocolContext.additionalCount, 2)
  assert.match(copy(m), /\+2 other recorded changes/)
})
test('saved-plan boundaries and legacy events are not promoted to structured briefing context', () => {
  const ps = [protocol({ start_date: '2026-08-10' })]
  const m = build(pair(), ready(ps, [event('legacy', '2026-08-15', { metadata: null })]))
  assert.equal(m.protocolContext.items.length, 0)
  assert.match(copy(m), /No recorded protocol changes fell strictly between the compared test dates/)
  assert.equal(nodes(view(m), node => node.type === 'section' && node.props?.['aria-labelledby'] === 'briefing-context-heading').length, 0)
})
test('same-day lifecycle conflict cannot fabricate an active state or event order', () => {
  const events = [event('z', '2026-08-15', { event_type: 'paused' }), event('a', '2026-08-15', { event_type: 'resumed' })]
  for (const es of [events, [...events].reverse()]) {
    const m = contextModel(es)
    assert.equal(m.currentSnapshot.compounds.length, 0)
    assert.ok(m.gaps.some(gap => gap.key === 'protocol_ambiguous'))
    assert.equal(m.protocolContext.items.length, 2) // recorded actions, no invented resolved activity
  }
})
test('historical saved plans remain an explicit limitation, not adherence', () => {
  const m = build(pair(), ready([protocol()]))
  assert.equal(m.currentSnapshot.compounds[0].provenance, 'saved_plan')
  assert.match(copy(m), /Some protocol history is reconstructed from saved plans rather than recorded change snapshots/)
  assert.doesNotMatch(copy(m), /Recorded schedules do not confirm administration/)
  assert.match(file('lib/health/longitudinal/history.ts'), /A saved plan is never presented as an immutable administration log/)
})
test('current-only saved plan does not invent a historical gap', () => {
  const m = build([], ready([protocol()]))
  assert.ok(!m.gaps.some(gap => gap.key === 'historical_plan'))
})
test('one lab date has no comparisons, no temporal findings, one calm explanation', () => {
  const m = build([pair()[0]], ready([protocol()], [event()]))
  assert.equal(m.findings.state, 'insufficient'); assert.equal(m.protocolContext.items.length, 0)
  assert.match(copy(m), /not enough comparable lab history/)
})
test('protocol load failure preserves identical lab headlines and a single quiet gap', () => {
  const p = pair(), m = build(p, { status: 'unavailable', asOf: '2026-09-15' })
  assert.deepEqual(m.findings, build(p).findings)
  assert.equal((copy(m).match(/Protocol context is temporarily unavailable/g) || []).length, 1)
  assert.equal(nodes(view(m), node => node.props?.role === 'alert').length, 0)
})
test('meaningful gaps are bounded at three', () => {
  const p = pair(); p[0].results.push(row('Missing', 10))
  const ps = [protocol({ compounds: [compound({ phases: [phase({ dose_semantics_version: null })] })] })]
  const m = build(p, ready(ps)); assert.equal(m.gaps.length, 3)
  assert.equal(new Set(m.gaps.map(gap => gap.key)).size, m.gaps.length)
})
test('next review has one to three links only to existing evidence surfaces', () => {
  const m = contextModel([event()])
  assert.equal(m.reviewActions.length, 3)
  for (const action of m.reviewActions) assert.match(action.href, /^\/health(?:\?biomarker=|\?view=changes$|\/report$)/)
})
test('one headline makes evidence review primary while clinician report remains secondary', () => {
  const rendered = view(build())
  const evidence = nodes(rendered, node => node.type === 'a' && text(node).includes('Review the evidence'))[0]
  const report = nodes(rendered, node => node.type === 'a' && text(node).includes('Create clinician report'))[0]
  assert.equal(evidence.props.className, 'primary')
  assert.equal(report.props.className, 'textLink')
})
test('there is exactly one What changed with progressively disclosed evidence', () => {
  const rendered = view(build())
  assert.equal(nodes(rendered, node => /^h[1-6]$/.test(String(node.type)) && text(node) === 'What changed').length, 1)
  assert.equal(nodes(rendered, node => node.type === 'summary' && text(node) === 'Evidence').length, 1)
})
test('current snapshot, findings, context, gaps and review maintain reading order', () => {
  const content = copy(contextModel([event()]))
  const positions = ['Current snapshot', 'What changed', 'Recorded protocol context', 'Gaps in the recorded evidence', 'Next review'].map(label => content.indexOf(label))
  assert.ok(positions.every((position, i) => position >= 0 && (!i || position > positions[i - 1])))
})
test('non-empty protocol context retains its full labelled section', () => {
  const rendered = view(contextModel([event()]))
  assert.equal(nodes(rendered, node => node.type === 'section' && node.props?.['aria-labelledby'] === 'briefing-context-heading').length, 1)
  assert.match(text(rendered), /Recorded protocol context/)
})
test('briefing retains identities internally without rendering source IDs', () => {
  const m = contextModel([event()]), content = copy(m)
  for (const id of ['protocol-a', 'compound-a', 'phase-a', 'event-a']) assert.ok(!content.includes(id))
  assert.equal(m.currentSnapshot.compounds[0].phaseId, 'phase-a')
})
test('presentation priorities do not claim medical urgency', () => {
  const content = copy(build())
  assert.match(content, /Review/); assert.doesNotMatch(content, /urgent|emergency|danger|severity/i)
})
test('briefing language is descriptive, without causal or medical recommendations', () => {
  const content = copy(contextModel([event()]))
  assert.match(content, /Recorded between compared tests/)
  assert.doesNotMatch(content, /because of|due to|caused|improved|worsened|normal for you|safe for you|optimal|repeat labs|increase medication|decrease medication|see a specialist/i)
  assert.doesNotMatch(content, /treatment effect/) // temporal wording does not need a medical-effect label
})
test('pure composition does not mutate canonical data or read a clock', () => {
  const p = pair(), h = biomarkerHistories(p), protocols = ready([protocol()], [event()])
  const before = JSON.stringify({ p, h, protocols })
  buildHealthBriefing({ panels: p, histories: h, protocols })
  assert.equal(JSON.stringify({ p, h, protocols }), before)
  assert.doesNotMatch(file('lib/health/healthBriefing.ts'), /new Date|Date\.now|fetch\s*\(|createClient|insert\s*\(|update\s*\(/)
})
test('journal/weight records cannot affect the lab-only briefing', () => {
  const p = pair(), h = biomarkerHistories(p), protocols = ready([protocol()])
  assert.deepEqual(buildHealthBriefing({ panels: p, histories: h, protocols, journal: [{ weight: 999, sleep: 1, mood: 1, energy: 1, hunger: 1 }] }), buildHealthBriefing({ panels: p, histories: h, protocols }))
})
test('no AI, consent, new endpoint or persistence path is introduced', () => {
  const source = file('lib/health/healthBriefing.ts') + file('components/health/HealthBriefing.tsx')
  assert.doesNotMatch(source, /openai|\/api\/|aiConsent|health-analyst|fetch\s*\(|\.insert\s*\(|\.update\s*\(|\.delete\s*\(|localStorage|sessionStorage/i)
})
test('Health retains existing detail surfaces beneath the only briefing placement', () => {
  const dashboard = file('components/health/HealthDashboard.tsx'), insights = file('components/health/LabInsights.tsx')
  assert.equal((dashboard.match(/<HealthBriefing /g) || []).length, 1)
  assert.ok(dashboard.indexOf('<HealthBriefing') < dashboard.indexOf('<LabInsights'))
  assert.ok(dashboard.indexOf('<LabInsights') < dashboard.indexOf('Recent panels'))
  for (const label of ['Latest panel', 'By category', 'Explore biomarkers']) assert.ok(insights.includes(label))
  assert.ok(!insights.includes('LabFindingsSummary'))
})
test('narrow briefing rows/actions wrap without forced page width', () => {
  const css = file('app/health/health.module.css').split('/* Briefing composes')[1]
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\)/)
  assert.match(css, /flex-wrap: wrap/); assert.match(css, /overflow-wrap: anywhere/)
  assert.doesNotMatch(css, /100vw|min-width:\s*[1-9]\d*px/)
  const inherited = file('app/health/health.module.css')
  assert.match(inherited, /:focus-visible/); assert.match(inherited, /min-height: 44px/)
})

const tick = () => new Promise(resolve => setImmediate(resolve))
function mount(panels, promise) {
  hookState = []; cursor = 0; effects = []; overlayCalls = []; overlayResult = promise
  const props = { panels, histories: biomarkerHistories(panels) }
  const initial = tree(Controller(props)), cleanup = effects[0]()
  return { initial, cleanup, render() { cursor = 0; effects = []; return tree(Controller(props)) } }
}
test('client load extends scope through today in one batched overlay call', async () => {
  const mounted = mount(pair(), Promise.resolve({ protocols: [protocol()], events: [] }))
  assert.equal(overlayCalls.length, 1)
  const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  assert.deepEqual(overlayCalls[0], ['2026-08-01', today > '2026-09-01' ? today : '2026-09-01'])
  assert.ok(!text(mounted.initial).includes('As of'))
  await tick(); assert.match(text(mounted.render()), /As of/); mounted.cleanup()
})
test('rejected overlay load renders lab findings without rejecting the Health page', async () => {
  const mounted = mount(pair(), Promise.reject(new Error('sensitive database detail')))
  await tick(); const content = text(mounted.render())
  assert.match(content, /What changed/); assert.match(content, /temporarily unavailable/)
  assert.ok(!content.includes('sensitive database detail')); mounted.cleanup()
})
test('unmount cleanup ignores a late protocol response', async () => {
  let resolve; const mounted = mount(pair(), new Promise(done => { resolve = done }))
  mounted.cleanup(); resolve({ protocols: [protocol()], events: [] }); await tick()
  assert.equal(hookState[0].status, 'loading')
})
test('owner-scoped loader has no per-finding reads and retains event history', async () => {
  const calls = [], ps = [protocol()]
  const client = { from(table) {
    calls.push(['from', table])
    const query = {}
    for (const method of ['select', 'eq', 'lte', 'or', 'order', 'in']) query[method] = (...args) => { calls.push([table, method, ...args]); return query }
    query.then = resolve => resolve({ data: table === 'protocols' ? ps : [event()], error: null })
    return query
  } }
  await readProtocolOverlay(client, 'fictional-owner', '2026-08-01', '2026-09-15')
  assert.deepEqual(calls.filter(call => call[0] === 'from'), [['from', 'protocols'], ['from', 'protocol_events']])
  for (const table of ['protocols', 'protocol_events']) assert.ok(calls.some(call => call[0] === table && call[1] === 'eq' && call[2] === 'user_id' && call[3] === 'fictional-owner'))
  assert.ok(!calls.some(call => call[0] === 'protocol_events' && call[1] === 'gte'))
})
test('missing authentication cannot begin protocol reads', async () => {
  let read = false
  const client = { auth: { async getUser() { return { data: { user: null }, error: null } } }, from() { read = true } }
  await assert.rejects(loadProtocolOverlay('2026-08-01', '2026-09-15', client), /Sign in/)
  assert.equal(read, false)
})
