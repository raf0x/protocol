import 'server-only'
import { healthAnalysisSchema } from './schema'
import { analystInput, healthAnalystSystemPrompt } from './prompts'
import type { HealthAnalystContext, HealthAnalystProvider } from './types'

export const OPENAI_RESPONSES_ENDPOINT = 'https://api.openai.com/v1/responses'
export const DEFAULT_HEALTH_ANALYST_MODEL = 'gpt-5.6-terra'
export const HEALTH_ANALYST_TIMEOUT_MS = 45_000
export const HEALTH_ANALYST_MAX_OUTPUT_TOKENS = 4_000

export class AnalystConfigurationError extends Error {
  constructor() { super('AI Health Analyst is not configured.'); this.name = 'AnalystConfigurationError' }
}

export type ProviderFailureKind = 'authentication' | 'quota' | 'rate_limit' | 'model_access' | 'invalid_request'
  | 'schema_rejection' | 'timeout' | 'network' | 'provider_outage' | 'provider_rejection'
  | 'incomplete' | 'refusal' | 'empty' | 'malformed'
export type ProviderResponseState = 'failed' | 'incomplete' | 'refusal' | 'empty' | 'malformed'

export type AnalystProviderDiagnostic = {
  providerStatus: number | null
  providerCode: string | null
  providerType: string | null
  model: string
  endpoint: 'responses'
  providerRequestId: string | null
  failureKind: ProviderFailureKind
  responseState: ProviderResponseState
}

export class AnalystProviderError extends Error {
  constructor(readonly diagnostic: AnalystProviderDiagnostic) {
    super('The AI provider could not complete the request.')
    this.name = 'AnalystProviderError'
  }
}

type Fetcher = typeof fetch
type JsonRecord = Record<string, unknown>
type Environment = Record<string, string | undefined>
type StructuredRequest = {
  apiKey: string
  model: string
  input: { role: 'system' | 'user'; content: string }[]
  schema: JsonRecord
  schemaName: string
  maxOutputTokens: number
  timeoutMs: number
  fetcher: Fetcher
  reasoningEffort?: 'none'
}

const record = (value: unknown): JsonRecord | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : null
const safeField = (value: unknown, max = 48) => typeof value === 'string'
  ? value.replace(/[^a-zA-Z0-9_.:/-]/g, '').slice(0, max) || null
  : null

function requestId(response: Response) {
  return safeField(response.headers.get('x-request-id') || response.headers.get('openai-request-id'), 64)
}

function errorFields(body: unknown) {
  const error = record(record(body)?.error)
  return { code: safeField(error?.code), type: safeField(error?.type), param: safeField(error?.param) }
}

function classifyProviderFailure(status: number, code: string | null, type: string | null, param: string | null): ProviderFailureKind {
  const marker = `${code ?? ''}:${type ?? ''}:${param ?? ''}`.toLowerCase()
  if (status === 401 || marker.includes('invalid_api_key')) return 'authentication'
  if (marker.includes('insufficient_quota') || marker.includes('billing')) return 'quota'
  if (status === 429) return 'rate_limit'
  if (status === 403 || status === 404 || marker.includes('model_not_found') || marker.includes(':model')) return 'model_access'
  if (marker.includes('json_schema') || marker.includes('schema')) return 'schema_rejection'
  if (status === 400 || marker.includes('invalid_request')) return 'invalid_request'
  if (status >= 500) return 'provider_outage'
  return 'provider_rejection'
}

function failure(model: string, failureKind: ProviderFailureKind, responseState: ProviderResponseState, options: {
  status?: number | null; code?: string | null; type?: string | null; requestId?: string | null
} = {}) {
  return new AnalystProviderError({ providerStatus: options.status ?? null, providerCode: options.code ?? null,
    providerType: options.type ?? null, model: safeField(model, 40) ?? 'unknown', endpoint: 'responses',
    providerRequestId: options.requestId ?? null, failureKind, responseState })
}

function responseText(body: JsonRecord) {
  if (typeof body.output_text === 'string') return { text: body.output_text, refused: false }
  let text = '', refused = false
  if (Array.isArray(body.output)) for (const item of body.output) {
    const content = record(item)?.content
    if (!Array.isArray(content)) continue
    for (const part of content) {
      const value = record(part)
      if (!value) continue
      if (value.type === 'refusal' || typeof value.refusal === 'string') refused = true
      if ((value.type === 'output_text' || value.type === undefined) && typeof value.text === 'string') text += value.text
    }
  }
  return { text, refused }
}

async function requestStructuredOutput(options: StructuredRequest): Promise<unknown> {
  let response: Response
  try {
    const body: JsonRecord = { model: options.model, store: false, max_output_tokens: options.maxOutputTokens,
      input: options.input, text: { format: { type: 'json_schema', name: options.schemaName, strict: true, schema: options.schema } },
    }
    if (options.reasoningEffort) body.reasoning = { effort: options.reasoningEffort }
    response = await options.fetcher(OPENAI_RESPONSES_ENDPOINT, {
      method: 'POST', signal: AbortSignal.timeout(options.timeoutMs),
      headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')
    throw failure(options.model, timeout ? 'timeout' : 'network', 'failed')
  }

  let body: unknown = null
  try { body = await response.json() } catch {
    if (!response.ok) throw failure(options.model, classifyProviderFailure(response.status, null, null, null), 'failed', {
      status: response.status, requestId: requestId(response),
    })
    throw failure(options.model, 'malformed', 'malformed', { status: response.status, requestId: requestId(response) })
  }
  if (!response.ok) {
    const fields = errorFields(body)
    throw failure(options.model, classifyProviderFailure(response.status, fields.code, fields.type, fields.param), 'failed', {
      status: response.status, code: fields.code, type: fields.type, requestId: requestId(response),
    })
  }

  const envelope = record(body)
  if (!envelope) throw failure(options.model, 'malformed', 'malformed', { status: response.status, requestId: requestId(response) })
  const state = safeField(envelope.status, 24)
  const fields = errorFields(envelope)
  if (state === 'failed' || envelope.error) throw failure(options.model, 'provider_rejection', 'failed', {
    status: response.status, code: fields.code, type: fields.type, requestId: requestId(response),
  })
  if (state === 'incomplete' || state === 'queued' || state === 'in_progress') {
    throw failure(options.model, 'incomplete', 'incomplete', { status: response.status, requestId: requestId(response) })
  }
  const output = responseText(envelope)
  if (output.refused) throw failure(options.model, 'refusal', 'refusal', { status: response.status, requestId: requestId(response) })
  if (!output.text.trim()) throw failure(options.model, 'empty', 'empty', { status: response.status, requestId: requestId(response) })
  try { return JSON.parse(output.text) } catch {
    throw failure(options.model, 'malformed', 'malformed', { status: response.status, requestId: requestId(response) })
  }
}

export function resolveHealthAnalystConfig(environment: Environment = process.env) {
  return { apiKey: environment.OPENAI_API_KEY?.trim() || null,
    model: environment.OPENAI_HEALTH_ANALYST_MODEL?.trim() || DEFAULT_HEALTH_ANALYST_MODEL }
}

export class OpenAIHealthAnalystProvider implements HealthAnalystProvider {
  constructor(private apiKey: string, private model: string, private fetcher: Fetcher = fetch) {}
  async generate(context: HealthAnalystContext): Promise<unknown> {
    return requestStructuredOutput({ apiKey: this.apiKey, model: this.model, fetcher: this.fetcher,
      timeoutMs: HEALTH_ANALYST_TIMEOUT_MS, maxOutputTokens: HEALTH_ANALYST_MAX_OUTPUT_TOKENS,
      input: [{ role: 'system', content: healthAnalystSystemPrompt }, { role: 'user', content: analystInput(context) }],
      schema: healthAnalysisSchema as unknown as JsonRecord, schemaName: 'health_analysis' })
  }
}

export function createHealthAnalystProvider(environment: Environment = process.env) {
  const { apiKey, model } = resolveHealthAnalystConfig(environment)
  if (!apiKey) throw new AnalystConfigurationError()
  return new OpenAIHealthAnalystProvider(apiKey, model)
}

export type ProviderHealthCheck = { configured: boolean; reachable: boolean; modelAccepted: boolean; structuredOutputAccepted: boolean }

export async function checkHealthAnalystProvider(options: {
  environment?: Environment
  fetcher?: Fetcher
  onError?: (error: unknown) => void | Promise<void>
} = {}): Promise<ProviderHealthCheck> {
  const { apiKey, model } = resolveHealthAnalystConfig(options.environment)
  if (!apiKey) return { configured: false, reachable: false, modelAccepted: false, structuredOutputAccepted: false }
  try {
    const output = record(await requestStructuredOutput({ apiKey, model, fetcher: options.fetcher ?? fetch,
      timeoutMs: HEALTH_ANALYST_TIMEOUT_MS, maxOutputTokens: 256, reasoningEffort: 'none', schemaName: 'service_check',
      input: [{ role: 'system', content: 'Return the requested service-check JSON.' }, { role: 'user', content: 'Set ok to true.' }],
      schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'], additionalProperties: false },
    }))
    return { configured: true, reachable: true, modelAccepted: true, structuredOutputAccepted: typeof output?.ok === 'boolean' }
  } catch (error) {
    await options.onError?.(error)
    const diagnostic = error instanceof AnalystProviderError ? error.diagnostic : null
    const reachable = Boolean(diagnostic && diagnostic.failureKind !== 'network' && diagnostic.failureKind !== 'timeout')
    const modelRejected = !diagnostic || ['authentication', 'quota', 'rate_limit', 'model_access', 'invalid_request', 'provider_outage', 'network', 'timeout']
      .includes(diagnostic.failureKind)
    return { configured: true, reachable, modelAccepted: reachable && !modelRejected, structuredOutputAccepted: false }
  }
}

export function providerOperationalDiagnostic(error: unknown) {
  if (error instanceof AnalystConfigurationError) return { errorType: 'AI:configuration', status: 503 }
  if (!(error instanceof AnalystProviderError)) return { errorType: error instanceof Error ? error.name : 'UnknownError', status: 502 }
  const detail = error.diagnostic
  const token = (value: string | null, max: number, fallback: string) => safeField(value, max) ?? fallback
  const code = token(detail.providerCode, 10, 'none')
  const type = token(detail.providerType, 10, 'none')
  const providerId = detail.providerRequestId ? token(detail.providerRequestId.slice(-8), 8, 'none') : 'none'
  const errorType = `AI:resp:${token(detail.failureKind, 12, 'provider')}:${token(detail.responseState, 7, 'failed')}:${token(detail.model, 15, 'unknown')}:${code}:${type}:${providerId}`.slice(0, 80)
  return { errorType, status: detail.providerStatus ?? 502 }
}
