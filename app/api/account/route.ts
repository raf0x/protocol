export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { captureOperationalError } from '../../../lib/monitoring'
import { isSameOriginRequest } from '../../../lib/requestSecurity'
import { createAuthenticatedServerClient } from '../../../lib/serverSupabase'

export async function DELETE(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: 'Invalid account request.' }, { status: 403 })
  if (Number(request.headers.get('content-length') || 0) > 1_000) return NextResponse.json({ error: 'Invalid account request.' }, { status: 413 })
  const supabase = await createAuthenticatedServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in again before deleting your account.' }, { status: 401 })

  let confirmation = ''
  try {
    const body = await request.json() as { confirmation?: unknown }
    confirmation = typeof body.confirmation === 'string' ? body.confirmation : ''
  } catch { return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 }) }
  if (confirmation !== 'DELETE') return NextResponse.json({ error: 'Type DELETE exactly to confirm.' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    await captureOperationalError({ route: '/api/account', errorType: 'MissingServerConfiguration', source: 'account', status: 503 })
    return NextResponse.json({ error: 'Account deletion is temporarily unavailable. No data was deleted.' }, { status: 503 })
  }

  const { error: dataError } = await supabase.rpc('delete_my_account_data_v1', { p_confirmation: confirmation })
  if (dataError) {
    await captureOperationalError({ route: '/api/account', error: dataError, source: 'account', status: 500 })
    return NextResponse.json({ error: 'Account deletion could not be completed. No success was recorded.' }, { status: 500 })
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })
  const { error: authError } = await admin.auth.admin.deleteUser(user.id)
  if (authError) {
    await captureOperationalError({ route: '/api/account', error: authError, source: 'account', status: 500 })
    return NextResponse.json({
      error: 'Your app records were removed, but the sign-in account could not be removed. Please retry deletion or contact support.',
      partial: true,
    }, { status: 500 })
  }

  return NextResponse.json({ success: true }, {
    headers: { 'Cache-Control': 'no-store', 'Clear-Site-Data': '"cache", "cookies", "storage"' },
  })
}
