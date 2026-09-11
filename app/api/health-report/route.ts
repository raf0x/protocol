export const runtime = 'nodejs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { consentRequiredResponse, hasCurrentAiConsent } from '../../../lib/aiConsent'
import { checkDurableRateLimit, rateLimitHeaders } from '../../../lib/durableRateLimit'
import { createDoctorReport } from '../../../lib/health/report/service'
import type { ReportRange } from '../../../lib/health/report/types'
import { captureOperationalError } from '../../../lib/monitoring'
import { createAuthenticatedServerClient } from '../../../lib/serverSupabase'

const ranges = new Set<ReportRange>(['3m', '6m', '12m', 'all'])
export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') || 0) > 2_000) return NextResponse.json({ error: 'The report request is too large.' }, { status: 413 })
  const supabase = await createAuthenticatedServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to create a health report.' }, { status: 401 })
  let range: ReportRange = '6m', includeAi = true
  try {
    const body = await request.json() as { range?: unknown; includeAi?: unknown }
    if (typeof body.range !== 'string' || !ranges.has(body.range as ReportRange) || typeof body.includeAi !== 'boolean') throw new Error()
    range = body.range as ReportRange; includeAi = body.includeAi
  } catch { return NextResponse.json({ error: 'Choose a valid report range and try again.' }, { status: 400 }) }
  if (includeAi && !await hasCurrentAiConsent(supabase, user.id)) return NextResponse.json(consentRequiredResponse(), { status: 403 })
  const limit = await checkDurableRateLimit(supabase, user.id, includeAi ? 'health-report-ai' : 'health-report-deterministic')
  if (!limit.allowed) {
    const unavailable = !limit.available && process.env.NODE_ENV === 'production'
    return NextResponse.json({
      code: unavailable ? 'RATE_LIMIT_UNAVAILABLE' : 'RATE_LIMITED',
      error: unavailable ? 'Reports are temporarily unavailable. Your health data was not changed.' : 'Please wait before generating another report.',
      retryAfter: limit.retryAfter,
    }, { status: unavailable ? 503 : 429, headers: rateLimitHeaders(limit) })
  }
  try {
    return NextResponse.json(await createDoctorReport(supabase, user.id, range, includeAi, new Date().toISOString().slice(0, 10)), { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    await captureOperationalError({ route: '/api/health-report', error, source: includeAi ? 'ai' : 'report', status: 500 })
    return NextResponse.json({ error: 'The report could not be generated. Your health data was not changed.' }, { status: 500 })
  }
}
