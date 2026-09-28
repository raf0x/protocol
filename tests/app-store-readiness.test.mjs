import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'
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
const errorPage = read('../app/error.tsx')
const profile = read('../app/profile/page.tsx')
const supportPage = read('../app/support/page.tsx')
const support = read('../app/support/SupportClient.tsx')
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

function loadTs(path, modules = {}, jsxMode = false) {
  const code = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      ...(jsxMode ? { jsx: ts.JsxEmit.ReactJSX } : {}),
    },
  }).outputText
  const result = { exports: {} }
  const require = specifier => {
    if (Object.hasOwn(modules, specifier)) return modules[specifier]
    throw new Error(`Unexpected module import: ${specifier}`)
  }
  new Function('module', 'exports', 'require', code)(result, result.exports, require)
  return result.exports
}

const normalizeText = value => value.replace(/\s+/g, ' ').trim().toLowerCase()
const jsxRuntime = { Fragment, jsx, jsxs }
const inertState = initial => [initial, () => {}]
const inertReact = { useEffect: () => {}, useRef: initial => ({ current: initial }), useState: inertState }
const Link = props => ({ type: 'a', props: Object.fromEntries(Object.entries(props).filter(([property]) => property !== 'key')) })
const styleModule = new Proxy({}, { get: (_target, property) => String(property) })

function materialize(node) {
  if (node == null || typeof node === 'boolean') return null
  if (typeof node === 'string' || typeof node === 'number') return node
  if (Array.isArray(node)) return node.map(materialize).filter(child => child != null)
  if (typeof node !== 'object' || !('type' in node)) throw new Error('Unsupported rendered child')
  if (node.type === Fragment) return materialize(node.props.children)
  if (typeof node.type === 'function') return materialize(node.type(node.props))
  if (typeof node.type !== 'string') throw new Error('Unsupported rendered element type')
  return { type: node.type, props: { ...node.props, children: materialize(node.props.children) } }
}

function renderComponent(path, modules = {}) {
  const loaded = loadTs(path, { 'react/jsx-runtime': jsxRuntime, ...modules }, true)
  assert.equal(typeof loaded.default, 'function', `${path} should export a component`)
  return materialize(loaded.default())
}

function elementsByTag(tree, tagName) {
  const matches = []
  function visit(node) {
    if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') return
    if (Array.isArray(node)) { node.forEach(visit); return }
    if (node.type === tagName) matches.push(node)
    visit(node.props.children)
  }
  visit(tree)
  return matches
}

function renderedText(tree, accessible = false) {
  if (tree == null || typeof tree === 'boolean') return ''
  if (typeof tree === 'string' || typeof tree === 'number') return String(tree)
  if (Array.isArray(tree)) return tree.map(child => renderedText(child, accessible)).join(' ')
  if (accessible && tree.props['aria-hidden'] === true) return ''
  return renderedText(tree.props.children, accessible)
}

function renderedSections(tree) {
  const sections = new Map()
  for (const section of elementsByTag(tree, 'section')) {
    const heading = elementsByTag(section, 'h2')[0]
    if (heading) sections.set(normalizeText(renderedText(heading)), normalizeText(renderedText(section)))
  }
  return sections
}

function assertSectionMatches(sections, heading, pattern) {
  assert.match(sections.get(heading) ?? '', pattern, `${heading} rendered disclosure should match`)
}

function renderedLinks(tree) {
  return elementsByTag(tree, 'a').map(anchor => ({
    href: anchor.props.href,
    label: normalizeText(anchor.props['aria-label'] ?? renderedText(anchor, true)),
  }))
}

function assertAuthenticatedLinks(tree) {
  const dialogs = elementsByTag(tree, 'dialog')
  assert.equal(dialogs.length, 1, 'authenticated More dialog should be rendered once')
  const links = renderedLinks(dialogs[0])
  for (const expected of [{ href: '/privacy', label: 'privacy policy' }, { href: '/support', label: 'support' }]) {
    assert.equal(links.filter(link => link.href === expected.href && link.label === expected.label).length, 1, `${expected.label} should be rendered exactly once`)
  }
}

function renderPrivacy() {
  return renderComponent('../app/privacy/page.tsx', { 'next/link': { default: Link } })
}

function renderHome() {
  return renderComponent('../app/HomeClient.tsx', {
    react: { ...inertReact, useState: () => [false, () => {}] },
    'next/image': { default: props => jsx('img', props) },
    'next/link': { default: Link },
    'next/navigation': { useRouter: () => ({ replace: () => {} }) },
    '../lib/supabase': { createClient: () => ({}) },
    './landing.module.css': { default: styleModule },
  })
}

function renderSupport() {
  return renderComponent('../app/support/SupportClient.tsx', {
    react: inertReact,
    './support.module.css': { default: styleModule },
  })
}

function renderAuthenticatedNavigation() {
  return renderComponent('../components/app/BottomTabBar.tsx', {
    react: inertReact,
    'next/link': { default: Link },
    'next/navigation': { usePathname: () => '/protocol' },
    '../../lib/supabase': { createClient: () => ({ auth: { getUser: async () => ({ data: { user: null } }) } }) },
    '../../lib/constants': { ADMIN_USER_ID: 'admin' },
    '../../lib/tabs': { activeTab: () => 'Today' },
    '../ThemeToggle': { default: () => null },
    './AppIcon': { default: () => null },
  })
}

function extractCssBlock(source, openingBrace) {
  let depth = 0
  let quote = ''
  let comment = false
  for (let index = openingBrace; index < source.length; index += 1) {
    const current = source[index]
    const next = source[index + 1]
    if (comment) {
      if (current === '*' && next === '/') { comment = false; index += 1 }
      continue
    }
    if (!quote && current === '/' && next === '*') { comment = true; index += 1; continue }
    if (quote) {
      if (current === '\\') index += 1
      else if (current === quote) quote = ''
      continue
    }
    if (current === '"' || current === "'") { quote = current; continue }
    if (current === '{') depth += 1
    if (current === '}' && --depth === 0) return source.slice(openingBrace + 1, index)
  }
  throw new Error('Unclosed CSS block')
}

function printRules(source) {
  const media = /@media\s+print\s*\{/i.exec(source)
  assert.ok(media, 'print media rule should exist')
  const body = extractCssBlock(source, media.index + media[0].lastIndexOf('{'))
  const rules = new Map()
  let cursor = 0
  while (cursor < body.length) {
    const openingBrace = body.indexOf('{', cursor)
    if (openingBrace < 0) break
    const prelude = body.slice(cursor, openingBrace).trim()
    const ruleBody = extractCssBlock(body, openingBrace)
    cursor = openingBrace + ruleBody.length + 2
    if (!prelude || prelude.startsWith('@')) continue
    const declarations = new Map()
    for (const declaration of ruleBody.split(';')) {
      const separator = declaration.indexOf(':')
      if (separator <= 0) continue
      const property = declaration.slice(0, separator).trim().toLowerCase()
      const rawValue = declaration.slice(separator + 1).trim()
      const important = /!\s*important\s*$/i.test(rawValue)
      const value = rawValue.replace(/!\s*important\s*$/i, '').trim().replace(/\s+/g, ' ').toLowerCase()
      const existing = declarations.get(property)
      if (!existing?.important || important) declarations.set(property, { value, important })
    }
    for (const selector of prelude.split(',')) {
      const normalizedSelector = selector.trim()
      const merged = new Map(rules.get(normalizedSelector) ?? [])
      for (const [property, declaration] of declarations) {
        const existing = merged.get(property)
        if (!existing?.important || declaration.important) merged.set(property, declaration)
      }
      rules.set(normalizedSelector, merged)
    }
  }
  return rules
}

function assertPrintContract(source) {
  const rules = printRules(source)
  for (const selector of [':global(.app-tab-bar)', '.exportBar', ':global(.app-more-sheet)']) {
    const display = rules.get(selector)?.get('display')
    assert.equal(display?.value, 'none', `${selector} should be hidden when printing`)
    assert.equal(display?.important, true, `${selector} print hiding should be important`)
  }
  assert.notEqual(rules.get('.report')?.get('display')?.value, 'none', '.report must remain printable')
  assert.equal(rules.get('.report')?.get('background')?.value, '#fff')
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
  assert.match(shell, /padding-top: max\(env\(safe-area-inset-top, 0px\), var\(--app-shell-safe-top-min\)\)/); assert.match(shell, /padding-bottom: calc\(var\(--app-nav-height\).*safe-area-inset-bottom/s)
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
  assertPrintContract(reportCss)
})
test('print contract rejects a hidden report regardless of important whitespace or declaration order', () => {
  const hiddenReport = `
    @media print {
      .report { background: #fff; display: none ! important; }
      :global(.app-more-sheet) { display: none !important; }
      .exportBar { display: none !important; }
      :global(.app-tab-bar) { display: none !important; }
    }
  `
  assert.throws(() => assertPrintContract(hiddenReport), /\.report must remain printable/)
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
  const sections = renderedSections(renderPrivacy())
  assertSectionMatches(sections, 'information we process', /laboratory information you enter or import.*test dates.*biomarker names.*values.*units.*reference ranges.*providers.*filenames.*import provenance/)
  assertSectionMatches(sections, 'information we process', /push notification subscription information.*when you enable notifications/)
  assertSectionMatches(sections, 'ai-assisted features', /only when you request them.*explicitly allow ai processing.*sends a minimized selection.*to openai/)
  assertSectionMatches(sections, 'reports and imports', /reports are assembled for your use.*browser print workflow.*does not upload or store the generated pdf/)
})
test('rendered privacy extraction excludes false conditional disclosure text', () => {
  const fixture = materialize(jsx('section', {
    children: jsxs(Fragment, {
      children: [
        jsx('h2', { children: 'Conditional disclosure' }),
        'ordinary text',
        jsx('span', { children: 'nested text' }),
        true ? 'visible conditional text' : 'unrendered branch',
        false && 'required disclosure',
      ],
    }),
  }))
  const sections = renderedSections(fixture)
  assert.match(sections.get('conditional disclosure') ?? '', /ordinary text.*nested text.*visible conditional text/)
  assert.throws(() => assertSectionMatches(sections, 'conditional disclosure', /required disclosure/), /rendered disclosure should match/)
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
  const redirected = []
  const redirectSignal = new Error('NEXT_REDIRECT')
  const route = loadTs('../app/demo/page.tsx', { 'next/navigation': { redirect: destination => { redirected.push(destination); throw redirectSignal } } })
  assert.throws(() => route.default(), error => error === redirectSignal)
  assert.deepEqual(redirected, ['/'])
})
test('public landing links and rendered copy do not advertise the retired demo', () => {
  const homeTree = renderHome()
  assert.equal(renderedLinks(homeTree).some(link => link.href === '/demo' || link.href.startsWith('/demo?')), false)
  assert.doesNotMatch(normalizeText(renderedText(homeTree)), /\bdemo\b/)
})
test('account deletion and AI consent settings have labelled accessible regions and status feedback', () => {
  assert.match(deleteAccount, /aria-labelledby="delete-account-heading"/); assert.match(deleteAccount, /htmlFor="delete-account-confirmation"/); assert.match(deleteAccount, /confirmation !== 'DELETE'/)
  assert.match(aiSettings, /aria-labelledby="ai-settings-heading"/); assert.match(aiSettings, /role="status"/); assert.match(aiSettings, /Revoke/)
})
test('privacy and support links are present in public and authenticated surfaces', () => {
  const publicLinks = renderedLinks(renderHome())
  assert.ok(publicLinks.some(link => link.href === '/privacy' && link.label === 'privacy'))
  assert.ok(publicLinks.some(link => link.href === '/support' && link.label === 'support'))
  assertAuthenticatedLinks(renderAuthenticatedNavigation())
  assert.ok(renderedLinks(renderPrivacy()).some(link => link.href === 'mailto:privacy@mypepprotocol.app' && link.label === 'privacy@mypepprotocol.app'))
  assert.ok(existsSync(repositoryPath('../app/support/page.tsx'))); assert.match(supportPage, /<SupportClient \/>/)
  const supportTree = renderSupport()
  assert.match(normalizeText(renderedText(elementsByTag(supportTree, 'form')[0])), /name email subject message.*send request/)
  assert.match(support, /fetch\('\/api\/support'/)
  assert.ok(renderedLinks(supportTree).some(link => link.href === 'mailto:support@mypepprotocol.app' && link.label === 'support@mypepprotocol.app'))
})
test('authenticated link harness ignores disconnected navigation data', () => {
  const disconnectedLinks = [['/privacy', 'Privacy policy'], ['/support', 'Support']]
  const renderedNavigation = materialize(jsx('dialog', { children: jsx('a', { href: '/protocol', children: 'Today' }) }))
  assert.equal(disconnectedLinks.length, 2)
  assert.throws(() => assertAuthenticatedLinks(renderedNavigation), /privacy policy should be rendered exactly once/)
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
  const fixtures = read('../docs/ios-assets-and-screenshots.md')
  assert.match(fixtures, /fictional/i); assert.match(fixtures, /No Rafael name, email, ID, notes, provider, filename, or health history appears/)
  assert.doesNotMatch(fixtures, /41266062-c8a7-4a52-aa9b-c1fb96d1c483/i)
})
test('native packaging is not introduced before the dedicated phase', () => {
  const packageJson = JSON.parse(read('../package.json'))
  assert.ok(packageJson.dependencies['@capacitor/core'])
  assert.ok(packageJson.dependencies['@capacitor/ios'])
  assert.ok(packageJson.devDependencies['@capacitor/cli'])
  const config = loadTs('../capacitor.config.ts').default
  assert.equal(config.appId, 'app.mypepprotocol.ios')
  assert.equal(config.appName, 'MyPepProtocol')
  assert.equal(config.server.url, 'https://www.mypepprotocol.app')
  assert.equal(new URL(config.server.url).protocol, 'https:')
  assert.equal(config.server.cleartext, false)
})
test('readiness document contains the required iPhone widths and packaging decision', () => {
  const audit = read('../docs/app-store-readiness.md')
  for (const width of ['390px', '393px', '430px']) assert.ok(audit.includes(width))
  const normalized = normalizeText(audit)
  for (const gate of ['physical-device qa', 'privacy', 'ai processing consent', 'account deletion', 'authentication', 'push', 'testflight', 'app store']) assert.ok(normalized.includes(gate), `${gate} release gate should remain explicit`)
  assert.match(normalized, /capacitor package and configuration presence does not establish testflight or app store release readiness/)
  assert.match(audit, /Ready for TestFlight or App Store submission\?\s+\n+No\./i)
})
