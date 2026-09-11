const fs = require('fs');

const content = `export const runtime = 'nodejs'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import webpush from 'web-push'

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

async function sendPush(sub: any, title: string, body: string, url: string) {
  try {
    await webpush.sendNotification(sub.subscription, JSON.stringify({ title, body, url }))
    return true
  } catch (e) {
    console.error('Push failed:', e)
    return false
  }
}

export async function GET(request: NextRequest) {
  const auth = request.headers.get('authorization')
  if (auth !== \`Bearer \${process.env.CRON_SECRET}\`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const now = new Date()
  const currentHour = now.getHours()
  const today = now.toISOString().split('T')[0]
  let sent = 0

  // 1. Journal reminder — send to users whose reminder hour matches now
  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('reminder_hour', currentHour)

  for (const sub of subs || []) {
    const ok = await sendPush(sub, 'Protocol', 'Time to log your journal entry for today.', '/journal')
    if (ok) sent++
  }

  // 2. Vial expiry warning — runs once per day at hour 9
  if (currentHour === 9) {
    const { data: compounds } = await supabase
      .from('compounds')
      .select('id, name, reconstitution_date, user_id')
      .not('reconstitution_date', 'is', null)

    const expiringNames: Record<string, string[]> = {}

    for (const compound of compounds || []) {
      const recon = new Date(compound.reconstitution_date + 'T00:00:00')
      const daysSince = Math.floor((now.getTime() - recon.getTime()) / 86400000)
      const daysLeft = 28 - daysSince
      if (daysLeft >= 0 && daysLeft <= 3) {
        if (!expiringNames[compound.user_id]) expiringNames[compound.user_id] = []
        expiringNames[compound.user_id].push(compound.name + ' (' + daysLeft + 'd left)')
      }
    }

    for (const [userId, names] of Object.entries(expiringNames)) {
      const { data: userSubs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)

      for (const sub of userSubs || []) {
        const ok = await sendPush(
          sub,
          'Vial expiring soon',
          names.join(', ') + ' — time to reconstitute a fresh vial.',
          '/protocol'
        )
        if (ok) sent++
      }
    }
  }

  return NextResponse.json({ sent, hour: currentHour, date: today })
}
`;

fs.writeFileSync('app/api/cron/route.ts', content, 'utf8');
console.log('Done!');
