import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
function load(path) {
  const url = path.startsWith('file:') ? new URL(path) : new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const out = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => {
    if (name === 'server-only') return {}
    if (!name.startsWith('.')) return require(name)
    for (const suffix of ['', '.ts']) { try { return load(new URL(name + suffix, url).href) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    throw new Error(`Missing module ${name}`)
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}

const evidenceModule = load('../lib/health/analyst/evidence.ts')
const schema = load('../lib/health/analyst/schema.ts')
const service = load('../lib/health/analyst/service.ts')
const providerModule = load('../lib/health/analyst/provider.ts')
const result = (id, name, value, unit = 'mg/dL', status = 'normal', extra = {}) => ({ id, lab_panel_id: 'panel', user_id: 'owner', biomarker_name: name, canonical_name: null, value, value_text: null, unit, reference_low: 5, reference_high: 20, reference_text: null, status, status_source: 'reported', category: null, ...extra })
const panel = (id, date, results) => ({ id, user_id: 'owner', test_date: date, panel_name: `Panel ${id}`, provider: null, notes: null, source_type: 'manual', created_at: date, updated_at: date, results: results.map(item => ({ ...item, lab_panel_id: id })) })
const source = (panels = [], extra = {}) => ({ panels, protocols: [], protocolEvents: [], journal: [], ...extra })
const context = (question = 'What changed since my last labs?', data = source([
  panel('new', '2026-09-01', [result('n', 'Glucose', 12)]), panel('old', '2026-08-01', [result('o', 'Glucose', 10)]),
])) => evidenceModule.buildAnalystContext(data, question, '2026-09-10', { includeDeterministicFindings: true })
const valid = (ctx = context()) => ({ summary: 'Recorded values changed between panels.', findings: [{ title: 'Largest recorded change', detail: 'Glucose moved up across two same-unit readings.', evidenceIds: [ctx.evidence[0].id], confidence: 'high' }], uncertainties: [], nextObservations: [] })

test('classifies last-labs intent', () => assert.equal(evidenceModule.classifyAnalystIntent('What changed since my last labs?'), 'since_last_labs'))
test('classifies current snapshot intent', () => assert.equal(evidenceModule.classifyAnalystIntent('Summarize my current health picture'), 'current_snapshot'))
test('classifies protocol context intent', () => assert.equal(evidenceModule.classifyAnalystIntent('Show protocol changes around labs'), 'protocol_context'))
test('classifies largest change intent', () => assert.equal(evidenceModule.classifyAnalystIntent('Which biomarkers changed the most?'), 'largest_changes'))
test('classifies missing-data intent', () => assert.equal(evidenceModule.classifyAnalystIntent('What information is missing?'), 'missing_data'))
test('same-unit readings produce deterministic comparison evidence', () => assert.ok(context().evidence.some(item => item.type === 'lab_comparison' && item.detail.includes('+20.0%'))))
test('comparison records elapsed days', () => assert.ok(context().evidence.some(item => item.detail.includes('31 days apart'))))
test('Analyst receives shared numeric and range facts without source identifiers', () => {
  const c = context().evidence.find(item => item.type === 'lab_comparison').comparison
  assert.equal(c.delta, 2); assert.equal(c.percent, 20); assert.equal(c.elapsedDays, 31)
  assert.equal(c.direction, 'increased'); assert.equal(c.range.transition, 'remained_inside')
  assert.ok(c.limitations.includes('assay_method_unknown')); assert.doesNotMatch(JSON.stringify(c), /resultId|panelId|ownerId|source_raw/)
})
test('unknown previous status does not produce a newly-outside Analyst fact', () => {
  const ctx = context('since my last labs', source([
    panel('new', '2026-09-01', [result('n', 'Glucose', 30, 'mg/dL', 'high')]),
    panel('old', '2026-08-01', [result('o', 'Glucose', 10, 'mg/dL', 'unknown')]),
  ]))
  assert.equal(ctx.deterministicFindings[0].comparison.range.transition, 'prior_status_unknown')
  assert.ok(!ctx.deterministicFindings.some(finding => finding.type === 'newly_outside_range'))
})
test('different units never produce a comparison', () => {
  const ctx = context('largest change', source([panel('n', '2026-09-01', [result('n', 'Glucose', 12, 'mmol/L')]), panel('o', '2026-08-01', [result('o', 'Glucose', 10)])])); assert.equal(ctx.evidence.some(item => item.type === 'lab_comparison'), false)
})
test('missing supplied range is stated without invention', () => {
  const ctx = context('current snapshot', source([panel('n', '2026-09-01', [result('n', 'Marker', 12, 'mg/dL', 'unknown', { reference_low: null, reference_high: null })])])); assert.match(ctx.evidence[0].detail, /No reference range was supplied/)
})
test('stored high status is surfaced', () => assert.ok(context('current snapshot', source([panel('n', '2026-09-01', [result('n', 'Marker', 22, 'mg/dL', 'high')])])).evidence[0].detail.includes('Stored status: high')))
test('qualitative results remain evidence', () => assert.ok(context('current snapshot', source([panel('n', '2026-09-01', [result('n', 'Marker', null, '', 'unknown', { value_text: 'Detected' })])])).evidence[0].detail.includes('Detected')))
test('latest weight and deterministic delta are included', () => {
  const ctx = context('current snapshot', source([], { journal: [{ id: 'w2', date: '2026-09-01', weight: 180, mood: null, energy: null, sleep: null, hunger: null, notes: null }, { id: 'w1', date: '2026-08-01', weight: 185, mood: null, energy: null, sleep: null, hunger: null, notes: null }] })); assert.ok(ctx.evidence.some(item => item.detail.includes('-5 lb')))
})
test('journal notes are excluded from model evidence', () => {
  const ctx = context('current snapshot', source([], { journal: [{ id: 'j', date: '2026-09-01', weight: null, mood: 4, energy: 3, sleep: 7, hunger: null, notes: 'private free text' }] })); assert.ok(!JSON.stringify(ctx).includes('private free text'))
})
test('structured protocol event receives high data confidence', () => {
  const ctx = context('protocol changes', source([], { protocolEvents: [{ id: 'e', date: '2026-09-01', event_type: 'dose_change', description: null, protocol_id: 'p', compound_id: 'c', metadata: { version: 1, newDose: 5, newUnit: 'mg' } }] })); assert.equal(ctx.evidence.find(item => item.type === 'protocol_event').confidence, 'high')
})
test('legacy protocol event receives low data confidence', () => {
  const ctx = context('protocol changes', source([], { protocolEvents: [{ id: 'e', date: '2026-09-01', event_type: 'changed', description: 'edited', protocol_id: 'p', compound_id: 'c' }] })); assert.equal(ctx.evidence.find(item => item.type === 'protocol_event').confidence, 'low')
})
test('protocol timing is expressed as days before a lab', () => {
  const ctx = context('protocol changes', source([panel('n', '2026-09-10', [result('n', 'Marker', 12)])], { protocolEvents: [{ id: 'e', date: '2026-09-01', event_type: 'started', description: null, protocol_id: 'p', compound_id: 'c', metadata: { version: 1 } }] })); assert.ok(ctx.evidence.some(item => item.detail.includes('9 days before')))
})
test('request-local evidence IDs hide database identifiers', () => { const ctx = context(); assert.ok(ctx.evidence.every((item, index) => item.id === `E${index + 1}`)) })
test('context is capped at forty evidence items', () => {
  const rows = Array.from({ length: 60 }, (_, index) => result(`id-${index}`, `Marker ${index}`, index)); assert.ok(context('current snapshot', source([panel('n', '2026-09-01', rows)])).evidence.length <= 40)
})
test('sparse context explains missing labs', () => assert.ok(context('current snapshot', source()).gaps.some(item => /No lab panels/.test(item.text))))
test('one panel explains comparison limitation', () => assert.ok(context('last labs', source([panel('n', '2026-09-01', [result('n', 'Marker', 1)])])).gaps.some(item => /Only one/.test(item.text))))
test('valid structured output passes validation', () => { const ctx = context(); assert.equal(schema.validateHealthAnalysis(valid(ctx), new Set(ctx.evidence.map(item => item.id))).findings.length, 1) })
test('unknown evidence IDs reject output', () => assert.throws(() => schema.validateHealthAnalysis({ ...valid(), findings: [{ ...valid().findings[0], evidenceIds: ['E999'] }] }, new Set(['E1'])), /valid evidence/))
test('malformed output is rejected', () => assert.throws(() => schema.validateHealthAnalysis({ summary: 'x' }, new Set()), /invalid response shape/))
test('causal claims are rejected', () => { const ctx = context(), body = valid(ctx); body.findings[0].detail = 'The protocol caused this lab change.'; assert.throws(() => schema.validateHealthAnalysis(body, new Set(ctx.evidence.map(item => item.id))), /safety/) })
test('diagnostic claims are rejected', () => { const ctx = context(), body = valid(ctx); body.summary = 'You have a disease.'; assert.throws(() => schema.validateHealthAnalysis(body, new Set(ctx.evidence.map(item => item.id))), /safety/) })
test('medication recommendations are rejected', () => { const ctx = context(), body = valid(ctx); body.summary = 'You should increase your medication dose.'; assert.throws(() => schema.validateHealthAnalysis(body, new Set(ctx.evidence.map(item => item.id))), /safety/) })
test('service returns only evidence referenced by findings', async () => {
  const ctx = context(); const body = valid(ctx); const answer = await service.analyzeHealthContext(ctx, { generate: async () => body }); assert.deepEqual(answer.evidence.map(item => item.id), body.findings[0].evidenceIds)
})
test('service handles no evidence without calling provider', async () => {
  let called = false; const answer = await service.analyzeHealthContext(context('snapshot', source()), { generate: async () => { called = true } }); assert.equal(called, false); assert.equal(answer.analysis.findings.length, 0)
})
test('provider uses strict JSON schema and bounded output cap', async () => {
  let request; const ctx = context(); const p = new providerModule.OpenAIHealthAnalystProvider('secret', 'test-model', async (_url, init) => { request = JSON.parse(init.body); return new Response(JSON.stringify({ output_text: JSON.stringify(valid(ctx)) })) }); await p.generate(ctx); assert.equal(request.text.format.strict, true); assert.equal(request.max_output_tokens, 4000); assert.equal(request.store, false)
})
test('provider failures use a controlled error', async () => {
  const p = new providerModule.OpenAIHealthAnalystProvider('secret', 'test-model', async () => new Response('', { status: 500 })); await assert.rejects(() => p.generate(context()), providerModule.AnalystProviderError)
})
test('API key is server-only and never NEXT_PUBLIC', () => { const src = readFileSync(new URL('../lib/health/analyst/provider.ts', import.meta.url), 'utf8'); assert.match(src, /import 'server-only'/); assert.match(src, /OPENAI_API_KEY/); assert.ok(!src.includes('NEXT_PUBLIC_OPENAI')) })
test('context queries are owner scoped', () => { const src = readFileSync(new URL('../lib/health/analyst/context.ts', import.meta.url), 'utf8'); assert.ok((src.match(/\.eq\('user_id', userId\)/g) ?? []).length >= 3) })
test('context reuses strict protocol overlay history', () => { const src = readFileSync(new URL('../lib/health/analyst/evidence.ts', import.meta.url), 'utf8'); assert.match(src, /contextAtDate/) })
test('analyst UI renders model data as text rather than arbitrary HTML', () => { const src = readFileSync(new URL('../components/health/HealthAnalyst.tsx', import.meta.url), 'utf8'); assert.ok(!src.includes('dangerouslySetInnerHTML')); assert.match(src, /View evidence/) })
test('analyst UI exposes only the five guided actions', () => {
  const src = readFileSync(new URL('../components/health/HealthAnalyst.tsx', import.meta.url), 'utf8')
  for (const action of ['since_last_labs', 'current_snapshot', 'largest_changes', 'missing_data', 'protocol_context']) assert.ok(src.includes(action))
  for (const label of ['What changed since my last labs?', 'Current health snapshot', 'Largest recorded lab changes', 'What information is missing?', 'Protocol timing around latest labs']) assert.ok(src.includes(label))
  assert.ok(!/<input|<textarea/.test(src)); assert.ok(!/Ask another question|Ask anything/.test(src))
})
test('newly measured biomarker names are prepared deterministically', () => {
  const ctx = context('last labs', source([panel('n', '2026-09-01', [result('n1', 'Glucose', 12), result('n2', 'Ferritin', 11)]), panel('o', '2026-08-01', [result('o1', 'Glucose', 10)])])); assert.ok(ctx.deterministicFindings.some(item => item.type === 'newly_measured' && item.biomarkerName === 'Ferritin'))
})
test('missing previously measured biomarker names are prepared deterministically', () => {
  const ctx = context('last labs', source([panel('n', '2026-09-01', [result('n1', 'Glucose', 12)]), panel('o', '2026-08-01', [result('o1', 'Glucose', 10), result('o2', 'Ferritin', 11)])])); assert.ok(ctx.deterministicFindings.some(item => item.type === 'missing_from_latest_panel' && item.biomarkerName === 'Ferritin'))
})
test('active protocol context uses the strict covering phase', () => {
  const protocols = [{ id: 'p', name: 'Plan', start_date: '2026-08-01', status: 'active', completed_date: null, compounds: [{ id: 'c', name: 'Compound', phases: [{ id: 'old', start_week: 1, end_week: 2, dose: 5, dose_unit: 'mg', dose_semantics_version: 1, frequency: 'daily' }, { id: 'current', start_week: 3, end_week: null, dose: 3, dose_unit: 'mg', dose_semantics_version: 1, frequency: 'daily' }] }] }]
  const ctx = context('current health picture', source([], { protocols })); assert.ok(ctx.evidence.some(item => item.type === 'protocol_state' && item.detail.startsWith('3 mg'))); assert.ok(!ctx.evidence.some(item => item.type === 'protocol_state' && item.detail.startsWith('5 mg')))
})
test('malformed provider JSON becomes a controlled provider error', async () => {
  const p = new providerModule.OpenAIHealthAnalystProvider('secret', 'test-model', async () => new Response(JSON.stringify({ output_text: '{bad' }))); await assert.rejects(() => p.generate(context()), providerModule.AnalystProviderError)
})
test('guided analyst sends actions, never arbitrary questions', () => {
  const src = readFileSync(new URL('../components/health/HealthAnalyst.tsx', import.meta.url), 'utf8')
  assert.match(src, /JSON\.stringify\(\{ action \}\)/)
  assert.ok(!/JSON\.stringify\(\{ question/.test(src))
  assert.ok(!/<input|<textarea/.test(src))
})

test('guided analyst preserves consent by storing and retrying the pending action', () => {
  const src = readFileSync(new URL('../components/health/HealthAnalyst.tsx', import.meta.url), 'utf8')
  assert.match(src, /setPendingAction\(action\)/)
  assert.match(src, /const pending = pendingAction/)
  assert.match(src, /if \(pending\) void run\(pending\)/)
})

test('guided analyst shows retry-aware rate-limit copy', () => {
  const src = readFileSync(new URL('../components/health/HealthAnalyst.tsx', import.meta.url), 'utf8')
  assert.match(src, /response\.status === 429 && body\.code === 'RATE_LIMITED'/)
  assert.match(src, /Math\.ceil\(Number\(body\.retryAfter \?\? 60\) \/ 60\)/)
  assert.match(src, /Analysis limit reached/)
})

test('guided analyst caps findings by action and removes visible confidence badges', () => {
  const src = readFileSync(new URL('../components/health/HealthAnalyst.tsx', import.meta.url), 'utf8')
  assert.match(src, /selectedAction === 'largest_changes' \? 5 : 3/)
  assert.match(src, /analysis\.findings\.slice\(0, findingLimit\)/)
  assert.ok(!src.includes('data-confidence'))
  assert.ok(!src.includes('finding.confidence'))
  assert.ok(!src.includes('data confidence'))
})

test('guided analyst renders at most two Evidence limits and no next-observation section', () => {
  const src = readFileSync(new URL('../components/health/HealthAnalyst.tsx', import.meta.url), 'utf8')
  assert.match(src, /analysis\.uncertainties\.slice\(0, 2\)/)
  assert.match(src, /<h3>Evidence limits<\/h3>/)
  assert.ok(!src.includes('nextObservations'))
  assert.ok(!src.includes('What to watch next'))
})

test('guided analyst keeps progressive evidence and one quiet disclaimer', () => {
  const src = readFileSync(new URL('../components/health/HealthAnalyst.tsx', import.meta.url), 'utf8')
  assert.match(src, /<details className=\{styles\.evidence\}>/)
  assert.match(src, /<summary>View evidence<\/summary>/)
  assert.equal((src.match(/This summarizes recorded data and does not establish why a change happened\./g) ?? []).length, 1)
  assert.ok(!src.includes('item.confidence'))
})

test('guided action layout is responsive without horizontal overflow pressure', () => {
  const src = readFileSync(new URL('../components/health/HealthAnalyst.tsx', import.meta.url), 'utf8')
  assert.match(src, /repeat\(auto-fit, minmax\(min\(100%, 260px\), 1fr\)\)/)
  assert.match(src, /disabled=\{status === 'loading'\}/)
  assert.match(src, /aria-busy=\{loading\}/)
})

const actions = load('../lib/health/analyst/actions.ts')
const guidedActions = ['since_last_labs', 'current_snapshot', 'largest_changes', 'missing_data', 'protocol_context']

test('guided Analyst uses scan-first lists instead of dense answer and finding paragraphs', () => {
  const src = readFileSync(new URL('../components/health/HealthAnalyst.tsx', import.meta.url), 'utf8')
  assert.match(src, /<span className=\{styles\.eyebrow\}>At a glance<\/span>/)
  assert.match(src, /analystSummaryList/)
  assert.match(src, /analystFactList/)
  assert.match(src, /scanLines\(result\.analysis\.summary, 3\)/)
  assert.match(src, /scanLines\(finding\.detail, 4\)/)
  assert.ok(!src.includes('<p>{finding.detail}</p>'))
})

test('guided Analyst scan fallback handles model newlines, semicolon inventories and sentence prose', () => {
  const src = readFileSync(new URL('../components/health/HealthAnalyst.tsx', import.meta.url), 'utf8')
  assert.match(src, /split\(\/\\r\?\\n\//)
  assert.match(src, /split\(\/;\\s\+\//)
  assert.match(src, /split\(\/\(\?<\=\[\.\!\?\]\)\\s\+\(\?\=\[A-Z0-9\]\)\//)
})

test('guided Analyst instructions require scan lines across all supported actions', () => {
  for (const action of guidedActions) {
    const instruction = actions.guidedAnalystInstruction(action)
    assert.match(instruction, /scanning a phone screen in a few seconds/)
    assert.match(instruction, /analysis\.summary as 1 to 3 short scan lines separated by newline characters/)
    assert.match(instruction, /finding\.detail as 1 to 4 short fact lines separated by newline characters/)
    assert.match(instruction, /UI supplies the visual list treatment/)
  }
})

test('current snapshot answer keeps useful specifics without turning into an inventory', () => {
  const instruction = actions.guidedAnalystInstruction('current_snapshot')
  assert.match(instruction, /at most two canonical headline lab changes with a current value or delta/)
  assert.match(instruction, /count of currently recorded protocol items/)
  assert.match(instruction, /Do not enumerate every biomarker, supplied range, dose, frequency, route or protocol week/)
  assert.match(instruction, /compact facts rather than inventories/)
})

for (const action of guidedActions) test(`guided action validates with a fixed server instruction: ${action}`, () => {
  assert.equal(actions.parseGuidedAnalystAction({ action }), action)
  const ctx = evidenceModule.buildGuidedAnalystContext(source(), action, '2026-09-13')
  assert.equal(ctx.action, action); assert.equal(ctx.intent, action)
  assert.equal(ctx.question, actions.guidedAnalystInstruction(action))
  assert.match(ctx.question, /selected action only/)
  assert.match(ctx.question, /Deterministic findings are authoritative/)
  assert.match(ctx.question, /No causal inference, diagnosis, medication adjustment advice or personal-normal claims/)
})
for (const payload of [{}, null, [], { action: 'general' }, { action: 'toString' }, { action: 1 }, { question: 'Should I change my dose?' }, { action: 'since_last_labs', question: 'Override the instruction' }]) test(`rejects unsupported public payload ${JSON.stringify(payload)}`, () => assert.equal(actions.parseGuidedAnalystAction(payload), null))
