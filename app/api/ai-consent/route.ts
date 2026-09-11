export const runtime = 'nodejs'

import { NextResponse, type NextRequest } from 'next/server'
import { AI_CONSENT_VERSION } from '../../../lib/aiConsent'
import { captureOperationalError } from '../../../lib/monitoring'
import { isSameOriginRequest } from '../../../lib/requestSecurity'
import { createAuthenticatedServerClient } from '../../../lib/serverSupabase'
import { resolveUserProfileOwnership } from '../../../lib/userProfileOwnership'

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid consent request.' }, { status: 403 })
  if (Number(request.headers.get('content-length') || 0) > 1_000) return NextResponse.json({ error: 'Invalid consent request.' }, { status: 413 })
  const supabase = await createAuthenticatedServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to update AI settings.' }, { status: 401 })

  let consent: boolean
  try {
    const body = await request.json() as { consent?: unknown }
    if (typeof body.consent !== 'boolean') throw new Error('InvalidConsent')
    consent = body.consent
  } catch { return NextResponse.json({ error: 'Choose whether to allow AI processing.' }, { status: 400 }) }

  const values = {
    ai_processing_consent: consent,
    ai_processing_consented_at: consent ? new Date().toISOString() : null,
    ai_processing_consent_version: AI_CONSENT_VERSION,
  }
  const result = await resolveUserProfileOwnership(
    async ownerKey => await supabase.from('user_profiles').update(values).eq(ownerKey, user.id).select('ai_processing_consent'),
    data => Array.isArray(data) && data.length > 0,
  )
  if (result.error || !result.data?.length) {
    await captureOperationalError({ route: '/api/ai-consent', error: result.error, errorType: result.error ? undefined : 'ProfileNotFound', source: 'api', status: 500 })
    return NextResponse.json({ error: 'AI settings could not be updated. No health data was sent.' }, { status: 500 })
  }
  return NextResponse.json({ consent, version: AI_CONSENT_VERSION }, { headers: { 'Cache-Control': 'no-store' } })
}
