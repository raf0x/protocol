export const runtime = 'nodejs'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { rateLimit } from '../../../lib/rateLimit'

export async function POST(request: NextRequest) {
  // Rate limit: 10 protocols per minute
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit('create-protocol:' + ip, 10, 60000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }

  const { name, dose, vial, water } = await request.json()

  // Input validation
  if (typeof name !== 'string' || name.length === 0 || name.length > 100) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
  }
  if (typeof dose !== 'number' || isNaN(dose) || dose <= 0 || dose > 100) {
    return NextResponse.json({ error: 'Invalid dose' }, { status: 400 })
  }
  if (typeof vial !== 'number' || isNaN(vial) || vial <= 0 || vial > 1000) {
    return NextResponse.json({ error: 'Invalid vial strength' }, { status: 400 })
  }
  if (water !== null && water !== undefined) {
    if (typeof water !== 'number' || isNaN(water) || water <= 0 || water > 10) {
      return NextResponse.json({ error: 'Invalid water amount' }, { status: 400 })
    }
  }

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

  const { data: protocol, error: pe } = await supabase
    .from('protocols')
    .insert({ user_id: user.id, name, start_date: todayStr })
    .select()
    .single()

  if (pe) return NextResponse.json({ error: pe.message }, { status: 500 })

  const { data: compound, error: ce } = await supabase
    .from('compounds')
    .insert({
      protocol_id: protocol.id,
      user_id: user.id,
      name,
      vial_strength: vial,
      vial_unit: 'mg',
      bac_water_ml: water || null,
      reconstitution_date: todayStr,
    })
    .select()
    .single()

  if (ce) return NextResponse.json({ error: ce.message }, { status: 500 })

  await supabase.from('phases').insert({
    compound_id: compound.id,
    user_id: user.id,
    name: 'Phase 1',
    dose: dose,
    dose_unit: 'mg',
    start_week: 1,
    end_week: 4,
    frequency: '1x/week',
  })

  await supabase.from('protocol_events').insert({
    user_id: user.id,
    protocol_id: protocol.id,
    compound_id: compound.id,
    date: todayStr,
    event_type: 'started',
    description: 'Started ' + name + ' at ' + dose + 'mg',
  })

  return NextResponse.json({ success: true })
}
