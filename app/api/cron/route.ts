export const runtime = 'nodejs'
import { createClient } from '@supabase/supabase-js'
import { isValidCronAuthorization } from '../../../lib/cronAuth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import webpush from 'web-push'
import { configureWebPush } from '../../../lib/pushConfig'
import { captureOperationalError } from '../../../lib/monitoring'

type StoredPushSubscription = { subscription: webpush.PushSubscription }

async function sendPush(sub: StoredPushSubscription, title: string, body: string, url: string) {
  try {
    await webpush.sendNotification(sub.subscription, JSON.stringify({ title, body, url }))
    return true
  } catch (error) {
    await captureOperationalError({ route: '/api/cron', error, source: 'push', status: 502 })
    return false
  }
}

import { rateLimit } from '../../../lib/rateLimit'

export async function GET(request: NextRequest) {
  if (!isValidCronAuthorization(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit('cron:' + ip, 10, 60000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  const pushConfig = configureWebPush(webpush)
  if (!pushConfig.ok) return NextResponse.json({ error: pushConfig.message }, { status: 503 })

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()
  const currentHour = now.getHours()
  const today = now.toISOString().split('T')[0]
  let sent = 0

  // 1. Journal reminder: send to users whose reminder hour matches now.
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('reminder_hour', currentHour)

  for (const sub of subs || []) {
    const ok = await sendPush(sub, 'MyPepProtocol', 'Time to log your journal entry for today.', '/journal')
    if (ok) sent++
  }

  // No vial-expiry notifications: reconstitution dates do not establish expiration.

  return NextResponse.json({ sent, hour: currentHour, date: today })
}
