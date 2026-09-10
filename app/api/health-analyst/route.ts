export const runtime = 'nodejs'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { rateLimit } from '../../../lib/rateLimit'
import { loadHealthAnalystContext } from '../../../lib/health/analyst/context'
import { analyzeHealthContext } from '../../../lib/health/analyst/service'
import { AnalystConfigurationError, AnalystProviderError } from '../../../lib/health/analyst/provider'
import { AnalystOutputError } from '../../../lib/health/analyst/schema'

export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') || 0) > 12_000) return NextResponse.json({ error: 'The question is too large.' }, { status: 413 })
  const cookieStore = await cookies()
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll() { return cookieStore.getAll() }, setAll(values) { values.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } },
  })
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to use the health analyst.' }, { status: 401 })
  if (!rateLimit(`health-analyst:${user.id}`, 8, 10 * 60_000)) return NextResponse.json({ error: 'Please wait a few minutes before asking again.' }, { status: 429 })
  let question = ''
  try {
    const body = await request.json() as { question?: unknown }
    question = typeof body.question === 'string' ? body.question.trim() : ''
  } catch { return NextResponse.json({ error: 'Enter a question to analyze.' }, { status: 400 }) }
  if (question.length < 3 || question.length > 500) return NextResponse.json({ error: 'Enter a question between 3 and 500 characters.' }, { status: 400 })
  try {
    const context = await loadHealthAnalystContext(supabase, user.id, question, new Date().toISOString().slice(0, 10))
    const result = await analyzeHealthContext(context)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof AnalystConfigurationError) return NextResponse.json({ error: error.message }, { status: 503 })
    if (error instanceof AnalystProviderError || error instanceof AnalystOutputError) return NextResponse.json({ error: 'The analyst could not produce a reliable answer. Please try again.' }, { status: 502 })
    return NextResponse.json({ error: error instanceof Error ? error.message : 'The analyst is temporarily unavailable.' }, { status: 500 })
  }
}
