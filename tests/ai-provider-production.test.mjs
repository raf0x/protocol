import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import ts from 'typescript'

const require = createRequire(import.meta.url), cache = new Map()
const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
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

const providerModule = load('../lib/health/analyst/provider.ts')
const providerSource = read('../lib/health/analyst/provider.ts')
const schemaSource = read('../lib/health/analyst/schema.ts')
const monitoringSource = read('../lib/health/analyst/monitoring.ts')
const analystRoute = read('../app/api/health-analyst/route.ts')
const reportRoute = read('../app/api/health-report/route.ts')
const reportService = read('../lib/health/report/service.ts')
const healthRoute = read('../app/api/health-analyst/health/route.ts')
const apiError = (status, error, headers = {}) => new Response(JSON.stringify({ error }), { status, headers })
const success = body => new Response(JSON.stringify(body), { status: 200, headers: { 'x-request-id': 'req_success_123' } })
const context = { intent: 'current_snapshot', question: 'Private question 123', asOfDate: '2026-09-11', scope: 'Current recorded health data', facts: [],
  evidence: [{ id: 'E1', type: 'lab_result', date: '2026-09-10', title: 'Private biomarker', detail: 'Secret value 456', confidence: 'high', sourceLabel: 'Lab' }], gaps: [] }
const analysis = { summary: 'Recorded information is available.', findings: [{ title: 'Recorded finding', detail: 'A recorded value is present.', evidenceIds: ['E1'], confidence: 'high' }], uncertainties: [], nextObservations: [] }
const make = fetcher => new providerModule.OpenAIHealthAnalystProvider('sk-test-secret', 'gpt-5.6-terra', fetcher)
async function failureKind(fetcher) {
  try { await make(fetcher).generate(context); assert.fail('Expected provider failure') }
  catch (error) { assert.ok(error instanceof providerModule.AnalystProviderError); return error }
}

test('default production analyst model is gpt-5.6-terra', () => {
  assert.equal(providerModule.DEFAULT_HEALTH_ANALYST_MODEL, 'gpt-5.6-terra')
  assert.equal(providerModule.resolveHealthAnalystConfig({ OPENAI_API_KEY: 'key' }).model, 'gpt-5.6-terra')
})

test('OPENAI_HEALTH_ANALYST_MODEL remains authoritative', () => {
  assert.equal(providerModule.resolveHealthAnalystConfig({ OPENAI_API_KEY: 'key', OPENAI_HEALTH_ANALYST_MODEL: 'custom-model' }).model, 'custom-model')
})

test('API key and model configuration stay server-only', () => {
  assert.match(providerSource, /process\.env/)
  assert.doesNotMatch(providerSource, /NEXT_PUBLIC_OPENAI|console\.(?:log|error|warn)/)
})

test('provider sends the supported Responses structured-output payload', async () => {
  let url, request
  await make(async (value, init) => { url = value; request = { ...init, body: JSON.parse(init.body) }; return success({ status: 'completed', output_text: JSON.stringify(analysis) }) }).generate(context)
  assert.equal(url, 'https://api.openai.com/v1/responses')
  assert.equal(request.body.model, 'gpt-5.6-terra')
  assert.equal(request.body.store, false)
  assert.equal(request.body.max_output_tokens, 4000)
  assert.equal(request.body.text.format.type, 'json_schema')
  assert.equal(request.body.text.format.strict, true)
})

test('provider timeout is bounded at 45 seconds', () => assert.equal(providerModule.HEALTH_ANALYST_TIMEOUT_MS, 45_000))

test('provider schema excludes unsupported strict-output keywords', () => {
  const strictSchemaSource = schemaSource.slice(0, schemaSource.indexOf('export class AnalystOutputError'))
  for (const keyword of ['minLength', 'maxLength', 'uniqueItems']) assert.doesNotMatch(strictSchemaSource, new RegExp(keyword))
  assert.match(strictSchemaSource, /additionalProperties: false/)
  assert.match(strictSchemaSource, /required: \['summary', 'findings', 'uncertainties', 'nextObservations'\]/)
})

test('successful output_text structured response is parsed', async () => {
  assert.deepEqual(await make(async () => success({ status: 'completed', output_text: JSON.stringify(analysis) })).generate(context), analysis)
})

test('nested Responses output content is parsed as a fallback', async () => {
  const body = { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(analysis) }] }] }
  assert.deepEqual(await make(async () => success(body)).generate(context), analysis)
})

test('provider 401 is classified as authentication without raw message', async () => {
  const error = await failureKind(async () => apiError(401, { type: 'invalid_request_error', code: 'invalid_api_key', message: 'raw secret' }))
  assert.equal(error.diagnostic.failureKind, 'authentication'); assert.equal(error.diagnostic.providerStatus, 401)
  assert.doesNotMatch(JSON.stringify(error), /raw secret/)
})

test('provider 429 is classified as rate limiting', async () => {
  const error = await failureKind(async () => apiError(429, { type: 'rate_limit_error', code: 'rate_limit_exceeded' }))
  assert.equal(error.diagnostic.failureKind, 'rate_limit')
})

test('insufficient quota is distinct from request rate limiting', async () => {
  const error = await failureKind(async () => apiError(429, { type: 'insufficient_quota', code: 'insufficient_quota' }))
  assert.equal(error.diagnostic.failureKind, 'quota')
})

test('unsupported or inaccessible model is classified safely', async () => {
  const error = await failureKind(async () => apiError(404, { type: 'invalid_request_error', code: 'model_not_found', param: 'model' }))
  assert.equal(error.diagnostic.failureKind, 'model_access')
})

test('invalid strict schema request is classified safely', async () => {
  const error = await failureKind(async () => apiError(400, { type: 'invalid_request_error', code: 'invalid_json_schema', param: 'text.format.schema' }))
  assert.equal(error.diagnostic.failureKind, 'schema_rejection')
})

test('timeout is distinct from other network failure', async () => {
  const timeout = await failureKind(async () => { const error = new Error('private timeout'); error.name = 'TimeoutError'; throw error })
  const network = await failureKind(async () => { throw new Error('private network') })
  assert.equal(timeout.diagnostic.failureKind, 'timeout'); assert.equal(network.diagnostic.failureKind, 'network')
})

test('empty output is a controlled classified failure', async () => {
  const error = await failureKind(async () => success({ status: 'completed', output: [] }))
  assert.equal(error.diagnostic.failureKind, 'empty')
})

test('malformed model JSON is a controlled classified failure', async () => {
  const error = await failureKind(async () => success({ status: 'completed', output_text: '{bad' }))
  assert.equal(error.diagnostic.failureKind, 'malformed')
})

test('incomplete response is never treated as completed output', async () => {
  const error = await failureKind(async () => success({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }))
  assert.equal(error.diagnostic.failureKind, 'incomplete'); assert.equal(error.diagnostic.responseState, 'incomplete')
})

test('refusal response is detected without retaining refusal text', async () => {
  const error = await failureKind(async () => success({ status: 'completed', output: [{ content: [{ type: 'refusal', refusal: 'private refusal text' }] }] }))
  assert.equal(error.diagnostic.failureKind, 'refusal'); assert.doesNotMatch(JSON.stringify(error), /private refusal text/)
})

test('failed response state is classified without exposing the response body', async () => {
  const error = await failureKind(async () => success({ status: 'failed', error: { code: 'provider_error', message: 'Private biomarker 456' } }))
  assert.equal(error.diagnostic.responseState, 'failed'); assert.doesNotMatch(JSON.stringify(error), /Private biomarker|456/)
})

test('operational diagnostic contains only bounded provider classification', async () => {
  const error = await failureKind(async () => apiError(400, { type: 'invalid_request_error', code: 'invalid_json_schema', message: `${context.question} ${context.evidence[0].detail} sk-test-secret` }, { 'x-request-id': 'req_1234567890' }))
  const diagnostic = providerModule.providerOperationalDiagnostic(error)
  assert.ok(diagnostic.errorType.length <= 80)
  assert.equal(diagnostic.status, 400)
  assert.match(diagnostic.errorType, /invalid_js:invalid_re/)
  assert.doesNotMatch(JSON.stringify(diagnostic), /Private question|Secret value|sk-test-secret|biomarker/i)
})

test('health check distinguishes accepted model from rejected structured schema', async () => {
  const result = await providerModule.checkHealthAnalystProvider({ environment: { OPENAI_API_KEY: 'key' },
    fetcher: async () => apiError(400, { type: 'invalid_request_error', code: 'invalid_json_schema', param: 'text.format.schema' }) })
  assert.deepEqual(result, { configured: true, reachable: true, modelAccepted: true, structuredOutputAccepted: false })
})

test('monitoring adapter accepts only the classified error, route, status, and source', () => {
  assert.match(monitoringSource, /providerOperationalDiagnostic\(error\)/)
  assert.doesNotMatch(monitoringSource, /context|question|evidence|prompt|responseBody|apiKey/)
})

test('user-facing analyst and report errors remain generic', () => {
  assert.match(analystRoute, /could not produce a reliable answer/)
  assert.match(reportRoute, /report could not be generated/)
  assert.doesNotMatch(`${analystRoute}\n${reportRoute}`, /error\.message|diagnostic\.provider|providerCode|providerType/)
})

test('consent and durable limiter remain before health context/provider work', () => {
  assert.ok(analystRoute.indexOf('hasCurrentAiConsent') < analystRoute.indexOf('checkDurableRateLimit'))
  assert.ok(analystRoute.indexOf('checkDurableRateLimit') < analystRoute.indexOf('loadHealthAnalystContext'))
})

test('Doctor Report retains deterministic fallback and now reports classified AI failure', () => {
  assert.match(reportService, /deterministic report is complete/)
  assert.match(reportService, /await onAiError\?\.\(error\)/)
  assert.match(reportRoute, /captureAnalystOperationalError\('\/api\/health-report'/)
})

test('safe provider health check sends synthetic data only and returns booleans', async () => {
  let request
  const result = await providerModule.checkHealthAnalystProvider({ environment: { OPENAI_API_KEY: 'key', OPENAI_HEALTH_ANALYST_MODEL: 'gpt-5.6-terra' },
    fetcher: async (_url, init) => { request = JSON.parse(init.body); return success({ status: 'completed', output_text: '{"ok":true}' }) } })
  assert.deepEqual(result, { configured: true, reachable: true, modelAccepted: true, structuredOutputAccepted: true })
  const payload = JSON.stringify(request)
  for (const sensitive of ['question', 'evidence', 'biomarker', 'protocol', 'journal', 'dose']) assert.doesNotMatch(payload, new RegExp(sensitive, 'i'))
})

test('provider health endpoint is authenticated, same-origin, and durably rate limited', () => {
  assert.match(healthRoute, /isSameOriginRequest/)
  assert.match(healthRoute, /auth\.getUser\(\)/)
  assert.match(healthRoute, /checkDurableRateLimit\(supabase, user\.id, 'health-analyst'\)/)
  assert.doesNotMatch(healthRoute, /request\.json|health context|question|evidence/i)
})
