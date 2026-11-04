import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import * as ssr from '@supabase/ssr'
import { AuthApiError, AuthRetryableFetchError, AuthSessionMissingError } from '@supabase/supabase-js'

const require = createRequire(import.meta.url)
const { NextRequest } = require('next/server')
const origin = 'https://app.example'
const key = 'sb-fixture-auth-token'
const user = { id: 'fixture-owner', email: 'fixture@example.invalid' }
const cacheHeaders = {
  'Cache-Control': 'private, no-cache, no-store, must-revalidate, max-age=0',
  Expires: '0', Pragma: 'no-cache',
}
const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon-key' }

function load(path, mocks = {}, globals = {}, cache = new Map()) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => {
    if (name in mocks) return mocks[name]
    if (!name.startsWith('.')) return require(name)
    return load(new URL(name + (existsSync(new URL(name + '.ts', url)) ? '.ts' : ''), url), mocks, globals, cache)
  }, module, module.exports, ...Object.values(globals))
  cache.set(url.href, module.exports)
  return module.exports
}

function request(path = '/protocol', cookies = new Map()) {
  return new NextRequest(origin + path, { headers: { cookie: [...cookies].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ') } })
}

function harness({ result = { data: { user }, error: null }, batches = [], throws, transport, real = false } = {}) {
  const calls = [], logs = []
  const record = (...args) => logs.push(args)
  const offline = async () => { throw new Error('Unexpected network attempt in authentication fixture') }
  const fakeFetch = transport ?? offline
  const { proxy } = load('../proxy.ts', {
    '@supabase/ssr': { ...ssr, createServerClient(url, anon, options) {
      assert.equal(url, env.NEXT_PUBLIC_SUPABASE_URL)
      assert.equal(anon, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      if (real) return ssr.createServerClient(url, anon, { ...options, global: { ...options.global, fetch: options.global?.fetch ?? fakeFetch } })
      return { auth: {
        async getUser() {
          calls.push('getUser')
          for (const batch of batches) await options.cookies.setAll(batch.cookies, batch.headers ?? cacheHeaders)
          if (throws) throw throws
          return result
        },
        async signOut() { calls.push('signOut'); throw new Error('Session recovery must not change sign-out policy') },
      } }
    } },
  }, { process: { env }, fetch: fakeFetch, console: { log: record, warn: record, error: record, info: record, debug: record } })
  return { proxy, calls, logs }
}

function assertPass(response) {
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-middleware-next'), '1')
  assert.equal(response.headers.get('location'), null)
}
function assertLogin(response, next = '/protocol') {
  assert.equal(response.status, 307)
  assert.equal(response.headers.get('x-middleware-next'), null)
  const location = new URL(response.headers.get('location'))
  assert.equal(location.origin, origin)
  assert.equal(location.pathname, '/auth/login')
  assert.equal(location.searchParams.get('next'), next)
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
}
function assertUnavailable(response) {
  assert.equal(response.status, 503)
  assert.equal(response.headers.get('location'), null)
  assert.equal(response.headers.get('x-middleware-next'), null)
  assert.match(response.headers.get('cache-control') ?? '', /no-store/)
  assert.ok(Number(response.headers.get('retry-after')) > 0)
}
function applyCookies(jar, response) {
  for (const cookie of response.cookies.getAll()) {
    if (cookie.maxAge === 0 || cookie.expires?.getTime() <= Date.now()) jar.delete(cookie.name)
    else jar.set(cookie.name, cookie.value)
  }
}
function sessionCookie({ expired = false, refresh = 'fixture-refresh', suffix = '' } = {}) {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + (expired ? -3600 : 3600)
  const jwt = [{ alg: 'HS256', typ: 'JWT' }, { sub: user.id, exp, iat: now - 7200, aud: 'authenticated', role: 'authenticated' }].map(part => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.') + '.fixture' + suffix
  return { encoded: 'base64-' + Buffer.from(JSON.stringify({ access_token: jwt, refresh_token: refresh, expires_at: exp, expires_in: 3600, token_type: 'bearer', user })).toString('base64url'), jwt }
}
function apiError(code, status = 400) { return new AuthApiError('Synthetic authentication rejection', status, code) }

test('verified user passes protected route without signing out', async () => {
  const h = harness()
  assertPass(await h.proxy(request('/timeline?filter=weight')))
  assert.deepEqual(h.calls, ['getUser'])
})

for (const error of [null, new AuthSessionMissingError(), apiError('session_expired'), apiError('session_not_found'), apiError('refresh_token_not_found'), apiError('refresh_token_already_used'), apiError('bad_jwt'), apiError('user_not_found')]) {
  test(`missing or definitively invalid session redirects safely: ${error?.code ?? error?.name ?? 'empty'}`, async () => {
    const h = harness({ result: { data: { user: null }, error } })
    assertLogin(await h.proxy(request('/timeline?filter=weight')), '/timeline?filter=weight')
    assert.deepEqual(h.calls, ['getUser'])
  })
}

for (const path of ['/', '/calculator', '/onboarding', '/privacy', '/terms', '/support', '/offline', '/share/token', '/demo/example', '/auth/login', '/auth/callback?code=fixture-code&next=/profile', '/api/example']) {
  test(`existing public/auth/API exemption is preserved: ${path}`, async () => {
    const h = harness({ result: { data: { user: null }, error: new AuthSessionMissingError() } })
    assertPass(await h.proxy(request(path)))
  })
}
for (const path of ['/protocol', '/protocol/manage', '/timeline', '/health', '/profile', '/inventory']) {
  test(`protected route never grants missing identity: ${path}`, async () => {
    const h = harness({ result: { data: { user: null }, error: new AuthSessionMissingError() } })
    assertLogin(await h.proxy(request(path)), path)
  })
}
for (const path of ['//evil.example', '/%2fevil.example', '/%252fevil.example', '/%5cevil.example', '/%255cevil.example', '/%0a/evil.example', '/bad%xx', '/%61uth/login']) {
  test(`unsafe return target is normalized to same-origin fallback: ${path}`, async () => {
    assertLogin(await harness({ result: { data: { user: null }, error: new AuthSessionMissingError() } }).proxy(request(path)))
  })
}

test('refresh preserves cookie attributes, cache directives and forwarded request cookies', async () => {
  const options = { path: '/', domain: 'app.example', sameSite: 'lax', secure: true, httpOnly: true, maxAge: 7200, priority: 'high', partitioned: true }
  const h = harness({ batches: [{ cookies: [{ name: key, value: 'fixture-new-session', options }] }] })
  const response = await h.proxy(request('/protocol', new Map([[key, sessionCookie().encoded]])))
  assertPass(response)
  const cookie = response.cookies.get(key)
  for (const [name, expected] of Object.entries(options)) assert.equal(cookie[name], expected, name)
  for (const [name, value] of Object.entries(cacheHeaders)) assert.equal(response.headers.get(name), value)
  assert.match(response.headers.get('x-middleware-request-cookie') ?? '', /sb-fixture-auth-token=fixture-new-session/)
})

test('redirect carries SDK cookie writes, tombstones, attributes and cache headers', async () => {
  const options = { path: '/', domain: 'app.example', sameSite: 'strict', secure: true, httpOnly: true, maxAge: 0, expires: new Date(0), priority: 'high' }
  const h = harness({ result: { data: { user: null }, error: apiError('refresh_token_not_found') }, batches: [{ cookies: [
    { name: 'fixture-old-chunk', value: '', options },
    { name: 'fixture-sdk-update', value: 'fixture-update', options: { path: '/', sameSite: 'lax', secure: true, maxAge: 3600 } },
  ] }] })
  const response = await h.proxy(request())
  assertLogin(response)
  const deleted = response.cookies.get('fixture-old-chunk')
  assert.ok(deleted)
  assert.equal(deleted.value, '')
  for (const [name, expected] of Object.entries(options)) {
    if (name === 'expires') assert.ok(deleted.expires.getTime() <= Date.now())
    else assert.equal(deleted[name], expected, name)
  }
  assert.equal(response.cookies.get('fixture-sdk-update').value, 'fixture-update')
  for (const [name, value] of Object.entries(cacheHeaders)) assert.equal(response.headers.get(name), value)
})

test('definite rejection clears only the current project session and preserves PKCE and unrelated cookies', async () => {
  const jar = new Map([[key, sessionCookie().encoded], [key + '.0', 'old-0'], [key + '.1', 'old-1'], [key + '-user', 'old-user'], [key + '-user.0', 'old-user-0'], [key + '-code-verifier', 'pending-pkce'], ['sb-other-auth-token', 'other-project'], ['preference', 'dark']])
  const response = await harness({ result: { data: { user: null }, error: apiError('bad_jwt', 401) } }).proxy(request('/protocol', jar))
  assertLogin(response)
  applyCookies(jar, response)
  assert.deepEqual([...jar], [[key + '-code-verifier', 'pending-pkce'], ['sb-other-auth-token', 'other-project'], ['preference', 'dark']])
})

for (const error of [new AuthRetryableFetchError('Synthetic provider unavailable', 503), apiError('unexpected_failure', 500), apiError('over_request_rate_limit', 429), apiError('unrecognized_error', 400), new Error('Synthetic unknown failure')]) {
  test(`uncertain verification blocks protected content without discarding session: ${error.code ?? error.name}/${error.status ?? 0}`, async () => {
    const original = sessionCookie().encoded
    const jar = new Map([[key, original]])
    const h = harness({ result: { data: { user: null }, error }, batches: [{ cookies: [{ name: key, value: '', options: { path: '/', maxAge: 0 } }] }] })
    const response = await h.proxy(request('/protocol', jar))
    assertUnavailable(response)
    applyCookies(jar, response)
    assert.equal(jar.get(key), original)
    assert.deepEqual(h.calls, ['getUser'])
  })
}

test('a thrown verification failure is contained without sensitive logs or output', async () => {
  const sentinel = 'fixture-secret-cookie-token-credential'
  const h = harness({ throws: new Error(sentinel) })
  const response = await h.proxy(request())
  assertUnavailable(response)
  assert.doesNotMatch(await response.text(), new RegExp(sentinel))
  assert.doesNotMatch(JSON.stringify(h.logs), new RegExp(sentinel))
})

test('user object accompanied by verification error never authorizes protected content', async () => {
  assertUnavailable(await harness({ result: { data: { user }, error: apiError('unexpected_failure', 500) } }).proxy(request()))
})

for (const path of ['/auth/login', '/auth/callback?code=fixture', '/privacy', '/api/example']) {
  test(`transient verification preserves existing exempt route behavior: ${path}`, async () => {
    assertPass(await harness({ result: { data: { user: null }, error: apiError('unexpected_failure', 500) } }).proxy(request(path)))
  })
}

test('real SDK: valid synthetic session verifies identity without refresh', async () => {
  let refreshes = 0, users = 0
  const { encoded, jwt } = sessionCookie()
  const h = harness({ real: true, transport: async (url, options) => {
    if (new URL(url).pathname.endsWith('/token')) { refreshes++; throw new Error('Unexpected refresh') }
    assert.ok(new URL(url).pathname.endsWith('/user'))
    assert.equal(new Headers(options.headers).get('authorization'), `Bearer ${jwt}`)
    users++
    return Response.json(user)
  } })
  assertPass(await h.proxy(request('/protocol', new Map([[key, encoded]]))))
  assert.equal(refreshes, 0); assert.equal(users, 1)
})

test('real SDK: revoked refresh is attempted once across consecutive protected/login requests', async () => {
  let refreshes = 0
  const encoded = sessionCookie({ expired: true }).encoded
  const middle = Math.floor(encoded.length / 2)
  const jar = new Map([[key + '.0', encoded.slice(0, middle)], [key + '.1', encoded.slice(middle)], ['preference', 'dark']])
  const h = harness({ real: true, transport: async url => {
    assert.ok(new URL(url).pathname.endsWith('/token'))
    refreshes++
    return Response.json({ code: 'refresh_token_not_found', msg: 'Synthetic revoked refresh token' }, { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
  } })
  const first = await h.proxy(request('/protocol', jar))
  assertLogin(first)
  applyCookies(jar, first)
  assert.deepEqual([...jar], [['preference', 'dark']])
  for (let index = 0; index < 3; index++) {
    const protectedResponse = await h.proxy(request('/protocol', jar))
    assertLogin(protectedResponse)
    applyCookies(jar, protectedResponse)
    assertPass(await h.proxy(request(new URL(protectedResponse.headers.get('location')).pathname, jar)))
  }
  assert.equal(refreshes, 1)
})

for (const status of [500, 429]) {
  test(`real SDK: temporary refresh HTTP ${status} retains usable browser cookies and can recover`, async () => {
    const original = sessionCookie({ expired: true }).encoded
    const jar = new Map([[key, original]])
    let recovered = false
    const fresh = sessionCookie({ refresh: 'fixture-rotated-refresh', suffix: '-rotated' })
    const h = harness({ real: true, transport: async url => {
      if (new URL(url).pathname.endsWith('/token')) {
        if (!recovered) return Response.json({ code: status === 500 ? 'unexpected_failure' : 'over_request_rate_limit', msg: 'Synthetic temporary failure' }, { status, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
        return Response.json({ access_token: fresh.jwt, refresh_token: 'fixture-rotated-refresh', token_type: 'bearer', expires_in: 3600, user })
      }
      assert.ok(new URL(url).pathname.endsWith('/user'))
      return Response.json(user)
    } })
    const first = await h.proxy(request('/protocol', jar))
    assertUnavailable(first)
    applyCookies(jar, first)
    assert.equal(jar.get(key), original)
    recovered = true
    const second = await h.proxy(request('/protocol', jar))
    assertPass(second)
    applyCookies(jar, second)
    assert.notEqual(jar.get(key), original)
  })
}

test('real SDK: successful rotation survives a subsequent transient user verification failure', async () => {
  const original = sessionCookie({ expired: true }).encoded
  const jar = new Map([[key, original]])
  const fresh = sessionCookie({ refresh: 'fixture-rotated-refresh', suffix: '-rotated' })
  let refreshes = 0, recovered = false
  const h = harness({ real: true, transport: async url => {
    if (new URL(url).pathname.endsWith('/token')) {
      refreshes++
      return Response.json({ access_token: fresh.jwt, refresh_token: 'fixture-rotated-refresh', token_type: 'bearer', expires_in: 3600, user })
    }
    assert.ok(new URL(url).pathname.endsWith('/user'))
    return recovered ? Response.json(user) : Response.json({ code: 'unexpected_failure', msg: 'Synthetic temporary verification failure' }, { status: 500, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
  } })
  const first = await h.proxy(request('/protocol', jar))
  assertUnavailable(first)
  applyCookies(jar, first)
  assert.notEqual(jar.get(key), original)
  assert.ok(jar.get(key))
  recovered = true
  for (let index = 0; index < 3; index++) assertPass(await h.proxy(request('/protocol', jar)))
  assert.equal(refreshes, 1)
})

test('real SDK: transport exception cannot leak sensitive details into console or response', async () => {
  const sentinel = 'fixture-sensitive-token-cookie-credential'
  const output = []
  const originalError = console.error
  console.error = (...args) => output.push(args.map(String).join(' '))
  try {
    const h = harness({ real: true, transport: async () => { throw new Error(sentinel) } })
    const response = await h.proxy(request('/protocol', new Map([[key, sessionCookie().encoded]])))
    assertUnavailable(response)
    assert.doesNotMatch(output.join('\n'), new RegExp(sentinel))
    assert.doesNotMatch(await response.text(), new RegExp(sentinel))
  } finally { console.error = originalError }
})

test('real SDK: malformed session is removed without provider calls or login loops', async () => {
  const jar = new Map([[key, 'base64-' + Buffer.from(JSON.stringify({ broken: true })).toString('base64url')], [key + '-code-verifier', 'pending-pkce']])
  const h = harness({ real: true })
  const response = await h.proxy(request('/protocol', jar))
  assertLogin(response)
  applyCookies(jar, response)
  assert.deepEqual([...jar], [[key + '-code-verifier', 'pending-pkce']])
  assertPass(await h.proxy(request('/auth/login', jar)))
})

test('transient deletion batch is not accepted merely because it also writes a preference or user cookie', async () => {
  const original = sessionCookie().encoded
  const jar = new Map([[key, original]])
  const h = harness({ result: { data: { user: null }, error: apiError('unexpected_failure', 500) }, batches: [{ cookies: [
    { name: key, value: '', options: { path: '/', maxAge: 0 } },
    { name: key + '-user', value: 'fixture-user', options: { path: '/' } },
    { name: 'preference', value: 'dark', options: { path: '/' } },
  ] }] })
  const response = await h.proxy(request('/protocol', jar))
  assertUnavailable(response)
  applyCookies(jar, response)
  assert.equal(jar.get(key), original)
})

test('real SDK: a successful refresh removes obsolete chunks and forwards the new cookie to the protected request', async () => {
  const original = sessionCookie({ expired: true }).encoded
  const jar = new Map([[key + '.0', original.slice(0, 100)], [key + '.1', original.slice(100)]])
  const fresh = sessionCookie({ refresh: 'fixture-new-refresh', suffix: '-new' })
  const h = harness({ real: true, transport: async url => {
    if (new URL(url).pathname.endsWith('/token')) return Response.json({ access_token: fresh.jwt, refresh_token: 'fixture-new-refresh', token_type: 'bearer', expires_in: 3600, user })
    assert.ok(new URL(url).pathname.endsWith('/user'))
    return Response.json(user)
  } })
  const response = await h.proxy(request('/protocol', jar))
  assertPass(response)
  applyCookies(jar, response)
  assert.ok(jar.get(key))
  assert.equal(jar.has(key + '.0'), false)
  assert.equal(jar.has(key + '.1'), false)
  const forwarded = response.headers.get('x-middleware-request-cookie') ?? ''
  assert.match(forwarded, /sb-fixture-auth-token=base64-/)
  assert.doesNotMatch(forwarded, /sb-fixture-auth-token\.\d=/)
  for (const [name, value] of Object.entries(cacheHeaders)) assert.equal(response.headers.get(name), value)
})

test('real SDK: provider error details cannot leak a credential sentinel into asynchronous SDK logs', async () => {
  const sentinel = 'fixture-sensitive-provider-token-cookie'
  const output = [], previousError = console.error, previousWarn = console.warn
  console.error = console.warn = (...args) => output.push(args.map(String).join(' '))
  try {
    const h = harness({ real: true, transport: async () => Response.json({ code: 'refresh_token_not_found', msg: sentinel }, { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } }) })
    const response = await h.proxy(request('/protocol', new Map([[key, sessionCookie({ expired: true }).encoded]])))
    assertLogin(response)
    await new Promise(resolve => setImmediate(resolve))
    assert.doesNotMatch(output.join('\n'), new RegExp(sentinel))
    assert.doesNotMatch(await response.text(), new RegExp(sentinel))
  } finally { console.error = previousError; console.warn = previousWarn }
})

for (const status of [500, 429]) {
  test(`real SDK: HTTP ${status} takes precedence over a conflicting session_not_found error code`, async () => {
    const original = sessionCookie({ expired: true }).encoded
    const jar = new Map([[key, original]])
    const h = harness({ real: true, transport: async () => Response.json({ code: 'session_not_found', msg: 'Synthetic provider inconsistency' }, { status, headers: { 'X-Supabase-Api-Version': '2024-01-01' } }) })
    const response = await h.proxy(request('/protocol', jar))
    assertUnavailable(response)
    applyCookies(jar, response)
    assert.equal(jar.get(key), original)
  })
}

test('a later transient deletion cannot erase a successful rotation batch', async () => {
  const original = sessionCookie().encoded
  const jar = new Map([[key + '.0', original.slice(0, 100)], [key + '.1', original.slice(100)]])
  const h = harness({ result: { data: { user: null }, error: apiError('unexpected_failure', 500) }, batches: [
    { cookies: [
      { name: key + '.0', value: '', options: { path: '/', maxAge: 0 } },
      { name: key + '.1', value: '', options: { path: '/', maxAge: 0 } },
      { name: key, value: 'fixture-rotated-session', options: { path: '/', maxAge: 3600, sameSite: 'lax', secure: true } },
    ] },
    { cookies: [{ name: key, value: '', options: { path: '/', maxAge: 0 } }] },
  ] })
  const response = await h.proxy(request('/protocol', jar))
  assertUnavailable(response)
  applyCookies(jar, response)
  assert.deepEqual([...jar], [[key, 'fixture-rotated-session']])
  assert.equal(response.cookies.get(key).secure, true)
})

test('real proxy and callback: stale session cleanup preserves a pending PKCE exchange and owner destination', async () => {
  const verifier = 'fixture-pkce-verifier-for-pending-sign-in'
  const encodedVerifier = 'base64-' + Buffer.from(JSON.stringify(verifier)).toString('base64url')
  const oldSession = sessionCookie({ expired: true }).encoded
  const fresh = sessionCookie({ refresh: 'fixture-new-callback-refresh', suffix: '-callback' })
  const calls = []
  const transport = async (url, options = {}) => {
    const target = new URL(url)
    calls.push(target.pathname + target.search)
    if (target.pathname.endsWith('/token') && target.searchParams.get('grant_type') === 'refresh_token') {
      return Response.json({ code: 'refresh_token_not_found', msg: 'Synthetic stale session' }, { status: 400, headers: { 'X-Supabase-Api-Version': '2024-01-01' } })
    }
    if (target.pathname.endsWith('/token') && target.searchParams.get('grant_type') === 'pkce') {
      assert.deepEqual(JSON.parse(options.body), { auth_code: 'fixture-callback-code', code_verifier: verifier })
      return Response.json({ access_token: fresh.jwt, refresh_token: 'fixture-new-callback-refresh', token_type: 'bearer', expires_in: 3600, user })
    }
    if (target.pathname.endsWith('/user')) return Response.json(user)
    if (target.pathname.endsWith('/rest/v1/protocols')) {
      assert.equal(target.searchParams.get('user_id'), 'eq.' + user.id)
      return Response.json([{ id: 'fixture-owned-protocol' }])
    }
    throw new Error('Unexpected synthetic callback provider request')
  }
  const callbackPath = '/auth/callback?code=fixture-callback-code&next=%2Ftimeline%3Ffilter%3Dweight'
  const h = harness({ real: true, transport })
  const first = await h.proxy(request(callbackPath, new Map([[key, oldSession], [key + '-code-verifier', encodedVerifier]])))
  assertPass(first)
  const forwarded = new NextRequest(origin + callbackPath, { headers: { cookie: first.headers.get('x-middleware-request-cookie') ?? '' } })
  assert.equal(forwarded.cookies.get(key), undefined)
  assert.equal(forwarded.cookies.get(key + '-code-verifier')?.value, encodedVerifier)
  const callbackJar = new Map(forwarded.cookies.getAll().map(({ name, value }) => [name, value]))
  const writes = []
  const { GET } = load('../app/auth/callback/route.ts', {
    '@supabase/ssr': { ...ssr, createServerClient(url, anon, options) {
      assert.equal(url, env.NEXT_PUBLIC_SUPABASE_URL)
      assert.equal(anon, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
      return ssr.createServerClient(url, anon, { ...options, global: { fetch: transport } })
    } },
    'next/headers': { cookies: async () => ({
      getAll: () => [...callbackJar].map(([name, value]) => ({ name, value })),
      set(name, value, options) {
        writes.push({ name, value, options })
        if (!value || options.maxAge === 0) callbackJar.delete(name)
        else callbackJar.set(name, value)
      },
    }) },
  }, { process: { env }, fetch: transport })
  const response = await GET(forwarded)
  assert.equal(response.status, 307)
  assert.equal(response.headers.get('location'), origin + '/timeline?filter=weight')
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.ok(writes.some(cookie => cookie.name === key && cookie.value))
  assert.equal(callbackJar.has(key + '-code-verifier'), false)
  assert.equal(calls.filter(path => path.includes('grant_type=refresh_token')).length, 1)
  assert.equal(calls.filter(path => path.includes('grant_type=pkce')).length, 1)
})

for (const [label, sessionEntries] of [
  ['invalid alphabet', [[key, 'base64-!!!']]],
  ['invalid percent bytes', [[key, 'base64-%%%%']]],
  ['chunked invalid encoding', [[key + '.0', 'base64-!!'], [key + '.1', '!']]],
]) {
  test(`real SDK: corrupt session encoding is cleared safely before callback or refresh (${label})`, async () => {
    const verifier = 'fixture-pending-pkce-verifier'
    const jar = new Map([...sessionEntries, [key + '-code-verifier', verifier], ['preference', 'dark'], ['sb-other-auth-token', 'fixture-other-project']])
    let providerCalls = 0
    const h = harness({ real: true, transport: async () => { providerCalls++; throw new Error('Unexpected synthetic provider call for malformed encoding') } })
    const response = await h.proxy(request('/protocol', jar))
    assertLogin(response)
    applyCookies(jar, response)
    assert.deepEqual([...jar], [[key + '-code-verifier', verifier], ['preference', 'dark'], ['sb-other-auth-token', 'fixture-other-project']])
    assertLogin(await h.proxy(request('/protocol', jar)))
    assertPass(await h.proxy(request('/auth/callback?code=fixture-pending-code', jar)))
    await new Promise(resolve => setImmediate(resolve))
    assert.equal(providerCalls, 0)
    assert.deepEqual(h.logs, [])
  })
}

function sessionObject(options = {}) {
  return JSON.parse(Buffer.from(sessionCookie(options).encoded.slice('base64-'.length), 'base64url').toString())
}
function sessionEntries(value, format = 'base64') {
  const json = JSON.stringify(value)
  if (format === 'raw') return [[key, json]]
  const encoded = 'base64-' + Buffer.from(json).toString('base64url')
  if (format === 'chunked') {
    const middle = Math.floor(encoded.length / 2)
    return [[key + '.0', encoded.slice(0, middle)], [key + '.1', encoded.slice(middle)]]
  }
  return [[key, encoded]]
}
function captureSdkLogs(t) {
  const logs = []
  for (const method of ['error', 'warn']) t.mock.method(console, method, (...args) => logs.push(args.map(String).join(' ')))
  return logs
}
async function drainSdkTasks() {
  await new Promise(resolve => setImmediate(resolve))
  await new Promise(resolve => setImmediate(resolve))
}

for (const [label, fields, format] of [
  ['number', { refresh_token: 123 }, 'base64'],
  ['object', { refresh_token: { invalid: true } }, 'base64'],
  ['null', { refresh_token: null }, 'base64'],
  ['array', { refresh_token: [] }, 'base64'],
  ['empty string', { refresh_token: '' }, 'base64'],
  ['legacy raw number', { refresh_token: 123 }, 'raw'],
  ['chunked object', { refresh_token: { invalid: true } }, 'chunked'],
  ['numeric access token', { access_token: 123 }, 'base64'],
  ['empty access token', { access_token: '' }, 'base64'],
  ['string expiry', { expires_at: 'expired' }, 'base64'],
  ['null expiry', { expires_at: null }, 'base64'],
  ['array cached user', { user: [] }, 'base64'],
  ['string cached user', { user: 'fixture-invalid-user' }, 'base64'],
]) {
  test(`real SDK: malformed refresh-token/session ${label} is discarded before authentication`, async t => {
    const logs = captureSdkLogs(t)
    const session = { ...sessionObject({ expired: true }), ...fields }
    const protectedCookies = [[key + '-code-verifier', 'fixture-pending-verifier'], ['sb-other-auth-token', 'fixture-other-project'], ['preference', 'dark']]
    const jar = new Map([...sessionEntries(session, format), ...protectedCookies])
    let providerCalls = 0
    const h = harness({ real: true, transport: async () => { providerCalls++; throw new Error('Unexpected provider call for malformed stored session') } })
    const response = await h.proxy(request('/protocol', jar))
    await drainSdkTasks()
    assertLogin(response)
    for (const cookie of response.cookies.getAll()) {
      assert.equal(cookie.path, '/')
      assert.equal(cookie.sameSite, 'lax')
      assert.equal(cookie.maxAge, 0)
    }
    for (const [name, value] of Object.entries(cacheHeaders)) assert.equal(response.headers.get(name), value)
    applyCookies(jar, response)
    assert.deepEqual([...jar], protectedCookies)
    assertLogin(await h.proxy(request('/protocol', jar)))
    assertPass(await h.proxy(request('/auth/callback?code=fixture-pending-code', jar)))
    assertPass(await h.proxy(request('/privacy', jar)))
    await drainSdkTasks()
    assert.equal(providerCalls, 0)
    assert.deepEqual(logs, [])
  })
}
for (const endpoint of ['refresh', 'user']) {
  test(`real SDK: malformed HTTP200 JSON at ${endpoint} is temporary and never logs response credentials`, async t => {
    const sentinel = 's3cr3t'
    const logs = captureSdkLogs(t)
    let now = Date.now()
    t.mock.method(Date, 'now', () => now)
    const original = sessionCookie({ expired: endpoint === 'refresh' }).encoded
    const jar = new Map([[key, original]])
    const fresh = sessionCookie({ refresh: 'fixture-recovered-refresh', suffix: '-recovered' })
    let failed = true, malformedCalls = 0
    const h = harness({ real: true, transport: async url => {
      const path = new URL(url).pathname
      if (failed && path.endsWith(endpoint === 'refresh' ? '/token' : '/user')) {
        malformedCalls++
        // Move only the test clock beyond auth-js's retry budget. Real parsing,
        // error propagation, initial-session listeners and console calls still run.
        now += 31_000
        return new Response(sentinel, { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      if (path.endsWith('/token')) return Response.json({ access_token: fresh.jwt, refresh_token: 'fixture-recovered-refresh', token_type: 'bearer', expires_in: 3600, user })
      assert.ok(path.endsWith('/user'))
      return Response.json(user)
    } })
    const blocked = await h.proxy(request('/protocol', jar))
    await drainSdkTasks()
    assertUnavailable(blocked)
    assert.doesNotMatch(await blocked.text(), new RegExp(sentinel))
    applyCookies(jar, blocked)
    assert.equal(jar.get(key), original)
    const publicResponse = await h.proxy(request('/privacy', jar))
    await drainSdkTasks()
    assertPass(publicResponse)
    applyCookies(jar, publicResponse)
    assert.equal(jar.get(key), original)
    failed = false
    const recovered = await h.proxy(request('/protocol', jar))
    await drainSdkTasks()
    assertPass(recovered)
    applyCookies(jar, recovered)
    if (endpoint === 'refresh') assert.notEqual(jar.get(key), original)
    else assert.equal(jar.get(key), original)
    assert.ok(malformedCalls >= 2)
    assert.doesNotMatch([...logs, ...h.logs.flat().map(String)].join('\n'), new RegExp(sentinel))
  })
}

for (const format of ['base64', 'chunked', 'raw']) {
  test(`real SDK: valid opaque refresh tokens remain accepted in ${format} storage`, async () => {
    const refresh = 'fixture:opaque-refresh+/=_-'
    const jar = new Map(sessionEntries(sessionObject({ expired: true, refresh }), format))
    const fresh = sessionCookie({ refresh: 'fixture-rotated-opaque', suffix: '-opaque' })
    let refreshes = 0
    const h = harness({ real: true, transport: async (url, options = {}) => {
      if (new URL(url).pathname.endsWith('/token')) {
        refreshes++
        assert.equal(JSON.parse(options.body).refresh_token, refresh)
        return Response.json({ access_token: fresh.jwt, refresh_token: 'fixture-rotated-opaque', expires_in: 3600, token_type: 'bearer', user })
      }
      assert.ok(new URL(url).pathname.endsWith('/user'))
      return Response.json(user)
    } })
    const response = await h.proxy(request('/protocol', jar))
    assertPass(response)
    applyCookies(jar, response)
    assert.ok(jar.get(key))
    assert.equal(refreshes, 1)
  })
}

for (const cachedUser of [undefined, null, {}]) {
  test(`real SDK: valid session tolerates optional cached user ${JSON.stringify(cachedUser)}`, async () => {
    const session = sessionObject()
    if (cachedUser === undefined) delete session.user
    else session.user = cachedUser
    delete session.token_type
    delete session.expires_in
    let userCalls = 0
    const h = harness({ real: true, transport: async url => {
      assert.ok(new URL(url).pathname.endsWith('/user'))
      userCalls++
      return Response.json({ user })
    } })
    assertPass(await h.proxy(request('/protocol', new Map(sessionEntries(session)))))
    // The pinned SDK also hydrates a missing/null cached user before getUser.
    assert.ok(userCalls >= 1)
  })
}

for (const [label, endpoint, makeBody] of [
  ['null refresh payload', 'refresh', () => null],
  ['string refresh payload', 'refresh', () => 's3cr3t'],
  ['array refresh payload', 'refresh', () => ['s3cr3t']],
  ['numeric access token', 'refresh', valid => ({ ...valid, access_token: 123 })],
  ['empty refresh token', 'refresh', valid => ({ ...valid, refresh_token: '' })],
  ['string expiry duration', 'refresh', valid => ({ ...valid, expires_in: '3600' })],
  ['zero expiry duration', 'refresh', valid => ({ ...valid, expires_in: 0 })],
  ['string absolute expiry', 'refresh', valid => ({ ...valid, expires_at: 'later' })],
  ['array refresh user', 'refresh', valid => ({ ...valid, user: [] })],
  ['null user payload', 'user', () => null],
  ['string user payload', 'user', () => 's3cr3t'],
  ['array user payload', 'user', () => ['s3cr3t']],
  ['numeric verified user id', 'user', () => ({ id: 123 })],
  ['empty enveloped user id', 'user', () => ({ user: { id: '' } })],
]) {
  test(`real SDK: malformed HTTP200 shape ${label} fails closed without losing the session`, async t => {
    const logs = captureSdkLogs(t)
    let now = Date.now()
    t.mock.method(Date, 'now', () => now)
    const original = sessionCookie({ expired: endpoint === 'refresh' }).encoded
    const jar = new Map([[key, original], [key + '-code-verifier', 'fixture-pending-verifier'], ['preference', 'dark']])
    const before = [...jar]
    const fresh = sessionCookie({ refresh: 'fixture-recovered-refresh', suffix: '-shape' })
    const valid = { access_token: fresh.jwt, refresh_token: 'fixture-recovered-refresh', token_type: 'bearer', expires_in: 3600, user }
    let failed = true
    const h = harness({ real: true, transport: async url => {
      const path = new URL(url).pathname
      if (failed && path.endsWith(endpoint === 'refresh' ? '/token' : '/user')) {
        now += 31_000
        return Response.json(makeBody(valid))
      }
      if (path.endsWith('/token')) return Response.json(valid)
      assert.ok(path.endsWith('/user'))
      return Response.json(user)
    } })
    const blocked = await h.proxy(request('/protocol', jar))
    await drainSdkTasks()
    assertUnavailable(blocked)
    applyCookies(jar, blocked)
    assert.deepEqual([...jar], before)
    failed = false
    assertPass(await h.proxy(request('/protocol', jar)))
    await drainSdkTasks()
    assert.doesNotMatch([...logs, ...h.logs.flat().map(String)].join('\n'), /s3cr3t/)
  })
}

test('real SDK: valid refresh response preserves optional user and computed expiry compatibility', async () => {
  const jar = new Map([[key, sessionCookie({ expired: true }).encoded]])
  const fresh = sessionCookie({ refresh: 'fixture-optional-fields', suffix: '-optional' })
  const h = harness({ real: true, transport: async url => {
    if (new URL(url).pathname.endsWith('/token')) return Response.json({ access_token: fresh.jwt, refresh_token: 'fixture-optional-fields', expires_in: 3600, token_type: 'bearer' })
    assert.ok(new URL(url).pathname.endsWith('/user'))
    return Response.json({ user })
  } })
  const response = await h.proxy(request('/protocol', jar))
  assertPass(response)
  applyCookies(jar, response)
  assert.ok(jar.get(key))
  for (const [name, value] of Object.entries(cacheHeaders)) assert.equal(response.headers.get(name), value)
})

test('successful-response validation is scoped to auth endpoints and preserves the readable original response', async () => {
  const fresh = sessionCookie()
  const cases = [
    ['https://other.example/auth/v1/user', 'fixture non-JSON response'],
    ['https://fixture.supabase.co/rest/v1/protocols', 'fixture non-JSON response'],
    ['https://fixture.supabase.co/auth/v1/user-extra', 'fixture non-JSON response'],
    ['https://fixture.supabase.co/auth/v1/token?grant_type=password', 'fixture non-JSON response'],
    ['https://fixture.supabase.co/auth/v1/user', JSON.stringify({ user })],
    ['https://fixture.supabase.co/auth/v1/token?grant_type=refresh_token', JSON.stringify({ access_token: fresh.jwt, refresh_token: 'fixture-valid-opaque', expires_in: 3600, user })],
  ]
  for (const [url, body] of cases) {
    const original = new Response(body, { status: 200, headers: { 'Content-Type': 'application/json', 'X-Fixture-Response': 'preserved' } })
    let wrappedFetch
    const { proxy } = load('../proxy.ts', {
      '@supabase/ssr': { ...ssr, createServerClient(_url, _key, options) {
        wrappedFetch = options.global.fetch
        return { auth: { getUser: async () => ({ data: { user }, error: null }) } }
      } },
    }, { process: { env }, fetch: async () => original })
    assertPass(await proxy(request('/protocol')))
    const received = await wrappedFetch(new Request(url))
    assert.equal(received, original)
    assert.equal(received.bodyUsed, false)
    assert.equal(received.headers.get('x-fixture-response'), 'preserved')
    assert.equal(await received.text(), body)
  }
})
