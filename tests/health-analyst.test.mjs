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
])) => evidenceModule.buildAnalystContext(data, question, '2026-09-10')
const valid = (ctx = context()) => ({ summary: 'Recorded values changed between panels.', findings: [{ title: 'Largest recorded change', detail: 'Glucose moved up across two same-unit readings.', evidenceIds: [ctx.evidence[0].id], confidence: 'high' }], uncertainties: [], nextObservations: [] })

test('classifies last-labs intent', () => assert.equal(evidenceModule.classifyAnalystIntent('What changed since my last labs?'), 'since_last_labs'))
test('classifies current snapshot intent', () => assert.equal(evidenceModule.classifyAnalystIntent('Summarize my current health picture'), 'current_snapshot'))
test('classifies protocol context intent', () => assert.equal(evidenceModule.classifyAnalystIntent('Show protocol changes around labs'), 'protocol_context'))
test('classifies largest change intent', () => assert.equal(evidenceModule.classifyAnalystIntent('Which biomarkers changed the most?'), 'largest_changes'))
test('classifies missing-data intent', () => assert.equal(evidenceModule.classifyAnalystIntent('What information is missing?'), 'missing_data'))
test('same-unit readings produce deterministic comparison evidence', () => assert.ok(context().evidence.some(item => item.type === 'lab_comparison' && item.detail.includes('+20.0%'))))
test('comparison records elapsed days', () => assert.ok(context().evidence.some(item => item.detail.includes('31 days apart'))))
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
test('analyst UI offers all five evidence-based starting points', () => { const src = readFileSync(new URL('../components/health/HealthAnalyst.tsx', import.meta.url), 'utf8'); for (const prompt of ['last labs', 'current health picture', 'protocol changes', 'biomarkers changed', 'information is missing']) assert.ok(src.toLowerCase().includes(prompt)) })
test('newly measured biomarker names are prepared deterministically', () => {
  const ctx = context('last labs', source([panel('n', '2026-09-01', [result('n1', 'Glucose', 12), result('n2', 'Ferritin', 11)]), panel('o', '2026-08-01', [result('o1', 'Glucose', 10)])])); assert.ok(ctx.facts.some(item => /newly measured.*Ferritin/.test(item.text)))
})
test('missing previously measured biomarker names are prepared deterministically', () => {
  const ctx = context('last labs', source([panel('n', '2026-09-01', [result('n1', 'Glucose', 12)]), panel('o', '2026-08-01', [result('o1', 'Glucose', 10), result('o2', 'Ferritin', 11)])])); assert.ok(ctx.facts.some(item => /absent.*Ferritin/.test(item.text)))
})
test('active protocol context uses the strict covering phase', () => {
  const protocols = [{ id: 'p', name: 'Plan', start_date: '2026-08-01', status: 'active', completed_date: null, compounds: [{ id: 'c', name: 'Compound', phases: [{ id: 'old', start_week: 1, end_week: 2, dose: 5, dose_unit: 'mg', dose_semantics_version: 1, frequency: 'daily' }, { id: 'current', start_week: 3, end_week: null, dose: 3, dose_unit: 'mg', dose_semantics_version: 1, frequency: 'daily' }] }] }]
  const ctx = context('current health picture', source([], { protocols })); assert.ok(ctx.evidence.some(item => item.type === 'protocol_state' && item.detail.startsWith('3 mg'))); assert.ok(!ctx.evidence.some(item => item.type === 'protocol_state' && item.detail.startsWith('5 mg')))
})
test('malformed provider JSON becomes a controlled provider error', async () => {
  const p = new providerModule.OpenAIHealthAnalystProvider('secret', 'test-model', async () => new Response(JSON.stringify({ output_text: '{bad' }))); await assert.rejects(() => p.generate(context()), providerModule.AnalystProviderError)
})
test('analyst introduces no redundant health input fields', () => { const src = readFileSync(new URL('../components/health/HealthAnalyst.tsx', import.meta.url), 'utf8'); assert.equal((src.match(/<input/g) ?? []).length, 1); assert.ok(!/<textarea|<select/.test(src)) })
