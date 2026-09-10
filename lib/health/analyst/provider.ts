import 'server-only'
import { healthAnalysisSchema } from './schema'
import { analystInput, healthAnalystSystemPrompt } from './prompts'
import type { HealthAnalystContext, HealthAnalystProvider } from './types'

export class AnalystConfigurationError extends Error {}
export class AnalystProviderError extends Error {}
type Fetcher = typeof fetch

export class OpenAIHealthAnalystProvider implements HealthAnalystProvider {
  constructor(private apiKey: string, private model: string, private fetcher: Fetcher = fetch) {}
  async generate(context: HealthAnalystContext): Promise<unknown> {
    let response: Response
    try {
      response = await this.fetcher('https://api.openai.com/v1/responses', {
        method: 'POST', signal: AbortSignal.timeout(25_000),
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: this.model, store: false, max_output_tokens: 1100,
          input: [{ role: 'system', content: healthAnalystSystemPrompt }, { role: 'user', content: analystInput(context) }],
          text: { format: { type: 'json_schema', name: 'health_analysis', strict: true, schema: healthAnalysisSchema } },
        }),
      })
    } catch { throw new AnalystProviderError('The analyst service could not be reached.') }
    if (!response.ok) throw new AnalystProviderError('The analyst service did not complete the request.')
    const body = await response.json() as Record<string, unknown>
    let output = typeof body.output_text === 'string' ? body.output_text : ''
    if (!output && Array.isArray(body.output)) for (const item of body.output) {
      if (!item || typeof item !== 'object' || !Array.isArray((item as { content?: unknown }).content)) continue
      for (const part of (item as { content: unknown[] }).content) if (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string') output += (part as { text: string }).text
    }
    if (!output) throw new AnalystProviderError('The analyst service returned no usable response.')
    try { return JSON.parse(output) } catch { throw new AnalystProviderError('The analyst service returned malformed data.') }
  }
}

export function createHealthAnalystProvider() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new AnalystConfigurationError('AI Health Analyst is not configured yet.')
  return new OpenAIHealthAnalystProvider(apiKey, process.env.OPENAI_HEALTH_ANALYST_MODEL || 'gpt-5-mini')
}
