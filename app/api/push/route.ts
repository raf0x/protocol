export const runtime = 'nodejs'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import webpush from 'web-push'
import { rateLimit } from '../../../lib/rateLimit'
import { configureWebPush } from '../../../lib/pushConfig'

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return { user, supabase }
}

export async function POST(request: NextRequest) {
  if (Number(request.headers.get('content-length') || 0) > 16_000) return NextResponse.json({ error: 'Subscription request is too large.' }, { status: 413 })
  const { user, supabase } = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
  if (!rateLimit('push-subscribe:' + user.id, 5, 60000)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  let body: { subscription?: unknown; reminder_hour?: unknown }
  try { body = await request.json() as typeof body } catch { return NextResponse.json({ error: 'Invalid subscription request.' }, { status: 400 }) }
  const { subscription, reminder_hour } = body

  const push = subscription as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null
  if (!push || typeof push !== 'object' || typeof push.endpoint !== 'string' || !push.endpoint.startsWith('https://') || typeof push.keys?.p256dh !== 'string' || typeof push.keys?.auth !== 'string') {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const hour = reminder_hour ?? 20
  if (typeof hour !== 'number' || hour < 0 || hour > 23) {
    return NextResponse.json({ error: 'Invalid reminder_hour' }, { status: 400 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    subscription,
    reminder_hour: hour,
  })

  if (error) return NextResponse.json({ error: 'The reminder could not be saved.' }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function GET(request: NextRequest) {
  // Only cron job can call this
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const pushConfig = configureWebPush(webpush)
  if (!pushConfig.ok) return NextResponse.json({ error: pushConfig.message }, { status: 503 })

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
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
          title: 'MyPepProtocol',
          body: 'Time to log your journal entry for today.',
          url: '/journal',
        })
      )
      sent++
    } catch {
      console.error('Push delivery failed.')
    }
  }

  return NextResponse.json({ sent })
}

export async function DELETE() {
  const { user, supabase } = await getAuthenticatedUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
