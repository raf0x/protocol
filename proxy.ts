import {
  combineChunks, createServerClient, DEFAULT_COOKIE_OPTIONS, isChunkLike, stringFromBase64URL,
} from '@supabase/ssr'
import type { CookieOptions } from '@supabase/ssr'
import { isAuthSessionMissingError } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { safeAuthReturnPath } from './lib/authRedirect'

const authCacheHeaders = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0',
  Pragma: 'no-cache',
}

const invalidSessionCodes = new Set([
  'bad_jwt',
  'session_not_found',
  'session_expired',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'user_not_found',
  'user_banned',
])

function isInvalidSession(error: unknown) {
  if (!error || typeof error !== 'object') return false
  // A provider outage or rate limit is never evidence that a session was revoked.
  if ('status' in error && typeof error.status === 'number' &&
    (error.status >= 500 || error.status === 429 || error.status === 408)) return false
  return isAuthSessionMissingError(error) ||
    ('code' in error && typeof error.code === 'string' && invalidSessionCodes.has(error.code))
}

type CookieChange = { name: string; value: string; options: CookieOptions }

function deletesCookie({ value, options }: CookieChange) {
  return value === '' || (options.maxAge !== undefined && options.maxAge <= 0) ||
    (options.expires !== undefined && options.expires.getTime() <= Date.now())
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isSessionData(value: unknown): value is Record<string, unknown> {
  return isRecord(value) &&
    typeof value.access_token === 'string' && value.access_token.length > 0 &&
    typeof value.refresh_token === 'string' && value.refresh_token.length > 0 &&
    (value.expires_at === undefined || (typeof value.expires_at === 'number' && Number.isFinite(value.expires_at))) &&
    (value.user == null || isRecord(value.user))
}

async function hasMalformedSession(request: NextRequest, sessionKey: string) {
  const stored = await combineChunks(sessionKey, name => request.cookies.get(name)?.value)
  if (!stored) return false
  try {
    const decoded = stored.startsWith('base64-') ? stringFromBase64URL(stored.slice('base64-'.length)) : stored
    // Validate storage before SDK background tasks can dereference malformed
    // token/user values. This is structural validation, never authorization.
    return !isSessionData(JSON.parse(decoded))
  } catch {
    return true
  }
}

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!.trim()
  const sessionKey = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`
  const authUrl = new URL('auth/v1/', supabaseUrl.endsWith('/') ? supabaseUrl : supabaseUrl + '/')
  const cookieBatches: CookieChange[][] = []
  const cacheHeaders = new Headers()
  let verified = false
  let invalidSession = await hasMalformedSession(request, sessionKey)

  if (!invalidSession) {
    try {
      const supabase = createServerClient(
        supabaseUrl,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            async fetch(input, init) {
              try {
                const result = await fetch(input, init)
                if (result.ok) {
                  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url)
                  const isRefresh = url.pathname === authUrl.pathname + 'token' && url.searchParams.get('grant_type') === 'refresh_token'
                  const isUser = url.pathname === authUrl.pathname + 'user'
                  if (url.origin === authUrl.origin && (isRefresh || isUser)) {
                    // Parse a clone here: auth-js can log raw parse failures from
                    // successful responses. Malformed provider data is temporary,
                    // never evidence that the browser's stored session is invalid.
                    const body: unknown = await result.clone().json()
                    const user = isRecord(body) ? body.user ?? body : null
                    const valid = isRefresh
                      ? isSessionData(body) && typeof body.expires_in === 'number' && Number.isFinite(body.expires_in) && body.expires_in > 0
                      : isRecord(user) && typeof user.id === 'string' && user.id.length > 0
                    if (!valid) return new Response(null, { status: 503, statusText: 'Service Unavailable' })
                  }
                  return result
                }
                // The SDK may also log provider errors from its initial-session
                // listener. Keep only status and recognized session error codes.
                let code = 'unexpected_failure'
                if (result.status < 500 && result.status !== 429 && result.status !== 408) {
                  try {
                    const body = await result.json()
                    const candidate = body?.code ?? body?.error_code
                    if (invalidSessionCodes.has(candidate)) code = candidate
                  } catch { /* An unreadable error response is not proof of expiry. */ }
                }
                return Response.json({ code, error_code: code, message: 'Authentication verification failed' }, {
                  status: result.status,
                  headers: { 'X-Supabase-Api-Version': '2024-01-01' },
                })
              } catch {
                // auth-js logs raw transport exceptions. Keep credentials/URLs out
                // of those logs while preserving its retryable failure semantics.
                return new Response(null, { status: 503, statusText: 'Service Unavailable' })
              }
            },
          },
          cookies: {
            getAll() { return request.cookies.getAll() },
            setAll(cookiesToSet, headers) {
              // Decide whether cleanup is safe only after verification finishes.
              cookieBatches.push(cookiesToSet)
              Object.entries(headers ?? {}).forEach(([name, value]) => cacheHeaders.set(name, value))
            },
          },
        }
      )
      const { data: { user }, error } = await supabase.auth.getUser()
      verified = !error && !!user?.id
      invalidSession = (!user && !error) || isInvalidSession(error)
    } catch (error) {
      invalidSession = isInvalidSession(error)
    }

  }

  const temporaryFailure = !verified && !invalidSession
  const cookieChanges = new Map<string, CookieChange>()
  for (const batch of cookieBatches) {
    // auth-js can delete storage on 500/429 or unknown errors. Retain successful
    // rotation (including old-chunk deletions), but suppress failed cleanup.
    if (temporaryFailure && !batch.some(cookie =>
      isChunkLike(cookie.name, sessionKey) && !deletesCookie(cookie))) continue
    for (const cookie of batch) {
      // Expiring an old session must not consume a pending PKCE sign-in.
      if (invalidSession && isChunkLike(cookie.name, `${sessionKey}-code-verifier`) && deletesCookie(cookie)) continue
      cookieChanges.set(cookie.name, cookie)
    }
  }

  if (invalidSession) {
    // getUser does not clear storage for every definitive rejection. Expire
    // only this project's existing session cookies; never revoke other devices.
    const names = new Set([...request.cookies.getAll().map(cookie => cookie.name), ...cookieChanges.keys()])
    for (const name of names) {
      if (!isChunkLike(name, sessionKey) && !isChunkLike(name, `${sessionKey}-user`)) continue
      const existing = cookieChanges.get(name)
      if (existing && deletesCookie(existing)) continue
      cookieChanges.set(name, {
        name,
        value: '',
        options: { ...DEFAULT_COOKIE_OPTIONS, ...existing?.options, maxAge: 0, expires: new Date(0) },
      })
    }
  }

  for (const cookie of cookieChanges.values()) {
    if (deletesCookie(cookie)) request.cookies.delete(cookie.name)
    else request.cookies.set(cookie.name, cookie.value)
  }

  const path = request.nextUrl.pathname
  const isAuthPage = path.startsWith('/auth')
  const isApiRoute = path.startsWith('/api')
  const isPublicPage =
  path === '/' ||
  path === '/calculator' ||
  path === '/onboarding' ||
  path === '/privacy' ||
  path === '/terms' ||
  path === '/support' ||
  path === '/offline' ||
  path.startsWith('/share') ||
  path.startsWith('/demo')
  const isProtected = !isAuthPage && !isPublicPage && !isApiRoute

  let response: NextResponse
  if (!verified && isProtected) {
    if (temporaryFailure) {
      response = new NextResponse('Unable to verify your session right now. Please try again shortly.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '5' },
      })
    } else {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('next', safeAuthReturnPath(`${path}${request.nextUrl.search}`))
      response = NextResponse.redirect(loginUrl)
    }
  } else {
    // Forward refreshed/deleted cookies to server components as request headers.
    response = cookieChanges.size
      ? NextResponse.next({ request: { headers: request.headers } })
      : NextResponse.next()
  }

  if (isProtected || cookieChanges.size || cookieBatches.length) {
    Object.entries(authCacheHeaders).forEach(([name, value]) => response.headers.set(name, value))
  }
  cacheHeaders.forEach((value, name) => response.headers.set(name, value))
  for (const { name, value, options } of cookieChanges.values()) {
    response.cookies.set(name, value, options)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\.png$).*)'],
}
