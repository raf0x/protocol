import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
function load(path, overrides = {}) {
  const url = path.startsWith('file:') ? new URL(path) : new URL(path, import.meta.url)
  if (!Object.keys(overrides).length && cache.has(url.href)) return cache.get(url.href)
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const out = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => {
    if (name in overrides) return overrides[name]
    if (name === 'server-only') return {}
    if (!name.startsWith('.')) return require(name)
    for (const suffix of ['', '.ts']) { try { return load(new URL(name + suffix, url).href, overrides) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    throw new Error(`Missing module ${name}`)
  }, out, out.exports)
  if (!Object.keys(overrides).length) cache.set(url.href, out.exports); return out.exports
}

const { buildAnalystContext } = load('../lib/health/analyst/evidence.ts')
const { buildLabFindingsSummaryModel } = load('../lib/health/labFindingsSummary.ts')
const { biomarkerHistories } = load('../lib/health/labs.ts')
const result = (id, value, extra = {}) => ({ id, user_id: 'fictional-owner', biomarker_name: 'Fictional marker', canonical_name: null, value, value_text: null, unit: 'mg/dL', reference_low: 5, reference_high: 20, reference_text: null, status: value > 20 ? 'high' : value < 5 ? 'low' : 'normal', status_source: 'reported', ...extra })
const panel = (id, date, results) => ({ id, user_id: 'fictional-owner', test_date: date, panel_name: 'Fictional panel', provider: null, notes: null, source_type: 'manual', created_at: date, updated_at: date, results: results.map(row => ({ ...row, lab_panel_id: id })) })
const source = (panels = [], extra = {}) => ({ panels, protocols: [], protocolEvents: [], journal: [], ...extra })
const pair = (before = 10, after = 30, beforeExtra = {}, afterExtra = {}) => [panel('private-old-panel', '2026-08-01', [result('private-old-result', before, beforeExtra)]), panel('private-new-panel', '2026-09-01', [result('private-new-result', after, afterExtra)])]
const summary = panels => buildLabFindingsSummaryModel(panels, biomarkerHistories(panels))
const ctx = (panels = pair(), question = 'What changed since my last labs?', extra = {}) => buildAnalystContext(source(panels, extra), question, '2026-09-13', { includeDeterministicFindings: true })

// Characterization on pristine main, before the shared projection is extracted.
test('current summary anchors a range headline to the unique latest panel', () => {
  assert.equal(summary(pair()).headlines[0].type, 'newly_outside_range')
  assert.equal(summary(pair()).headlines[0].evidence.current.panelId, 'private-new-panel')
})
test('current summary retains previous-panel membership ambiguity', () => {
  const panels = pair(); panels.push(panel('private-other-old', '2026-08-01', [result('other-old', 11)]))
  assert.equal(summary(panels).previousPanelAmbiguous, true)
  assert.equal(summary(panels).newlyMeasuredCount, 0)
})
test('current summary refuses to order multiple latest panels', () => {
  const panels = pair(); panels.push(panel('private-other-new', '2026-09-01', [result('other-new', 31)]))
  assert.equal(summary(panels).state, 'ambiguous_latest')
  assert.deepEqual(summary(panels).headlines, [])
})
test('numeric magnitude and finding presentation priority answer different questions', () => {
  const panels = [panel('old', '2026-08-01', [result('a1', 10, { biomarker_name: 'Large movement', reference_high: 1000 }), result('b1', 19, { biomarker_name: 'Range crossing' })]), panel('new', '2026-09-01', [result('a2', 30, { biomarker_name: 'Large movement', reference_high: 1000, status: 'normal' }), result('b2', 21, { biomarker_name: 'Range crossing' })])]
  assert.equal(summary(panels).headlines[0].biomarkerName, 'Range crossing')
  assert.match(ctx(panels, 'Which biomarkers changed the most?').evidence[0].title, /Large movement/)
})

const { deriveCurrentLabFindingSet } = load('../lib/health/labFindingsSummary.ts')
const { analystInput, healthAnalystSystemPrompt } = load('../lib/health/analyst/prompts.ts')
const { validateHealthAnalysis, AnalystOutputError } = load('../lib/health/analyst/schema.ts')
const { analyzeHealthContext } = load('../lib/health/analyst/service.ts')
const { createDoctorReportFromSource } = load('../lib/health/report/service.ts')
const projection = panels => ctx(panels).deterministicFindings
const plainRange = { reference_high: 1000, status: 'normal' }
const cases = [
  ['newly_outside_range', pair()],
  ['returned_to_range', pair(30, 10)],
  ['persistently_outside_range', pair(25, 30)],
  ['increased', pair(10, 12)],
  ['decreased', pair(12, 10)],
  ['unchanged', pair(10, 10)],
  ['outside_previously_observed_values', [panel('earliest', '2026-07-01', [result('earliest-value', 8, plainRange)]), ...pair(10, 30, plainRange, plainRange)]],
]
for (const [type, panels] of cases) test(`Analyst shares canonical ${type} facts with Health Briefing`, () => {
  const canonical = deriveCurrentLabFindingSet(panels, biomarkerHistories(panels)).findings[0]
  const finding = projection(panels)[0]
  assert.equal(canonical.type, type); assert.equal(finding.type, type)
  assert.equal(finding.presentationPriority, canonical.priority)
  assert.equal(finding.reason, canonical.reason)
  assert.deepEqual(finding.limitations, canonical.limitations)
  assert.equal(finding.current.value, canonical.evidence.current.value)
  assert.equal(finding.current.date, canonical.evidence.current.date)
  assert.equal(finding.previous.value, canonical.evidence.previous.value)
  for (const key of ['delta', 'absoluteDelta', 'percent', 'direction', 'elapsedDays']) assert.equal(finding.comparison[key], canonical.evidence.comparison[key])
  assert.deepEqual(finding.comparison.range, canonical.evidence.comparison.range)
  if (type !== 'unchanged') assert.equal(summary(panels).headlines[0].type, finding.type)
})
test('unknown prior status never becomes newly outside', () => {
  const finding = projection(pair(10, 30, { status: 'unknown', status_source: 'unknown' }))[0]
  assert.equal(finding.type, 'increased'); assert.equal(finding.comparison.range.transition, 'prior_status_unknown')
})
test('changed supplied bounds do not manufacture range transitions', () => {
  const finding = projection(pair(10, 30, {}, { reference_high: 25 }))[0]
  assert.equal(finding.type, 'increased'); assert.equal(finding.comparison.range.transition, 'reference_ranges_differ')
})
for (const value of [30, 31]) test(`same-day ${value === 30 ? 'equal' : 'conflicting'} records do not generate numeric findings`, () => {
  const panels = pair(); panels[1].results.push({ ...panels[1].results[0], id: 'duplicate-result', value })
  assert.ok(!projection(panels).some(finding => finding.comparison))
  assert.equal(ctx(panels).evidence.some(row => row.comparison), false)
})
test('incompatible units remain ineligible, without conversion', () => {
  const finding = projection(pair(10, 30, {}, { unit: 'mmol/L' }))[0]
  assert.equal(finding.type, 'incompatible_comparison'); assert.equal(finding.comparison, null)
})
test('qualitative values stay recorded evidence, not numeric findings', () => {
  const panels = pair(10, null, {}, { value_text: 'Detected', status: 'abnormal' })
  assert.ok(projection(panels).every(f => !f.comparison))
  assert.ok(ctx(panels).evidence.some(row => row.detail.includes('Detected')))
})
test('zero baseline never manufactures a percentage', () => assert.equal(projection(pair(0, 10))[0].comparison.percent, null))
test('latest panel ambiguity reaches provider as ambiguity, not an arbitrary current finding', () => {
  const panels = pair(); panels.push(panel('other-latest', '2026-09-01', [result('other-latest-result', 31)]))
  const context = ctx(panels)
  assert.equal(context.currentFindingScope.state, 'ambiguous_latest')
  assert.deepEqual(context.deterministicFindings, [])
  assert.equal(context.evidence.filter(row => row.type === 'lab_result' && row.date === '2026-09-01').length, 2)
  assert.match(analystInput(context), /ambiguous_latest/)
})
test('previous-panel ambiguity prohibits fabricated new/missing membership', () => {
  const panels = pair(); panels.push(panel('other-previous', '2026-08-01', [result('other', 11, { biomarker_name: 'Other marker' })]))
  const context = ctx(panels)
  assert.equal(context.currentFindingScope.previousPanelAmbiguous, true)
  assert.ok(context.deterministicFindings.every(f => !f.membership))
})
test('older eligible series are never relabelled current findings', () => {
  const panels = [...pair(), panel('latest', '2026-09-10', [result('latest-other', 14, { biomarker_name: 'Other marker' })])]
  assert.ok(!projection(panels).some(f => f.current?.date < '2026-09-10'))
  const missing = projection(panels).find(f => f.type === 'missing_from_latest_panel')
  assert.ok(missing); assert.equal(missing.current, null); assert.equal(missing.comparison, null)
  assert.equal(missing.membership.currentRecorded, false)
})
test('newly measured means absent on prior panel, not never measured in history', () => {
  const panels = [panel('first', '2026-07-01', [result('first', 12)]), panel('middle', '2026-08-01', [result('middle', 13, { biomarker_name: 'Other marker' })]), panel('last', '2026-09-01', [result('last', 14)])]
  const newly = projection(panels).find(f => f.biomarkerName === 'Fictional marker')
  assert.equal(newly.type, 'newly_measured'); assert.equal(newly.membership.previousRecorded, false)
  assert.equal(newly.comparison, null)
})
test('presentation can collapse new biomarkers without destroying shared facts', () => {
  const panels = [panel('old', '2026-08-01', [result('existing-old', 10)]), panel('new', '2026-09-01', [result('existing-new', 10), ...Array.from({ length: 5 }, (_, i) => result(`new-${i}`, 12, { biomarker_name: `New marker ${i}` }))])]
  assert.equal(summary(panels).newlyMeasuredCount, 5)
  assert.equal(summary(panels).headlines.filter(f => f.type === 'newly_measured').length, 1)
  assert.equal(projection(panels).filter(f => f.type === 'newly_measured').length, 5)
})
test('empty and single-date states are shared, without invented new/missing findings', () => {
  for (const panels of [[], [pair()[0]]]) {
    assert.equal(ctx(panels).currentFindingScope.state, summary(panels).state)
    assert.deepEqual(projection(panels), [])
  }
})
test('projection and actual provider serialization contain no DB IDs or hidden input', () => {
  const panels = pair(); panels[0].notes = 'PRIVATE_PANEL_NOTES'; panels[0].source_filename = 'PRIVATE_FILENAME.pdf'; panels[0].source_metadata = { parser: 'PRIVATE_PARSER', raw: 'PRIVATE_RAW' }; panels[0].results[0].source_raw = 'PRIVATE_RESULT_RAW'
  const context = ctx(panels, 'Explain my recorded evidence', { journal: [{ id: 'PRIVATE_JOURNAL_ID', date: '2026-09-10', weight: 170, energy: 4, notes: 'PRIVATE_JOURNAL_NOTE' }] })
  const json = analystInput(context)
  for (const secret of ['private-old-panel', 'private-new-panel', 'private-old-result', 'private-new-result', 'fictional-owner', 'PRIVATE_']) assert.ok(!json.includes(secret), secret)
  assert.doesNotMatch(JSON.stringify(context.deterministicFindings), /resultId|panelId|ownerId|biomarkerKey|protocolId|source_metadata/)
})
test('each finding has complete request-local current, prior and comparison support', () => {
  const context = ctx()
  const finding = context.deterministicFindings[0]
  const supporting = finding.evidenceIds.map(id => context.evidence.find(row => row.id === id))
  assert.ok(supporting.every(Boolean)); assert.ok(finding.evidenceIds.every(id => /^E[1-9][0-9]*$/.test(id)))
  assert.equal(supporting.filter(row => row.type === 'lab_result').length, 2)
  assert.equal(supporting.filter(row => row.type === 'lab_comparison').length, 1)
  assert.deepEqual(supporting.filter(row => row.type === 'lab_result').map(row => row.date).sort(), ['2026-08-01', '2026-09-01'])
})
test('prior observed extent requires all supporting historical readings', () => {
  const context = ctx(cases.at(-1)[1]), f = context.deterministicFindings[0]
  assert.deepEqual(f.priorObservedExtent, { min: 8, max: 10, start: '2026-07-01', end: '2026-08-01', count: 2 })
  assert.equal(f.evidenceIds.map(id => context.evidence.find(row => row.id === id)).filter(row => row.type === 'lab_result').length, 3)
})
test('missing/new membership includes actual source panel and lab evidence', () => {
  const panels = [panel('old', '2026-08-01', [result('old', 10, { biomarker_name: 'Old marker' })]), panel('new', '2026-09-01', [result('new', 12, { biomarker_name: 'New marker' })])]
  const context = ctx(panels)
  for (const f of context.deterministicFindings) {
    const evidence = f.evidenceIds.map(id => context.evidence.find(row => row.id === id))
    assert.equal(evidence.filter(e => e.type === 'lab_panel').length, 2)
    assert.ok(evidence.some(e => e.type === 'lab_result'))
  }
})
test('presentation priority and data confidence remain independent', () => {
  const context = ctx(pair(10, 30, { import_confidence: 'low' }))
  assert.equal(context.deterministicFindings[0].presentationPriority, 'attention')
  assert.equal(context.evidence.find(row => row.comparison).confidence, 'low')
  assert.ok(!('confidence' in context.deterministicFindings[0]))
})
const manyPanels = () => [panel('old', '2026-08-01', Array.from({ length: 55 }, (_, i) => result(`old-${i}`, 10, { biomarker_name: `Marker ${i}` }))), panel('new', '2026-09-01', Array.from({ length: 55 }, (_, i) => result(`new-${i}`, 30, { biomarker_name: `Marker ${i}` })))]
test('caps retain relevant sourced findings, without semantic comparison duplication', () => {
  const context = ctx(manyPanels())
  assert.ok(context.evidence.length <= 40); assert.ok(context.facts.length <= 30); assert.ok(context.gaps.length <= 10)
  assert.ok(context.deterministicFindings.length > 0 && context.deterministicFindings.length <= 10)
  assert.ok(context.currentFindingScope.omittedFindingCount > 0)
  for (const f of context.deterministicFindings) assert.ok(f.evidenceIds.every(id => context.evidence.some(e => e.id === id)))
  const comparisons = context.evidence.filter(e => e.comparison)
  assert.equal(new Set(comparisons.map(e => `${e.title}:${e.date}`)).size, comparisons.length)
})
test('a single long history cannot crowd out the cap or produce an unsourced extent', () => {
  const panels = Array.from({ length: 10 }, (_, i) => panel(`panel-${i}`, `2026-${String(i + 1).padStart(2, '0')}-01`, [result(`result-${i}`, i + 6, plainRange)]))
  const context = ctx(panels)
  assert.equal(context.deterministicFindings.length, 0)
  assert.equal(context.currentFindingScope.omittedFindingCount, 1)
  assert.ok(context.evidence.length <= 40)
})
const nonLabs = { protocols: [{ id: 'PRIVATE_PROTOCOL', name: 'Plan', start_date: '2026-08-01', status: 'active', completed_date: null, compounds: [{ id: 'PRIVATE_COMPOUND', name: 'Recorded compound', phases: [{ id: 'PRIVATE_PHASE', start_week: 1, end_week: null, dose: 3, dose_unit: 'mg', dose_semantics_version: 1, frequency: 'daily', route: 'SubQ' }] }] }], journal: [{ id: 'PRIVATE_JOURNAL', date: '2026-09-10', weight: 170, energy: 3, mood: 4, sleep: 7, hunger: 2, notes: 'PRIVATE_NOTES' }] }
test('general and current intents preserve protocols and numeric check-ins under a full lab cap', () => {
  for (const question of ['Explain my recorded evidence', 'Summarize my current health picture']) {
    const context = ctx(manyPanels(), question, nonLabs)
    for (const type of ['protocol_state', 'weight', 'journal_signal']) assert.ok(context.evidence.some(e => e.type === type), type)
    assert.ok(context.deterministicFindings.length)
    assert.doesNotMatch(analystInput(context), /PRIVATE_/)
  }
})
test('missing data intent selects canonical membership without recommending testing', () => {
  const panels = [panel('old', '2026-08-01', [result('old', 10)]), panel('new', '2026-09-01', [])]
  const context = ctx(panels, 'What information is missing?')
  assert.equal(context.intent, 'missing_data')
  assert.equal(context.deterministicFindings[0].type, 'missing_from_latest_panel')
  assert.doesNotMatch(context.deterministicFindings[0].reason, /should|schedule|test again/)
})
test('finding derivation never mutates source order/data', () => {
  const panels = pair(), original = JSON.stringify(panels)
  ctx(panels); assert.equal(JSON.stringify(panels), original)
})
test('finding inputs are lab only; structured journal signals do not create findings', () => {
  assert.deepEqual(ctx(pair(), 'Explain my recorded evidence', nonLabs).deterministicFindings.map(f => f.type), projection(pair()).map(f => f.type))
  assert.deepEqual(ctx([], 'Explain my recorded evidence', nonLabs).deterministicFindings, [])
})

const valid = (context, text = 'A recorded result decreased between the supplied test dates.') => ({ summary: text, findings: [{ title: 'Recorded evidence', detail: 'Within previously observed values.', evidenceIds: [context.evidence[0].id], confidence: 'medium' }], uncertainties: [], nextObservations: [] })
for (const phrase of ['The protocol caused the increase.', 'The increase was caused by the medication.', 'This demonstrates a treatment effect.', 'This is a treatment response.', 'This shows a response to treatment.', 'The value improved because of the protocol.', 'The value worsened because of the medication.', 'The value improved from treatment.', 'The value improved from a fictional compound.', 'The value is normal for you.', 'This is your healthy range.', 'Attention means this is urgent.', 'Increase your dose.', 'You should stop the medication.']) test(`validator rejects prohibited claim: ${phrase}`, () => {
  const context = ctx(); assert.throws(() => validateHealthAnalysis(valid(context, phrase), new Set(context.evidence.map(e => e.id))), AnalystOutputError)
})
for (const phrase of ['The next recorded lab showed a decrease.', 'A protocol update was recorded between the compared dates.', 'The result occurred after the recorded protocol update.', 'The protocol was present during the recorded interval.', 'The result is within previously observed values.', 'The records do not establish a treatment effect.', 'The records cannot determine a response to treatment.', 'The records cannot establish what is normal for you.', 'Comparison is unavailable due to missing records.']) test(`validator preserves descriptive or uncertainty language: ${phrase}`, () => {
  const context = ctx(); assert.doesNotThrow(() => validateHealthAnalysis(valid(context, phrase), new Set(context.evidence.map(e => e.id))))
})
test('provider contract establishes deterministic authority, numeric ranking and separate priority', () => {
  for (const text of ['authoritative precomputed descriptive facts', 'Do not recalculate or override', 'not medical urgency', 'Data confidence remains separate', 'typed numeric comparison magnitude, not finding priority', 'must not contradict', 'previous-panel ambiguity', 'observational only', 'normal for you', 'same-unit', 'confounders']) assert.ok(healthAnalystSystemPrompt.includes(text), text)
})
test('one question invokes one provider, with inspectable returned citations', async () => {
  const context = ctx(); let calls = 0
  const response = await analyzeHealthContext(context, { generate: async c => { calls++; assert.ok(c.deterministicFindings.length); return { ...valid(c), findings: [{ ...valid(c).findings[0], evidenceIds: c.deterministicFindings[0].evidenceIds }] } } })
  assert.equal(calls, 1)
  assert.equal(response.evidence.length, context.deterministicFindings[0].evidenceIds.length)
})
test('no-evidence deterministic fallback makes no provider request', async () => {
  let calls = 0
  const response = await analyzeHealthContext(ctx([]), { generate: async () => { calls++; throw Error('must not run') } })
  assert.equal(calls, 0); assert.match(response.analysis.summary, /not enough recorded health data/i)
})
test('Doctor Report remains deterministic and its optional AI does not opt into findings', async () => {
  let calls = 0
  const data = source(pair())
  const plain = await createDoctorReportFromSource(data, 'all', false, '2026-09-13', { generate: async () => { calls++; throw Error('must not run') } })
  assert.equal(calls, 0)
  const optional = await createDoctorReportFromSource(data, 'all', true, '2026-09-13', { generate: async c => { calls++; assert.equal(c.deterministicFindings, undefined); assert.ok(!analystInput(c).includes('deterministicFindings')); throw Error('synthetic outage') } })
  assert.equal(calls, 1); assert.deepEqual({ ...optional.report, generatedAt: null }, { ...plain.report, generatedAt: null }); assert.ok(optional.aiError)
})
test('Analyst loader explicitly opts in, while keeping owner-scoped queries and no extra reads', () => {
  const text = readFileSync(new URL('../lib/health/analyst/context.ts', import.meta.url), 'utf8')
  assert.match(text, /buildGuidedAnalystContext/)
  assert.equal((text.match(/\.eq\('user_id', userId\)/g) ?? []).length, 3)
  const projection = readFileSync(new URL('../lib/health/analyst/findings.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(projection, /fetch\(|supabase|\.from\(|\.insert\(|\.update\(/)
})
test('API consent and durable limit remain before health loading and generation', () => {
  const route = readFileSync(new URL('../app/api/health-analyst/route.ts', import.meta.url), 'utf8')
  assert.ok(route.indexOf('if (!await hasCurrentAiConsent') < route.indexOf('const context = await loadHealthAnalystContext'))
  assert.ok(route.indexOf('const limit = await checkDurableRateLimit') < route.indexOf('const context = await loadHealthAnalystContext'))
  assert.equal((route.match(/await analyzeHealthContext/g) ?? []).length, 1)
  assert.match(route, /'Cache-Control': 'no-store'/)
})
test('deterministic Briefing has no AI or persistence dependency', () => {
  for (const file of ['lib/health/healthBriefing.ts', 'lib/health/labFindingsSummary.ts', 'components/health/HealthBriefing.tsx']) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.doesNotMatch(text, /hasCurrentAiConsent|generate\(|provider\.ts|\.insert\(|\.update\(|fetch\(/)
  }
})

test('protocol-context projection retains the exact canonical longitudinal windows and confounders', () => {
  const protocols = nonLabs.protocols.map(p => ({ ...p, start_date: '2026-08-10' }))
  const events = [{ id: 'PRIVATE_EVENT', date: '2026-08-10', event_type: 'started', description: null, protocol_id: 'PRIVATE_PROTOCOL', compound_id: null, metadata: { version: 1 } }, { id: 'PRIVATE_OTHER_EVENT', date: '2026-08-14', event_type: 'started', description: null, protocol_id: 'PRIVATE_OTHER_PROTOCOL', compound_id: null, metadata: { version: 1 } }]
  const data = source(pair(), { protocols, protocolEvents: events, journal: nonLabs.journal })
  const question = 'Show protocol changes around my latest labs'
  const oldContext = buildAnalystContext(data, question, '2026-09-13')
  const context = buildAnalystContext(data, question, '2026-09-13', { includeDeterministicFindings: true })
  const observations = c => c.evidence.filter(e => e.longitudinal).map(e => e.longitudinal)
  assert.ok(observations(context).length)
  assert.deepEqual(observations(context), observations(oldContext))
  assert.ok(observations(context).some(e => e.confounders.length))
  assert.ok(context.evidence.some(e => e.type === 'protocol_state'))
  assert.ok(context.deterministicFindings.length)
  assert.doesNotMatch(JSON.stringify(context.deterministicFindings), /protocolId|compoundId|phaseId|intervention|PRIVATE_/)
  assert.doesNotMatch(analystInput(context), /PRIVATE_/)
})
test('longitudinal evidence keeps precedence under many lab findings', () => {
  const protocols = nonLabs.protocols.map(p => ({ ...p, start_date: '2026-08-10' }))
  const context = ctx(manyPanels(), 'Compare protocol changes with labs', { protocols })
  assert.ok(context.evidence.some(e => e.longitudinal)); assert.ok(context.evidence.length <= 40)
  assert.equal(context.evidence[0].type, 'longitudinal_observation')
})
test('runtime Analyst loader opts in after one owner-scoped batch, not per finding', async () => {
  const queried = [], panels = pair()
  const { loadHealthAnalystContext } = load('../lib/health/analyst/context.ts', { '../loadLabs': { readLabPanels: async (_client, owner) => { assert.equal(owner, 'allowed-owner'); queried.push('labs'); return panels } } })
  const client = { from: table => { queried.push(table); const q = { select: () => q, eq: (key, owner) => { assert.equal(key, 'user_id'); assert.equal(owner, 'allowed-owner'); return q }, order: () => q, limit: async () => ({ data: [], error: null }) }; return q } }
  const context = await loadHealthAnalystContext(client, 'allowed-owner', 'since_last_labs', '2026-09-13')
  assert.equal(context.deterministicFindings[0].type, 'newly_outside_range')
  assert.deepEqual(queried, ['labs'])
})
for (const mode of ['consent-denied', 'rate-denied', 'allowed']) test(`runtime API preserves privacy and request boundaries: ${mode}`, async () => {
  const calls = []
  const route = load('../app/api/health-analyst/route.ts', {
    '../../../lib/serverSupabase': { createAuthenticatedServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'allowed-owner' } } }) } }) },
    '../../../lib/aiConsent': { hasCurrentAiConsent: async () => { calls.push('consent'); return mode !== 'consent-denied' }, consentRequiredResponse: () => ({ code: 'AI_CONSENT_REQUIRED' }) },
    '../../../lib/durableRateLimit': { checkDurableRateLimit: async () => { calls.push('limit'); return { allowed: mode !== 'rate-denied', available: true, retryAfter: 60 } }, rateLimitHeaders: () => ({}) },
    '../../../lib/health/analyst/context': { loadHealthAnalystContext: async () => { calls.push('load'); return ctx() } },
    '../../../lib/health/analyst/service': { analyzeHealthContext: async context => { calls.push('generation'); return analyzeHealthContext(context, { generate: async c => { calls.push('provider'); return valid(c) } }) } },
  })
  const response = await route.POST(new Request('http://localhost/api/health-analyst', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'since_last_labs' }) }))
  assert.equal(response.status, mode === 'consent-denied' ? 403 : mode === 'rate-denied' ? 429 : 200)
  assert.deepEqual(calls, mode === 'consent-denied' ? ['consent'] : mode === 'rate-denied' ? ['consent', 'limit'] : ['consent', 'limit', 'load', 'generation', 'provider'])
  if (mode === 'allowed') assert.equal(response.headers.get('cache-control'), 'no-store')
})
const adversarial = [
  ['Did TRT cause my testosterone to increase?', 'TRT caused the increase.'],
  ['Which treatment worked best?', 'This shows the best treatment response.'],
  ['Was my IGF-1 decrease caused by stopping a peptide?', 'IGF-1 decreased because of stopping a peptide.'],
  ['Is this value normal for me?', 'This is normal for you.'],
  ['Which abnormal result is dangerous?', 'Attention means dangerous.'],
  ['Should I increase my dose?', 'Increase your dose.'],
]
for (const [question, answer] of adversarial) test(`adversarial stub output is rejected for: ${question}`, async () => {
  const context = ctx(pair(), question)
  await assert.rejects(() => analyzeHealthContext(context, { generate: async c => valid(c, answer) }), AnalystOutputError)
})
test('invalid finding citations fail closed, without raw identifiers in returned output', async () => {
  const context = ctx()
  await assert.rejects(() => analyzeHealthContext(context, { generate: async c => ({ ...valid(c), findings: [{ ...valid(c).findings[0], evidenceIds: ['private-new-result'] }] }) }), AnalystOutputError)
})

const { buildGuidedAnalystContext } = load('../lib/health/analyst/evidence.ts')
const guided = (action, panels = pair(), extra = {}) => buildGuidedAnalystContext(source(panels, extra), action, '2026-09-13')
for (const payload of [{}, { action: 'general' }, { action: 'unknown' }, { question: 'PRIVATE_USER_QUESTION' }, { action: 'since_last_labs', question: 'PRIVATE_USER_QUESTION' }, null, [], { action: 1 }]) test(`invalid action returns 400 before auth, loading, limiter or provider: ${JSON.stringify(payload)}`, async () => {
  const calls = []
  const forbidden = name => async () => { calls.push(name); throw Error('must not execute') }
  const route = load('../app/api/health-analyst/route.ts', {
    '../../../lib/serverSupabase': { createAuthenticatedServerClient: forbidden('auth') },
    '../../../lib/health/analyst/context': { loadHealthAnalystContext: forbidden('context') },
    '../../../lib/health/analyst/service': { analyzeHealthContext: forbidden('provider') },
    '../../../lib/durableRateLimit': { checkDurableRateLimit: forbidden('limiter') },
  })
  const response = await route.POST(new Request('http://localhost/api/health-analyst', { method: 'POST', body: JSON.stringify(payload) }))
  assert.equal(response.status, 400); assert.equal((await response.json()).code, 'INVALID_ANALYST_ACTION'); assert.deepEqual(calls, [])
})
test('guided since-last-labs retains canonical truth with no journal, weight or unrelated protocol context', () => {
  const c = guided('since_last_labs', pair(), nonLabs)
  assert.equal(c.deterministicFindings[0].type, summary(pair()).headlines[0].type)
  assert.ok(c.evidence.every(e => ['lab_result', 'lab_comparison', 'lab_panel'].includes(e.type)))
  assert.doesNotMatch(JSON.stringify({ evidence: c.evidence, facts: c.facts, gaps: c.gaps, scope: c.scope }), /PRIVATE_|weight|journal|Recorded compound|legacy or unstructured/)
  assert.ok(c.evidence.length <= 20)
})
test('guided latest comparisons never promote an unrelated old eligible pair', () => {
  const panels = [...pair(), panel('newest', '2026-09-10', [result('newest-result', 10, { biomarker_name: 'Other marker' })])]
  const c = guided('since_last_labs', panels)
  assert.ok(c.evidence.filter(e => e.comparison).every(e => e.comparison.current.date === '2026-09-10'))
  assert.ok(!c.facts.some(f => /31 days apart/.test(f.text)))
})
test('guided snapshot includes current protocol state, no historical event recap and at most one gap', () => {
  const c = guided('current_snapshot', pair(), nonLabs)
  assert.ok(c.evidence.some(e => e.type === 'protocol_state' && e.date === '2026-09-13'))
  assert.ok(!c.evidence.some(e => ['protocol_event', 'weight', 'journal_signal'].includes(e.type)))
  assert.ok(c.gaps.length <= 1); assert.ok(c.evidence.length <= 20)
})
test('guided largest changes ranks numeric magnitude rather than attention priority', () => {
  const panels = [panel('old', '2026-08-01', [result('large-old', 10, { biomarker_name: 'Large movement', reference_high: 1000 }), result('range-old', 19, { biomarker_name: 'Range crossing' })]), panel('new', '2026-09-01', [result('large-new', 30, { biomarker_name: 'Large movement', reference_high: 1000, status: 'normal' }), result('range-new', 21, { biomarker_name: 'Range crossing' })])]
  const c = guided('largest_changes', panels, nonLabs)
  assert.equal(summary(panels).headlines[0].biomarkerName, 'Range crossing')
  assert.match(c.evidence[0].title, /Large movement/); assert.equal(c.evidence[0].comparison.percent, 200)
  assert.ok(c.evidence.length <= 16)
})
test('guided missing-data is limited to gaps with source support, not unrelated changes or testing advice', () => {
  const panels = pair(); panels[0].results.push(result('absent', 12, { biomarker_name: 'Previously measured marker', lab_panel_id: panels[0].id }))
  const c = guided('missing_data', panels, nonLabs)
  assert.ok(c.deterministicFindings.some(f => f.type === 'missing_from_latest_panel'))
  assert.ok(!c.deterministicFindings.some(f => f.type === 'newly_outside_range'))
  assert.deepEqual(c.facts, [])
  assert.match(c.question, /Do not recommend ordering or repeating tests/)
  assert.ok(c.evidence.length <= 16)
})
test('missing-data without membership gaps retains minimal panel evidence and descriptive limitations', () => {
  const c = guided('missing_data', pair())
  assert.ok(c.evidence.some(e => e.type === 'lab_panel'))
  assert.ok(c.gaps.some(g => /Assay\/method compatibility/.test(g.text)))
})
test('guided protocol action preserves canonical windows/confounders without unrelated lab comparisons', () => {
  const protocols = nonLabs.protocols.map(p => ({ ...p, start_date: '2026-08-10' }))
  const protocolEvents = [{ id: 'PRIVATE_EVENT', date: '2026-08-10', event_type: 'started', description: null, protocol_id: 'PRIVATE_PROTOCOL', compound_id: null, metadata: { version: 1 } }, { id: 'PRIVATE_CONFOUNDER', date: '2026-08-14', event_type: 'started', description: null, protocol_id: 'OTHER_PROTOCOL', compound_id: null, metadata: { version: 1 } }]
  const c = guided('protocol_context', pair(), { ...nonLabs, protocols, protocolEvents })
  const legacy = ctx(pair(), 'Show protocol changes around labs', { protocols, protocolEvents })
  assert.deepEqual(c.evidence.filter(e => e.longitudinal).map(e => e.longitudinal), legacy.evidence.filter(e => e.longitudinal).map(e => e.longitudinal))
  assert.ok(c.evidence.some(e => e.longitudinal?.confounders.length))
  assert.ok(c.evidence.every(e => e.longitudinal || e.type === 'protocol_state'))
  assert.ok(c.evidence.length <= 20)
  assert.doesNotMatch(analystInput(c), /PRIVATE_|OTHER_PROTOCOL/)
})
test('guided current/protocol loaders omit journal queries but retain owner-scoped historical sources', async () => {
  for (const action of ['current_snapshot', 'protocol_context']) {
    const queried = []
    const { loadHealthAnalystContext } = load('../lib/health/analyst/context.ts', { '../loadLabs': { readLabPanels: async (_client, owner) => { assert.equal(owner, 'owner'); queried.push('labs'); return pair() } } })
    const client = { from: table => { queried.push(table); const q = { select: () => q, eq: (_key, owner) => { assert.equal(owner, 'owner'); return q }, order: () => q, limit: async () => ({ data: [], error: null }) }; return q } }
    const c = await loadHealthAnalystContext(client, 'owner', action, '2026-09-13')
    assert.equal(c.action, action); assert.deepEqual(queried.sort(), ['labs', 'protocol_events', 'protocols'])
  }
})
test('guided no-evidence fallback does not suggest weight, journals or repeat tests', async () => {
  const response = await analyzeHealthContext(guided('missing_data', []), { generate: async () => { throw Error('must not call') } })
  assert.deepEqual(response.analysis.nextObservations, [])
})

for (const action of ['since_last_labs', 'current_snapshot', 'largest_changes', 'missing_data', 'protocol_context']) test(`API forwards only the validated action to its server-owned context: ${action}`, async () => {
  let contextCalls = 0, providerCalls = 0
  const route = load('../app/api/health-analyst/route.ts', {
    '../../../lib/serverSupabase': { createAuthenticatedServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) } }) },
    '../../../lib/aiConsent': { hasCurrentAiConsent: async () => true },
    '../../../lib/durableRateLimit': { checkDurableRateLimit: async () => ({ allowed: true, available: true }) },
    '../../../lib/health/analyst/context': { loadHealthAnalystContext: async (_client, owner, received, today) => { contextCalls++; assert.equal(owner, 'owner'); assert.equal(received, action); return buildGuidedAnalystContext(source(pair()), received, today) } },
    '../../../lib/health/analyst/service': { analyzeHealthContext: async c => { providerCalls++; assert.equal(c.intent, action); assert.equal(c.action, action); assert.match(c.question, /selected action only/); return { action } } },
  })
  const response = await route.POST(new Request('http://localhost/api/health-analyst', { method: 'POST', body: JSON.stringify({ action }) }))
  assert.equal(response.status, 200); assert.equal(contextCalls, 1); assert.equal(providerCalls, 1)
})
