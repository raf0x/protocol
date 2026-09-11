export const runtime = 'nodejs'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { rateLimit } from '../../../lib/rateLimit'
import { createDoctorReport } from '../../../lib/health/report/service'
import type { ReportRange } from '../../../lib/health/report/types'

const ranges = new Set<ReportRange>(['3m', '6m', '12m', 'all'])
export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') || 0) > 2_000) return NextResponse.json({ error: 'The report request is too large.' }, { status: 413 })
  const cookieStore = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return cookieStore.getAll() }, setAll(values) { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to create a health report.' }, { status: 401 })
  let range: ReportRange = '6m', includeAi = true
  try {
    const body = await request.json() as { range?: unknown; includeAi?: unknown }
    if (typeof body.range !== 'string' || !ranges.has(body.range as ReportRange) || typeof body.includeAi !== 'boolean') throw new Error()
    range = body.range as ReportRange; includeAi = body.includeAi
  } catch { return NextResponse.json({ error: 'Choose a valid report range and try again.' }, { status: 400 }) }
  if (!rateLimit(`health-report:${user.id}`, includeAi ? 6 : 30, 10 * 60_000)) return NextResponse.json({ error: 'Please wait a few minutes before generating another report.' }, { status: 429 })
  try {
    return NextResponse.json(await createDoctorReport(supabase, user.id, range, includeAi, new Date().toISOString().slice(0, 10)), { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: 'The report could not be generated. Your health data was not changed.' }, { status: 500 }) }
}
