import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
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
const profile = read('../app/profile/page.tsx')
const navigation = read('../components/app/BottomTabBar.tsx')
const appShell = read('../components/app/AppShell.tsx')
const demo = read('../app/demo/page.tsx')
const releaseSource = read('../lib/appRelease.ts')
const deleteAccount = read('../components/profile/DeleteAccount.tsx')
const aiSettings = read('../components/profile/AiProcessingSettings.tsx')
const installHint = read('../components/app/InstallHint.tsx')

function repositoryPath(path) { return new URL(path, import.meta.url) }
function pngInfo(path) {
  const bytes = readFileSync(repositoryPath(path))
  assert.equal(bytes.subarray(1, 4).toString('ascii'), 'PNG')
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] }
}

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
  assert.equal(manifest.display, 'standalone'); assert.equal(manifest.scope, '/'); assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512', '192x192', '512x512'])
})
test('manifest separates regular and maskable icon purposes without forcing orientation', () => {
  assert.deepEqual(manifest.icons.map(icon => icon.purpose), ['any', 'any', 'maskable', 'maskable']); assert.equal('orientation' in manifest, false)
})
test('install metadata uses MyPepProtocol and viewport fit cover', () => {
  assert.match(layout, /applicationName: 'MyPepProtocol'/); assert.match(layout, /viewportFit: 'cover'/); assert.match(layout, /appleWebApp/)
})
test('manifest icon references exist and match their declared PNG dimensions', () => {
  for (const icon of manifest.icons) {
    const relative = `../public${icon.src}`
    assert.ok(existsSync(repositoryPath(relative)), `${icon.src} should exist`)
    const [width, height] = icon.sizes.split('x').map(Number)
    assert.deepEqual(pngInfo(relative), { width, height, colorType: 2 })
  }
})
test('Apple touch and App Store source icons are exact opaque RGB exports', () => {
  assert.deepEqual(pngInfo('../public/apple-touch-icon.png'), { width: 180, height: 180, colorType: 2 })
  assert.deepEqual(pngInfo('../public/app-store-icon-1024.png'), { width: 1024, height: 1024, colorType: 2 })
  assert.match(layout, /apple-touch-icon\.png/); assert.match(layout, /180x180/)
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
  assert.ok(pushRoute.indexOf('await getAuthenticatedUser') < pushRoute.indexOf("checkDurableRateLimit(supabase, user.id, 'push-subscribe')"))
})
test('push subscription payload requires endpoint and encryption keys', () => {
  for (const field of ['push.endpoint', 'push.keys?.p256dh', 'push.keys?.auth']) assert.ok(pushRoute.includes(field))
})
test('missing feature configuration becomes controlled unavailable responses', () => {
  assert.match(pushRoute, /status: 503/); assert.match(cronRoute, /status: 503/); assert.match(analystRoute, /AnalystConfigurationError/)
})
test('privacy surface discloses labs, AI, reports, push and in-app deletion', () => {
  for (const text of ['Lab panels', 'OpenAI', 'generated PDF', 'Push subscription', 'permanently delete your account']) assert.ok(privacy.includes(text))
})
test('error state is recoverable, accessible sized and avoids raw logging', () => {
  assert.match(errorPage, /Try again/); assert.match(errorPage, /minHeight:'44px'/); assert.doesNotMatch(errorPage, /console\.error/)
})
test('primary motion has a reduced-motion fallback', () => {
  assert.match(shell, /prefers-reduced-motion: reduce/)
})
test('public release identifier is short, sanitized and rendered only as a QA fingerprint', () => {
  const { publicReleaseIdentifier } = loadTs('../lib/appRelease.ts')
  assert.equal(publicReleaseIdentifier({ VERCEL_GIT_COMMIT_SHA: 'abc123<script-secret>' }), 'abc123script')
  assert.equal(publicReleaseIdentifier({}), 'local')
  assert.match(layout, /data-app-release=\{publicReleaseIdentifier\(\)\}/)
  assert.doesNotMatch(releaseSource, /SUPABASE|OPENAI|PRIVATE_KEY|CRON_SECRET/)
})
test('public demo is explicitly fictional, uses no account data client and bypasses the authenticated shell', () => {
  assert.match(demo, /data-demo-fixture="fictional"/); assert.match(demo, /Fictional demo data/)
  assert.doesNotMatch(demo, /createClient|supabase|\.from\(|fetch\(/i)
  assert.match(appShell, /path\.startsWith\('\/demo'\)/)
})
test('account deletion and AI consent settings have labelled accessible regions and status feedback', () => {
  assert.match(deleteAccount, /aria-labelledby="delete-account-heading"/); assert.match(deleteAccount, /htmlFor="delete-account-confirmation"/); assert.match(deleteAccount, /confirmation !== 'DELETE'/)
  assert.match(aiSettings, /aria-labelledby="ai-settings-heading"/); assert.match(aiSettings, /role="status"/); assert.match(aiSettings, /Revoke/)
})
test('privacy and support links are present in public and authenticated surfaces', () => {
  assert.match(privacy, /privacy@mypepprotocol\.app/); assert.match(navigation, /\/privacy/); assert.match(navigation, /mailto:privacy@mypepprotocol\.app/)
  assert.match(profile, /Privacy policy/); assert.match(profile, /Privacy & support/)
})
test('installed-mode detection supports display-mode and the iOS standalone flag', () => {
  assert.match(installHint, /display-mode: standalone/); assert.match(installHint, /navigator as Navigator.*standalone/)
})
test('App Store V1 push decision is explicitly deferred while implementation remains available', () => {
  assert.match(releaseSource, /APP_STORE_V1_PUSH_ENABLED = false/); assert.match(profile, /APP_STORE_V1_PUSH_ENABLED/); assert.match(profile, /Coming after launch/)
  assert.match(pushRoute, /export async function POST/); assert.match(cronRoute, /export async function GET/)
})
test('iOS QA, screenshot, metadata, privacy and push decision documents are present', () => {
  for (const path of ['../docs/ios-device-qa-v1.md', '../docs/ios-assets-and-screenshots.md', '../docs/app-store-metadata-draft.md', '../docs/app-privacy-draft.md', '../docs/push-v1-decision.md']) assert.ok(existsSync(repositoryPath(path)), `${path} should exist`)
  const qa = read('../docs/ios-device-qa-v1.md'); for (const width of ['390px', '393px', '430px']) assert.match(qa, new RegExp(width))
  assert.match(read('../docs/ios-assets-and-screenshots.md'), /fictional reviewer persona/); assert.match(read('../docs/app-privacy-draft.md'), /Used for tracking/)
})
test('screenshot and demo fixtures are fictional and contain no known production identity', () => {
  const fixtures = demo + read('../docs/ios-assets-and-screenshots.md')
  assert.match(fixtures, /fictional/i); assert.doesNotMatch(demo, /Rafael|41266062-c8a7-4a52-aa9b-c1fb96d1c483/i)
})
test('native packaging is not introduced before the dedicated phase', () => {
  const packageJson = read('../package.json')
  assert.doesNotMatch(packageJson, /capacitor|cordova/i)
  assert.equal(existsSync(repositoryPath('../ios')), false)
  assert.equal(existsSync(repositoryPath('../capacitor.config.ts')), false)
})
test('readiness document contains the required iPhone widths and packaging decision', () => {
  const audit = read('../docs/app-store-readiness.md')
  for (const width of ['390px', '393px', '430px']) assert.ok(audit.includes(width))
  assert.match(audit, /Ready for iOS packaging\?\s+\n+No\./i)
})
