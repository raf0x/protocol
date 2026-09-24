import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { safeAuthReturnPath } from '../../../lib/authRedirect'
import { postAuthDestination } from '../../../lib/authPostAuth'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type')
  const returnPath = safeAuthReturnPath(requestUrl.searchParams.get('next'))
  function redirect(path: string) {
    const response = NextResponse.redirect(new URL(path, request.url))
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  }
  const failed = () => redirect(`/auth/login?${new URLSearchParams({ next: returnPath, error: 'link' })}`)

  const { cookies } = await import('next/headers')
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

  const otpTypes = new Set<EmailOtpType>(['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'])
  try {
    let signIn = false
    if (token_hash && type && otpTypes.has(type as EmailOtpType)) {
      const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as EmailOtpType })
      if (error) return failed()
      signIn = ['signup', 'magiclink', 'email'].includes(type)
    } else if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      if (error) return failed()
      // The SDK carries PKCE recovery intent in its cookie-backed verifier.
      const recovery = 'redirectType' in data && data.redirectType === 'recovery'
      signIn = !recovery && !['recovery', 'invite', 'email_change'].includes(type ?? '')
    } else if (token_hash || type) return failed()

    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return failed()

    // Keep action callbacks on their existing safe destination. Only sign-in
    // callbacks apply first-protocol routing; no recovery/invite/change flow is replaced.
    return redirect(signIn ? await postAuthDestination(supabase, user.id, returnPath) : returnPath)
  } catch {
    return failed()
  }
}
