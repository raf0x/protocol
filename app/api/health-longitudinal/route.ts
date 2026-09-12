import { NextResponse } from 'next/server'
import { createAuthenticatedServerClient } from '../../../lib/serverSupabase'
import { loadLongitudinal } from '../../../lib/health/longitudinal/load'

export const runtime = 'nodejs'
const headers = { 'Cache-Control': 'private, no-store' }
export async function GET() {
  try {
    const client = await createAuthenticatedServerClient()
    const { data: { user }, error } = await client.auth.getUser()
    if (!user || error) return NextResponse.json({ error: 'Sign in to view health history.' }, { status: 401, headers })
    return NextResponse.json(await loadLongitudinal(client, user.id, new Date().toISOString().slice(0, 10)), { headers })
  } catch {
    // Never log source records or return database/provider details.
    return NextResponse.json({ error: 'Your recorded changes are temporarily unavailable. Please try again.' }, { status: 503, headers })
  }
}
