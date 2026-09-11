export const runtime = 'nodejs'

import { NextResponse, type NextRequest } from 'next/server'
import { checkDurableRateLimit, rateLimitHeaders } from '../../../../lib/durableRateLimit'
import { captureAnalystOperationalError } from '../../../../lib/health/analyst/monitoring'
import { checkHealthAnalystProvider, type ProviderHealthCheck } from '../../../../lib/health/analyst/provider'
import { isSameOriginRequest } from '../../../../lib/requestSecurity'
import { createAuthenticatedServerClient } from '../../../../lib/serverSupabase'

const unavailable = (): ProviderHealthCheck => ({ configured: false, reachable: false, modelAccepted: false, structuredOutputAccepted: false })

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json(unavailable(), { status: 403 })
  if (Number(request.headers.get('content-length') || 0) > 100) return NextResponse.json(unavailable(), { status: 413 })
  const supabase = await createAuthenticatedServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(unavailable(), { status: 401 })
  const limit = await checkDurableRateLimit(supabase, user.id, 'health-analyst')
  if (!limit.allowed) return NextResponse.json(unavailable(), {
    status: !limit.available && process.env.NODE_ENV === 'production' ? 503 : 429,
    headers: rateLimitHeaders(limit),
  })
  const result = await checkHealthAnalystProvider({
    onError: async error => { await captureAnalystOperationalError('/api/health-analyst/health', error) },
  })
  return NextResponse.json(result, { status: result.configured ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
