export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const { name, dose, vial, water } = await request.json()
  if (!name || !dose || !vial) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

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
  const { data: protocol, error: pe } = await supabase.from('protocols').insert({ user_id: user.id, name, start_date: todayStr }).select().single()
  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 })

  const { data: compound, error: ce } = await supabase.from('compounds').insert({ protocol_id: protocol.id, user_id: user.id, name, vial_strength: parseFloat(vial), vial_unit: 'mg', bac_water_ml: water ? parseFloat(water) : null, reconstitution_date: todayStr }).select().single()
  if (ce) return NextResponse.json({ error: ce.message }, { status: 500 })

  await supabase.from('phases').insert({ compound_id: compound.id, user_id: user.id, name: 'Phase 1', dose: parseFloat(dose), dose_unit: 'mg', start_week: 1, end_week: 4, frequency: '1x/week' })
  await supabase.from('protocol_events').insert({ user_id: user.id, protocol_id: protocol.id, compound_id: compound.id, date: todayStr, event_type: 'started', description: 'Started ' + name + ' at ' + dose + 'mg' })

  return NextResponse.json({ success: true })
}