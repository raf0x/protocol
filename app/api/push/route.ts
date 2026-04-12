export const runtime = 'nodejs'

import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export async function POST(request: NextRequest) {
  const { user_id, subscription, reminder_hour } = await request.json()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id,
    subscription,
    reminder_hour: reminder_hour || 20,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function GET(request: NextRequest) {
  const userId = request.headers.get('x-user-id')
  const cronSecret = request.headers.get('authorization')
  const isAdmin = userId === '41266062-c8a7-4a52-aa9b-c1fb96d1c483'
  const isCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`
  if (!isAdmin && !isCron) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const now = new Date()
  const currentHour = now.getHours()
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('reminder_hour', currentHour)
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0 })
  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify({
          title: 'Protocol',
          body: 'Time to log your journal entry for today.',
          url: '/journal',
        })
      )
      sent++
    } catch (e) {
      console.error('Push failed for user:', sub.user_id, e)
    }
  }
  return NextResponse.json({ sent })
}

export async function DELETE(request: NextRequest) {
  const { user_id } = await request.json()
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  await supabase.from('push_subscriptions').delete().eq('user_id', user_id)
  return NextResponse.json({ success: true })
}