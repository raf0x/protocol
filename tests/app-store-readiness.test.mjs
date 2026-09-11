import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const manifest = JSON.parse(read('../public/manifest.json'))
const sw = read('../public/sw.js')
const layout = read('../app/layout.tsx')
const shell = read('../app/mobile-app.css')
const proxy = read('../proxy.ts')
const login = read('../app/auth/login/page.tsx')
const callback = read('../app/auth/callback/route.ts')
const offline = read('../components/app/OfflineBanner.tsx')
const lifecycle = read('../components/app/PwaLifecycle.tsx')
const health = read('../components/health/HealthDashboard.tsx')
const analystRoute = read('../app/api/health-analyst/route.ts')
const reportRoute = read('../app/api/health-report/route.ts')
const reportCss = read('../app/health/report/report.module.css')
const pushRoute = read('../app/api/push/route.ts')
const cronRoute = read('../app/api/cron/route.ts')
const pushConfig = read('../lib/pushConfig.ts')
const privacy = read('../app/privacy/page.tsx')
const errorPage = read('../app/error.tsx')

function loadTs(path) {
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const result = { exports: {} }
  new Function('module', 'exports', code)(result, result.exports)
  return result.exports
}

test('manifest uses current app identity and authenticated start route', () => {
  assert.equal(manifest.name, 'MyPepProtocol'); assert.equal(manifest.start_url, '/protocol'); assert.equal(manifest.id, '/protocol')
})
test('manifest is standalone, scoped and has required install icon sizes', () => {
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.scope, '/'); assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512'])
})
test('manifest declares maskable icon purpose without forcing orientation', () => {
  assert.ok(manifest.icons.every(icon => icon.purpose.includes('maskable'))); assert.equal('orientation' in manifest, false)
})
test('install metadata uses MyPepProtocol and viewport fit cover', () => {
  assert.match(layout, /applicationName: 'MyPepProtocol'/); assert.match(layout, /viewportFit: 'cover'/); assert.match(layout, /appleWebApp/)
})
test('service worker never caches fetched authenticated responses', () => {
  assert.doesNotMatch(sw, /cache\.put\(request/); assert.doesNotMatch(sw, /STATIC_ASSETS.*['"]\/['"]/s)
})
test('service worker uses a static offline fallback only for navigation', () => {
  assert.match(sw, /request\.mode !== 'navigate'/); assert.match(sw, /caches\.match\('\/offline'\)/)
})
test('service worker removes obsolete cache generations', () => {
  assert.match(sw, /names\.filter\(name => name !== CACHE_NAME\)/)
})
test('service worker registration bypasses HTTP cache and checks for updates', () => {
  assert.match(lifecycle, /updateViaCache: 'none'/); assert.match(lifecycle, /registration\?\.update/)
})
test('stale chunk recovery is bounded to one session attempt', () => {
  assert.match(lifecycle, /ChunkLoadError/); assert.match(lifecycle, /sessionStorage\.getItem\(CHUNK_RECOVERY_KEY\)/)
})
test('offline warning states that writes cannot be saved', () => {
  assert.match(offline, /role="status"/); assert.match(offline, /cannot be saved until you reconnect/)
})
test('deep-link redirect carries the original path and query', () => {
  assert.match(proxy, /searchParams\.set\('next'/); assert.match(proxy, /request\.nextUrl\.search/)
})
test('authentication return paths reject external and auth-loop targets', () => {
  const { safeAuthReturnPath } = loadTs('../lib/authRedirect.ts')
  assert.equal(safeAuthReturnPath('https://evil.example/path'), '/protocol')
  assert.equal(safeAuthReturnPath('//evil.example/path'), '/protocol')
  assert.equal(safeAuthReturnPath('/auth/login'), '/protocol')
  assert.equal(safeAuthReturnPath('/timeline?filter=weight'), '/timeline?filter=weight')
})
test('login and callback both use validated return paths', () => {
  assert.match(login, /safeAuthReturnPath/); assert.match(callback, /safeAuthReturnPath/); assert.match(login, /router\.replace\(returnPath\)/)
})
test('session checks have a bounded loading fallback and accessible status', () => {
  assert.match(login, /setTimeout/); assert.match(login, /role="status"/); assert.match(login, /Checking your session/)
})
test('safe areas and mobile bottom navigation reserve content space', () => {
  assert.match(shell, /padding-top: env\(safe-area-inset-top, 0px\)/); assert.match(shell, /padding-bottom: calc\(var\(--app-nav-height\).*safe-area-inset-bottom/s)
})
test('bottom sheet is dynamic-viewport and keyboard-scroll friendly', () => {
  assert.match(shell, /max-height: min\(85dvh/); assert.match(shell, /overscroll-behavior: contain/); assert.match(shell, /scroll-padding-bottom/)
})
test('Health Analyst view avoids the Labs loading request', () => {
  assert.ok(health.indexOf('if (analyst) return') < health.indexOf('loadLabs()'))
})
test('AI route is authenticated, owner-scoped through user context and request-capped', () => {
  assert.match(analystRoute, /getUser\(\)/); assert.match(analystRoute, /loadHealthAnalystContext\(supabase, user\.id/); assert.match(analystRoute, /> 12_000/)
})
test('report route is authenticated, owner-scoped and request-capped', () => {
  assert.match(reportRoute, /getUser\(\)/); assert.match(reportRoute, /createDoctorReport\(supabase, user\.id/); assert.match(reportRoute, /> 2_000/)
})
test('print layout hides navigation and export controls', () => {
  assert.match(reportCss, /@media print/); assert.match(reportCss, /:global\(\.app-tab-bar\).*\.exportBar.*display: none/s)
})
test('report has explicit narrow mobile layout and readable print background', () => {
  assert.match(reportCss, /@media \(max-width: 520px\)/); assert.match(reportCss, /background: #fff/)
})
test('only intentionally public keys appear in client source', () => {
  const clientSources = [layout, login, health, offline, lifecycle].join('\n')
  assert.doesNotMatch(clientSources, /SUPABASE_SERVICE_ROLE_KEY|VAPID_PRIVATE_KEY|OPENAI_API_KEY|CRON_SECRET/)
})
test('push VAPID setup is lazy, validated and never runs at module import', () => {
  assert.match(pushConfig, /configureWebPush/); assert.match(pushConfig, /\^\(mailto:\|https\?:\\\/\\\/\)/)
  assert.doesNotMatch(pushRoute, /^webpush\.setVapidDetails/m); assert.doesNotMatch(cronRoute, /^webpush\.setVapidDetails/m)
})
test('push subscription API authenticates before user-scoped throttling', () => {
  assert.ok(pushRoute.indexOf('await getAuthenticatedUser') < pushRoute.indexOf("rateLimit('push-subscribe:' + user.id"))
})
test('push subscription payload requires endpoint and encryption keys', () => {
  for (const field of ['push.endpoint', 'push.keys?.p256dh', 'push.keys?.auth']) assert.ok(pushRoute.includes(field))
})
test('missing feature configuration becomes controlled unavailable responses', () => {
  assert.match(pushRoute, /status: 503/); assert.match(cronRoute, /status: 503/); assert.match(analystRoute, /AnalystConfigurationError/)
})
test('privacy surface discloses labs, AI, reports, push and lack of in-app deletion', () => {
  for (const text of ['Lab panels', 'OpenAI', 'generated PDF', 'Push subscription', 'in-app account deletion control is not currently available']) assert.ok(privacy.includes(text))
})
test('error state is recoverable, accessible sized and avoids raw logging', () => {
  assert.match(errorPage, /Try again/); assert.match(errorPage, /minHeight:'44px'/); assert.doesNotMatch(errorPage, /console\.error/)
})
test('primary motion has a reduced-motion fallback', () => {
  assert.match(shell, /prefers-reduced-motion: reduce/)
})
test('readiness document contains the required iPhone widths and packaging decision', () => {
  const audit = read('../docs/app-store-readiness.md')
  for (const width of ['390px', '393px', '430px']) assert.ok(audit.includes(width))
  assert.match(audit, /Ready for iOS packaging\?\s+\n+No\./i)
})
