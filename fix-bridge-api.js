const fs = require('fs');
const content = `export const runtime = 'nodejs'

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
}`;
fs.writeFileSync('app/api/create-protocol/route.ts', content, 'utf8');
console.log('API route created');

// Now update calculator to use the API route instead of direct supabase calls
let calc = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// Remove the direct supabase saveToProtocol function and replace with API call
calc = calc.replace(
  /  async function saveToProtocol\(\) \{[\s\S]*?catch \(e\) \{ console\.error\(e\); setSavingProtocol\(false\) \}\n  \}/,
  `  async function saveToProtocol() {
    if (!compoundLabel.trim()) return
    setSavingProtocol(true)
    try {
      const res = await fetch('/api/create-protocol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: compoundLabel.trim(), dose: activeDose, vial: activeStrength, water: activeWater })
      })
      const data = await res.json()
      if (data.error === 'Not authenticated') { setIsLoggedIn(false); setShowSaveFlow(true); setSavingProtocol(false); return }
      if (data.success) { setSaveSuccess(true) }
      setSavingProtocol(false)
    } catch (e) { console.error(e); setSavingProtocol(false) }
  }`
);

// Remove the checkAuth useEffect since we check via API now
calc = calc.replace(
  "    async function checkAuth() { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (user) { setIsLoggedIn(true); setUserId(user.id) } }\n    checkAuth()\n",
  "    setIsLoggedIn(true)\n"
);

// Remove unused userId state and supabase import
calc = calc.replace("  const [userId, setUserId] = useState('')", "");
if (calc.includes("import { createClient } from '../../lib/supabase'")) {
  calc = calc.replace("import { createClient } from '../../lib/supabase'\n", "");
}

fs.writeFileSync('app/calculator/page.tsx', calc, 'utf8');
console.log('Calculator updated');
console.log('All done');
