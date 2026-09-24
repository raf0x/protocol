import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { createBrowserClient, createServerClient } from '@supabase/ssr'

const require = createRequire(import.meta.url)
function load(path, mocks = {}, cache = new Map()) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const module = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name in mocks) return mocks[name]
    if (!name.startsWith('.')) return require(name)
    return load(new URL(name + (existsSync(new URL(name + '.ts', url)) ? '.ts' : ''), url), mocks, cache)
  }, module, module.exports)
  cache.set(url.href, module.exports)
  return module.exports
}
const { safeAuthReturnPath } = load('../lib/authRedirect.ts')
const { postAuthDestination } = load('../lib/authPostAuth.ts')
const { normalizeEmail, normalizeOtp, validOtp, emailAuthError, isAuthRateLimit, EMAIL_OTP_LENGTH, EMAIL_RESEND_SECONDS } = load('../lib/emailOtp.ts')

function ownership(data = [], error = null, throws = false) {
  const calls = []
  const client = { from(table) {
    calls.push(['from', table])
    const query = {
      select(value) { calls.push(['select', value]); return this },
      eq(key, value) { calls.push(['eq', key, value]); return this },
      limit(value) { calls.push(['limit', value]); return this },
      abortSignal(value) { assert.ok(value instanceof AbortSignal); return this },
      then(resolve, reject) { return (throws ? Promise.reject(new Error('offline')) : Promise.resolve({ data, error })).then(resolve, reject) },
    }
    return query
  } }
  return { client, calls }
}

for (const path of ['/protocol', '/timeline?filter=weight#latest', '/protocol/manage?new=1', '/profile', '/share/safe-id']) {
  test(`preserves valid same-origin destination ${path}`, () => assert.equal(safeAuthReturnPath(path), path))
}
for (const path of [null, '', 'https://evil.example', '//evil.example', '/\\evil.example', 'javascript:alert(1)', '/auth/login', '/auth', '/AUTH/callback', '/%61uth/login', '/foo/../auth/login', '/foo/..//evil.example', '/%2fevil.example', '/%252fevil.example', '/%5cevil.example', '/%255cevil.example', '/\nevil.example', '/%0a/evil.example', '/%250d/evil.example', '/bad%xx', '/bad%', ' /protocol', '/protocol?bad=%00', '/%E0%A4%A']) {
  test(`rejects unsafe destination ${JSON.stringify(path)}`, () => assert.equal(safeAuthReturnPath(path), '/protocol'))
}
test('even an unsafe fallback cannot become an external redirect', () => assert.equal(safeAuthReturnPath(null, '//evil.example'), '/protocol'))

test('empty authenticated ownership routes directly to MPP-015 onboarding', async () => {
  const { client, calls } = ownership([])
  assert.equal(await postAuthDestination(client, 'owner', '/protocol'), '/onboarding')
  assert.deepEqual(calls, [['from', 'protocols'], ['select', 'id'], ['eq', 'user_id', 'owner'], ['limit', 1]])
})
for (const status of ['planned', 'scheduled', 'active', 'completed', 'paused', 'archived']) {
  test(`${status} ownership preserves the existing user's destination`, async () => {
    const { client, calls } = ownership([{ id: 'p', status }])
    assert.equal(await postAuthDestination(client, 'owner', '/timeline?filter=weight'), '/timeline?filter=weight')
    assert.deepEqual(calls.filter(call => call[0] === 'eq'), [['eq', 'user_id', 'owner']])
  })
}
for (const [data, error, throws] of [[null, { message: 'denied' }, false], [[], { message: 'failed' }, false], [null, null, false], [[], null, true]]) {
  test(`ownership failure never means empty account (${JSON.stringify([data, error, throws])})`, async () => {
    assert.equal(await postAuthDestination(ownership(data, error, throws).client, 'owner'), '/protocol')
  })
}
test('email trim preserves local-part case and plus addressing', () => assert.equal(normalizeEmail('  Person+tag@Example.com \n'), 'Person+tag@Example.com'))
test('leading zeroes and pasted whitespace remain a numeric string', () => {
  assert.equal(EMAIL_OTP_LENGTH, 6); assert.equal(EMAIL_RESEND_SECONDS, 60)
  assert.equal(normalizeOtp(' 01 02\t03\n'), '010203'); assert.ok(validOtp(normalizeOtp(' 01 02\t03\n')))
  for (const value of ['12345', '1234567', '1x23456', '１２３４５６']) assert.equal(validOtp(value), false)
})
test('provider errors never expose account existence or internal messages', () => {
  const a = emailAuthError({ code: 'user_not_found', message: 'No such account' }, 'send')
  const b = emailAuthError({ code: 'user_already_exists', message: 'Account exists' }, 'send')
  assert.equal(a, b); assert.doesNotMatch(a, /account|exists|delivered|sent/)
  assert.match(emailAuthError({ code: 'otp_expired' }, 'verify'), /Request a new code/)
  assert.match(emailAuthError({ code: 'invalid_credentials' }, 'verify'), /couldn’t verify/)
  assert.ok(isAuthRateLimit({ status: 429 })); assert.ok(isAuthRateLimit({ code: 'over_email_send_rate_limit' }))
  assert.match(emailAuthError({ status: 429 }, 'send'), /timer/)
})

async function callback(query, { data = [{ id: 'p' }], authError = null, user = { id: 'owner' }, redirectType = null } = {}) {
  const owned = ownership(data), calls = [], writes = []
  let cookieAdapter
  const auth = {
    async verifyOtp(args) { calls.push(['verify', args]); if (!authError) cookieAdapter.setAll([{ name: 'fixture-session', value: 'test-only', options: { path: '/', sameSite: 'lax', secure: true } }]); return { error: authError } },
    async exchangeCodeForSession(code) { calls.push(['exchange', code]); if (!authError) cookieAdapter.setAll([{ name: 'fixture-session', value: 'test-only', options: { path: '/', sameSite: 'lax', secure: true } }]); return { data: { redirectType }, error: authError } },
    async getUser() { return { data: { user }, error: null } },
  }
  const { GET } = load('../app/auth/callback/route.ts', {
    '@supabase/ssr': { createServerClient(_url, _key, options) { cookieAdapter = options.cookies; assert.deepEqual(cookieAdapter.getAll(), []); return { ...owned.client, auth } } },
    'next/headers': { cookies: async () => ({ getAll: () => [], set: (...args) => writes.push(args) }) },
  })
  const response = await GET({ url: `https://app.example/auth/callback?${query}` })
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer')
  return { location: response.headers.get('location'), calls, writes, ownershipCalls: owned.calls }
}
for (const type of ['signup', 'magiclink', 'email']) {
  test(`outstanding ${type} link verifies through the existing callback and shares onboarding routing`, async () => {
    const result = await callback(`token_hash=fixture-hash&type=${type}`, { data: [] })
    assert.equal(result.location, 'https://app.example/onboarding')
    assert.deepEqual(result.calls, [['verify', { token_hash: 'fixture-hash', type }]])
    assert.equal(result.writes.length, 1)
    assert.deepEqual(result.writes[0][2], { path: '/', sameSite: 'lax', secure: true })
  })
}
for (const type of ['recovery', 'invite', 'email_change']) {
  test(`${type} action retains its existing destination, even with zero protocols`, async () => {
    const result = await callback(`token_hash=fixture-hash&type=${type}&next=/profile`, { data: [] })
    assert.equal(result.location, 'https://app.example/profile'); assert.equal(result.ownershipCalls.length, 0)
    assert.equal(result.calls[0][1].type, type)
  })
}
test('OAuth PKCE code exchange keeps established users on their safe next destination', async () => {
  const result = await callback('code=fixture-code&next=/timeline?filter=weight')
  assert.equal(result.location, 'https://app.example/timeline?filter=weight')
  assert.deepEqual(result.calls, [['exchange', 'fixture-code']]); assert.equal(result.writes.length, 1)
})
test('OAuth new account reaches onboarding; PKCE recovery intent stays on its action destination', async () => {
  assert.equal((await callback('code=fixture-code', { data: [] })).location, 'https://app.example/onboarding')
  const result = await callback('code=fixture-code&next=/profile', { data: [], redirectType: 'recovery' })
  assert.equal(result.location, 'https://app.example/profile'); assert.equal(result.ownershipCalls.length, 0)
})
test('invalid callback cannot reuse an existing session as successful verification', async () => {
  const result = await callback('token_hash=invalid&type=email&next=/timeline', { authError: { code: 'otp_expired' } })
  assert.equal(result.location, 'https://app.example/auth/login?next=%2Ftimeline&error=link')
  assert.equal(result.ownershipCalls.length, 0)
})
test('callback rejects unsupported token types and unsafe next targets', async () => {
  const result = await callback('token_hash=fixture-hash&type=reauthentication&next=//evil.example')
  assert.equal(result.calls.length, 0); assert.equal(result.location, 'https://app.example/auth/login?next=%2Fprotocol&error=link')
  assert.equal((await callback('code=fixture-code&next=/%252fevil.example')).location, 'https://app.example/protocol')
})
test('callback without credentials still supports an existing authenticated session', async () => {
  assert.equal((await callback('next=/profile')).location, 'https://app.example/profile')
  assert.match((await callback('next=/profile', { user: null })).location, /\/auth\/login\?/)
})

test('installed Supabase SDK saves verified OTP session in SSR cookies readable by a server client', async () => {
  const jar = new Map(), calls = [], user = { id: 'fixture-owner', email: 'fixture@example.com' }
  const now = Math.floor(Date.now() / 1000)
  const jwt = [ { alg: 'HS256', typ: 'JWT' }, { sub: user.id, exp: now + 3600, iat: now, aud: 'authenticated', role: 'authenticated' } ].map(part => Buffer.from(JSON.stringify(part)).toString('base64url')).join('.') + '.fixture'
  const transport = async (url, options = {}) => {
    const path = new URL(url).pathname
    const body = options.body ? JSON.parse(options.body) : null
    calls.push({ path, body })
    if (path.endsWith('/otp')) return Response.json({})
    if (path.endsWith('/verify')) return Response.json({ access_token: jwt, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user })
    if (path.endsWith('/user')) {
      assert.equal(new Headers(options.headers).get('authorization'), `Bearer ${jwt}`)
      return Response.json(user)
    }
    throw new Error('Unexpected fixture request')
  }
  const cookies = {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: changes => changes.forEach(({ name, value }) => value ? jar.set(name, value) : jar.delete(name)),
  }
  const client = createBrowserClient('https://fixture.supabase.co', 'fixture-anon', { cookies, isSingleton: false, global: { fetch: transport }, auth: { autoRefreshToken: false, detectSessionInUrl: false } })
  assert.equal((await client.auth.signInWithOtp({ email: user.email, options: { shouldCreateUser: true } })).error, null)
  assert.equal(calls.filter(c => c.path.endsWith('/otp')).length, 1)
  assert.equal(calls.find(c => c.path.endsWith('/otp')).body.create_user, true)
  assert.ok(calls.find(c => c.path.endsWith('/otp')).body.code_challenge)
  const verified = await client.auth.verifyOtp({ email: user.email, token: '010203', type: 'email' })
  assert.equal(verified.error, null); assert.equal(verified.data.session.user.id, user.id)
  assert.ok([...jar.keys()].some(name => name.startsWith('sb-fixture-auth-token')))
  const server = createServerClient('https://fixture.supabase.co', 'fixture-anon', { cookies, global: { fetch: transport } })
  assert.equal((await server.auth.getUser()).data.user.id, user.id)
  assert.deepEqual(calls.find(c => c.path.endsWith('/verify')).body.token, '010203')
  await client.auth.stopAutoRefresh(); await server.auth.stopAutoRefresh()
})
