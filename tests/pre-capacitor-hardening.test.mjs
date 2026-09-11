import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const lifecycle = read('../components/app/PwaLifecycle.tsx')
const installHint = read('../components/app/InstallHint.tsx')
const shell = read('../app/mobile-app.css')
const protocolCss = read('../app/protocol/manage/protocols.css')
const consentCss = read('../components/health/AiConsentDialog.module.css')
const healthCss = read('../app/health/health.module.css')
const today = read('../app/protocol/page.tsx')
const manage = read('../app/protocol/manage/page.tsx')
const supabase = read('../lib/supabase.ts')

function loadTs(path) {
  const code = ts.transpileModule(read(path), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const result = { exports: {} }
  new Function('module', 'exports', code)(result, result.exports)
  return result.exports
}

test('Capacitor runtime detection is bridge-based and fails closed to web behavior', () => {
  const { isNativeAppRuntime } = loadTs('../lib/clientRuntime.ts')
  assert.equal(isNativeAppRuntime({ Capacitor: { isNativePlatform: () => true } }), true)
  assert.equal(isNativeAppRuntime({ Capacitor: { isNativePlatform: () => false } }), false)
  assert.equal(isNativeAppRuntime({}), false)
  assert.equal(isNativeAppRuntime({ Capacitor: { isNativePlatform: () => { throw new Error('bridge unavailable') } } }), false)
})

test('PWA service worker lifecycle is bypassed in a native runtime', () => {
  assert.match(lifecycle, /isNativeAppRuntime\(\)/)
  assert.match(lifecycle, /getRegistrations\(\).*unregister\(\)/s)
  assert.ok(lifecycle.indexOf('isNativeAppRuntime()') < lifecycle.indexOf('navigator.serviceWorker.register'))
})

test('native runtime never receives the browser install hint', () => {
  assert.match(installHint, /isNativeAppRuntime\(\)/)
  assert.ok(installHint.indexOf('isNativeAppRuntime()') < installHint.indexOf('display-mode: standalone'))
})

test('authenticated shell owns every safe-area edge without duplicate protocol padding', () => {
  for (const inset of ['top', 'right', 'bottom', 'left']) assert.match(shell, new RegExp(`safe-area-inset-${inset}`))
  assert.doesNotMatch(protocolCss, /safe-area-inset-(?:left|right)/)
})

test('mobile authenticated form controls stay at 16px to avoid iOS focus zoom', () => {
  assert.match(shell, /input:not\(\[type='checkbox'\]\):not\(\[type='radio'\]\).*select, textarea.*font-size: 16px !important/)
})

test('consent and Health dialogs are safe-area bounded and independently scrollable', () => {
  for (const css of [consentCss, healthCss]) {
    assert.match(css, /100dvh/)
    assert.match(css, /safe-area-inset-top/)
    assert.match(css, /safe-area-inset-bottom/)
    assert.match(css, /overflow-y:\s*auto/)
    assert.match(css, /overscroll-behavior:\s*contain/)
  }
})

test('WebKit CSV exports click an attached anchor and delay Blob URL revocation', () => {
  for (const source of [today, manage]) {
    assert.ok(source.indexOf('document.body.appendChild(link)') < source.indexOf('link.click()'))
    assert.match(source, /window\.setTimeout\(\(\) => window\.URL\.revokeObjectURL\(url\), 1_000\)/)
  }
})

test('current browser auth client retains Supabase SSR persistent-session defaults', () => {
  assert.match(supabase, /createBrowserClient/)
  assert.doesNotMatch(supabase, /persistSession:\s*false|autoRefreshToken:\s*false/)
  assert.doesNotMatch(supabase, /localStorage|sessionStorage/)
})
