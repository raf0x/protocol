import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')

function loadTs(path, injected = {}) {
  const code = ts.transpileModule(read(path), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText

  const result = { exports: {} }

  const require = name => {
    if (name === './clientRuntime') {
      return (
        injected.clientRuntime ||
        loadTs('../lib/clientRuntime.ts')
      )
    }

    throw new Error(`unexpected import: ${name}`)
  }

  new Function(
    'module',
    'exports',
    'require',
    code
  )(result, result.exports, require)

  return result.exports
}

const ORIGIN = 'https://www.mypepprotocol.app'

test('internal, relative, and fragment links stay in the app', () => {
  const { classifyLink } = loadTs('../lib/nativeLinks.ts')

  assert.equal(classifyLink('/protocol', ORIGIN), 'in-app')
  assert.equal(
    classifyLink('/timeline?filter=weight', ORIGIN),
    'in-app'
  )
  assert.equal(classifyLink('#section', ORIGIN), 'in-app')
  assert.equal(classifyLink('?tab=labs', ORIGIN), 'in-app')
  assert.equal(
    classifyLink(
      'https://www.mypepprotocol.app/health',
      ORIGIN
    ),
    'in-app'
  )
  assert.equal(
    classifyLink(
      'https://mypepprotocol.app/health',
      ORIGIN
    ),
    'in-app'
  )
})

test('external HTTPS links are routed to the system browser', () => {
  const { classifyLink } = loadTs('../lib/nativeLinks.ts')

  assert.equal(
    classifyLink('https://example.com', ORIGIN),
    'system-browser'
  )

  assert.equal(
    classifyLink(
      'https://developer.apple.com/support',
      ORIGIN
    ),
    'system-browser'
  )
})

test('protocol-relative links are not mistaken for internal paths', () => {
  const { classifyLink } = loadTs('../lib/nativeLinks.ts')

  assert.equal(
    classifyLink('//example.com/steal', ORIGIN),
    'system-browser'
  )
})

test('mailto and tel go to the native handler', () => {
  const { classifyLink } = loadTs('../lib/nativeLinks.ts')

  assert.equal(
    classifyLink(
      'mailto:privacy@mypepprotocol.app',
      ORIGIN
    ),
    'system-handler'
  )

  assert.equal(
    classifyLink('tel:+15555550123', ORIGIN),
    'system-handler'
  )
})

test('unsupported and empty schemes are blocked rather than guessed', () => {
  const { classifyLink } = loadTs('../lib/nativeLinks.ts')

  assert.equal(
    classifyLink('javascript:alert(1)', ORIGIN),
    'blocked'
  )

  assert.equal(
    classifyLink('file:///etc/passwd', ORIGIN),
    'blocked'
  )

  assert.equal(classifyLink('', ORIGIN), 'blocked')
  assert.equal(classifyLink('   ', ORIGIN), 'blocked')
})

test('web behavior is unchanged because handoff never triggers without the bridge', () => {
  const { requiresNativeHandoff } = loadTs(
    '../lib/nativeLinks.ts',
    {
      clientRuntime: {
        isNativeAppRuntime: () => false,
      },
    }
  )

  assert.equal(
    requiresNativeHandoff(
      'https://example.com',
      ORIGIN
    ),
    false
  )

  assert.equal(
    requiresNativeHandoff(
      'mailto:privacy@mypepprotocol.app',
      ORIGIN
    ),
    false
  )

  assert.equal(
    requiresNativeHandoff('/protocol', ORIGIN),
    false
  )
})

test('native runtime hands off only external and system links', () => {
  const { requiresNativeHandoff } = loadTs(
    '../lib/nativeLinks.ts',
    {
      clientRuntime: {
        isNativeAppRuntime: () => true,
      },
    }
  )

  assert.equal(
    requiresNativeHandoff(
      'https://example.com',
      ORIGIN
    ),
    true
  )

  assert.equal(
    requiresNativeHandoff(
      'mailto:privacy@mypepprotocol.app',
      ORIGIN
    ),
    true
  )

  assert.equal(
    requiresNativeHandoff('/protocol', ORIGIN),
    false
  )

  assert.equal(
    requiresNativeHandoff(
      'https://www.mypepprotocol.app/health',
      ORIGIN
    ),
    false
  )

  assert.equal(
    requiresNativeHandoff(
      'javascript:alert(1)',
      ORIGIN
    ),
    false
  )
})