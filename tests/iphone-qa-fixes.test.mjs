import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

async function loadPure(path) {
  const output = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const consentRoute = read('../app/api/ai-consent/route.ts')
const consentHelper = read('../lib/aiConsent.ts')
const consentDialog = read('../components/health/AiConsentDialog.tsx')
const profileSettings = read('../components/profile/AiProcessingSettings.tsx')
const analystRoute = read('../app/api/health-analyst/route.ts')
const appShell = read('../components/app/AppShell.tsx')
const shellCss = read('../app/mobile-app.css')
const healthCss = read('../app/health/health.module.css')
const timelineCss = read('../app/timeline/timeline.module.css')

test('consent persistence supports the established id-owned profile', async () => {
  const { resolveUserProfileOwnership } = await loadPure('../lib/userProfileOwnership.ts')
  const calls = []
  const result = await resolveUserProfileOwnership(async key => {
    calls.push(key)
    return key === 'id' ? { data: [{ ai_processing_consent: true }], error: null } : { data: [], error: null }
  }, data => Array.isArray(data) && data.length > 0)
  assert.equal(result.ownerKey, 'id')
  assert.deepEqual(calls, ['id'])
})

test('consent persistence falls through an unavailable id shape to user_id ownership', async () => {
  const { resolveUserProfileOwnership } = await loadPure('../lib/userProfileOwnership.ts')
  const calls = []
  const result = await resolveUserProfileOwnership(async key => {
    calls.push(key)
    return key === 'id' ? { data: null, error: { code: '42703' } } : { data: [{ ai_processing_consent: true }], error: null }
  }, data => Array.isArray(data) && data.length > 0)
  assert.equal(result.ownerKey, 'user_id')
  assert.deepEqual(calls, ['id', 'user_id'])
})

test('both consent read and write paths use ownership compatibility', () => {
  assert.match(consentRoute, /resolveUserProfileOwnership/)
  assert.match(consentHelper, /resolveUserProfileOwnership/)
  assert.ok(consentRoute.indexOf('resolveUserProfileOwnership') < consentRoute.indexOf('ProfileNotFound'))
})

test('failed or cancelled consent never advances to an AI retry', () => {
  assert.ok(consentDialog.indexOf('if (!response.ok) throw') < consentDialog.indexOf('onGranted()'))
  assert.match(consentDialog, /onClick=\{onCancel\}/)
})

test('revocation still uses the consent endpoint and clears stored approval state', () => {
  assert.match(profileSettings, /consent: false/)
  assert.match(consentRoute, /ai_processing_consented_at: consent \? new Date\(\)\.toISOString\(\) : null/)
})

test('server-side AI enforcement rejects absent consent before loading health data', () => {
  assert.ok(analystRoute.indexOf('hasCurrentAiConsent') < analystRoute.indexOf('loadHealthAnalystContext'))
  assert.match(analystRoute, /status: 403/)
})

test('authenticated shell owns one top safe-area offset with an iPhone fallback', () => {
  assert.match(appShell, /mobile-app-shell/)
  assert.match(shellCss, /padding-top: max\(env\(safe-area-inset-top, 0px\), var\(--app-shell-safe-top-min\)\)/)
  assert.match(shellCss, /@media \(max-width: 639px\)[\s\S]*--app-shell-safe-top-min: 24px/)
  assert.match(shellCss, /\.app-offline-banner \{ position: sticky; top: 0;/)
})

test('Health page and category grid fit a 390px viewport without content-box overflow', () => {
  assert.match(healthCss, /\.page \{ box-sizing: border-box; width: min\(100%, 760px\); max-width: 100%; min-width: 0;/)
  assert.match(healthCss, /\.categoryGrid \{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[^}]*max-width: 100%;[^}]*min-width: 0;/)
  assert.match(healthCss, /\.page \.categoryCard \{ box-sizing: border-box;[^}]*max-width: 100%;[^}]*min-width: 0;/)
})

test('Health summary and biomarker visuals are contained by their cards', () => {
  assert.match(healthCss, /\.summaryGrid \{[^}]*max-width: 100%;[^}]*overflow: hidden;/)
  assert.match(healthCss, /\.flaggedRow, \.trendCard \{[^}]*max-width: 100%;[^}]*overflow: hidden;/)
  assert.match(healthCss, /\.overlayChart \{[^}]*max-width: 100%;[^}]*overflow: hidden;/)
})

test('Timeline chips scroll locally without page overflow or a permanent scrollbar', () => {
  assert.match(timelineCss, /\.page \{ box-sizing: border-box; width: 100%; max-width: 760px; min-width: 0;/)
  assert.match(timelineCss, /\.filters \{[^}]*max-width: 100%;[^}]*overflow-x: auto;[^}]*scrollbar-width: none;/)
  assert.match(timelineCss, /\.filters::\-webkit-scrollbar \{ display: none; \}/)
})

test('authenticated page root prevents page-level horizontal scrolling', () => {
  assert.match(shellCss, /\.mobile-app-shell \{[^}]*box-sizing: border-box;[^}]*width: 100%;[^}]*max-width: 100%;[^}]*overflow-x: clip;/)
  assert.match(shellCss, /\.today-container \{ box-sizing: border-box;[^}]*max-width: 100%;/)
})
