export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ADMIN_ID = '41266062-c8a7-4a52-aa9b-c1fb96d1c483'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('x-user-id')
  if (authHeader !== ADMIN_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data, error } = await supabase
    .from('cohort_posts')
    .select('*, cohorts(name)')
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ posts: data })
}

export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('x-user-id')
  if (authHeader !== ADMIN_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id } = await request.json()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  await supabase.from('cohort_posts').delete().eq('id', id)
  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  const authHeader = request.headers.get('x-user-id')
  if (authHeader !== ADMIN_ID) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { id, flagged } = await request.json()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  await supabase.from('cohort_posts').update({ flagged }).eq('id', id)
  return NextResponse.json({ success: true })
}