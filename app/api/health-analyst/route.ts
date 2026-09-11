export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { consentRequiredResponse, hasCurrentAiConsent } from '../../../lib/aiConsent'
import { checkDurableRateLimit, rateLimitHeaders } from '../../../lib/durableRateLimit'
import { loadHealthAnalystContext } from '../../../lib/health/analyst/context'
import { analyzeHealthContext } from '../../../lib/health/analyst/service'
import { AnalystConfigurationError, AnalystProviderError } from '../../../lib/health/analyst/provider'
import { AnalystOutputError } from '../../../lib/health/analyst/schema'
import { captureOperationalError } from '../../../lib/monitoring'
import { createAuthenticatedServerClient } from '../../../lib/serverSupabase'

export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') || 0) > 12_000) return NextResponse.json({ error: 'The question is too large.' }, { status: 413 })
  const supabase = await createAuthenticatedServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to use the health analyst.' }, { status: 401 })
  let question = ''
  try {
    const body = await request.json() as { question?: unknown }
    question = typeof body.question === 'string' ? body.question.trim() : ''
  } catch { return NextResponse.json({ error: 'Enter a question to analyze.' }, { status: 400 }) }
  if (question.length < 3 || question.length > 500) return NextResponse.json({ error: 'Enter a question between 3 and 500 characters.' }, { status: 400 })
  if (!await hasCurrentAiConsent(supabase, user.id)) return NextResponse.json(consentRequiredResponse(), { status: 403 })
  const limit = await checkDurableRateLimit(supabase, user.id, 'health-analyst')
  if (!limit.allowed) {
    const unavailable = !limit.available && process.env.NODE_ENV === 'production'
    return NextResponse.json({
      code: unavailable ? 'RATE_LIMIT_UNAVAILABLE' : 'RATE_LIMITED',
      error: unavailable ? 'Analysis is temporarily unavailable. No health data was sent.' : 'Please wait before asking again.',
      retryAfter: limit.retryAfter,
    }, { status: unavailable ? 503 : 429, headers: rateLimitHeaders(limit) })
  }
  try {
    const context = await loadHealthAnalystContext(supabase, user.id, question, new Date().toISOString().slice(0, 10))
    const result = await analyzeHealthContext(context)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    const status = error instanceof AnalystConfigurationError ? 503 : error instanceof AnalystProviderError || error instanceof AnalystOutputError ? 502 : 500
    await captureOperationalError({ route: '/api/health-analyst', error, source: 'ai', status })
    if (error instanceof AnalystConfigurationError) return NextResponse.json({ error: 'The analyst is temporarily unavailable.' }, { status })
    if (error instanceof AnalystProviderError || error instanceof AnalystOutputError) return NextResponse.json({ error: 'The analyst could not produce a reliable answer. Please try again.' }, { status })
    return NextResponse.json({ error: 'The analyst is temporarily unavailable.' }, { status })
  }
}
