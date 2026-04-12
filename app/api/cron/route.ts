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

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
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
      console.error('Push failed:', e)
    }
  }
  return NextResponse.json({ sent })
}