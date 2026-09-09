export const runtime = 'nodejs'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { quickCreatePayload } from '../../../lib/health/dosing'
import { rateLimit } from '../../../lib/rateLimit'

export async function POST(request: NextRequest) {
  // Rate limit: 10 protocols per minute
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit('create-protocol:' + ip, 10, 60000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  let payload: ReturnType<typeof quickCreatePayload>
  try { payload = quickCreatePayload(await request.json()) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid input' }, { status: 400 }) }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name: n, value, options }) => cookieStore.set(n, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const todayStr = new Date().toISOString().split('T')[0]

  const { data: protocolId, error } = await supabase.rpc('save_protocol_dosing_v1', {
    p_protocol_id: null, p_name: payload.name, p_start_date: todayStr, p_compounds: payload.compounds,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true, protocolId })
}
