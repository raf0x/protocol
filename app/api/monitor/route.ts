export const runtime = 'nodejs'

import { NextResponse, type NextRequest } from 'next/server'
import { captureOperationalError, type MonitorSource } from '../../../lib/monitoring'
import { createAuthenticatedServerClient } from '../../../lib/serverSupabase'

export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') || 0) > 1_000) return new NextResponse(null, { status: 204 })
  try {
    const supabase = await createAuthenticatedServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return new NextResponse(null, { status: 204 })
    const body = await request.json() as { route?: unknown; errorType?: unknown; status?: unknown }
    if (typeof body.route !== 'string' || typeof body.errorType !== 'string') return new NextResponse(null, { status: 204 })
    await captureOperationalError({
      route: body.route,
      errorType: body.errorType,
      source: 'client' satisfies MonitorSource,
      status: typeof body.status === 'number' ? body.status : undefined,
    })
  } catch {
    // Monitoring is deliberately best-effort and cannot affect the app.
  }
  return new NextResponse(null, { status: 204 })
}
