import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file, mocks = {}, globals = {}) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true,
  } }).outputText
  const module = { exports: {} }
  const localRequire = name => Object.hasOwn(mocks, name) ? mocks[name] : name.startsWith('.') ? load(new URL(name + '.ts', new URL(file, import.meta.url)), mocks, globals) : require(name)
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(localRequire, module, module.exports, ...Object.values(globals))
  return module.exports
}

const Link = ({ href, children, ...props }) => React.createElement('a', { ...props, href }, children)
const navigation = { usePathname: () => '/profile', useRouter: () => ({ replace() {} }) }
const unusedClient = { createClient() { throw new Error('Rendering navigation must not fetch data') } }
const calculatorLabels = /Dose calculator|Pep Calculator|Peptide Calculator|reconstitution calculator|Suggested reconstitution/i
function assertNoCalculator(html) {
  for (const [, href] of html.matchAll(/href="([^"]*)"/g)) {
    assert.doesNotMatch(new URL(href, 'https://www.mypepprotocol.app').pathname, /^\/calculator(?:\/|$)/)
  }
  assert.doesNotMatch(html, calculatorLabels)
}

test('standalone calculator and its dedicated preview API have no route directory', () => {
  assert.equal(existsSync(new URL('../app/calculator/', import.meta.url)), false)
  assert.equal(existsSync(new URL('../app/api/og/', import.meta.url)), false)
})

test('rendered main navigation and More menu expose no calculator', () => {
  const BottomTabBar = load('../components/app/BottomTabBar.tsx', {
    'next/link': Link,
    'next/navigation': navigation,
    '../../lib/supabase': unusedClient,
    '../../lib/tabs': load('../lib/tabs.ts'),
    '../ThemeToggle': () => null,
    './AppIcon': () => null,
  }).default
  const html = renderToStaticMarkup(React.createElement(BottomTabBar))
  assert.match(html, /aria-label="Main navigation"/)
  for (const href of ['/protocol', '/protocol/manage', '/timeline', '/health', '/profile', '/terms', '/support']) {
    assert.ok(html.includes(`href="${href}"`), href)
  }
  assertNoCalculator(html)
})

test('rendered public landing page and footer expose no calculator', () => {
  const Home = load('../app/HomeClient.tsx', {
    react: { ...React, useState: () => [false, () => {}], useEffect() {} },
    'next/link': Link,
    'next/image': ({ src, alt }) => React.createElement('img', { src, alt }),
    'next/navigation': navigation,
    '../lib/supabase': unusedClient,
    './landing.module.css': new Proxy({}, { get: (_, key) => key === '__esModule' ? false : String(key) }),
  }).default
  const html = renderToStaticMarkup(React.createElement(Home))
  assert.match(html, /<footer/)
  for (const href of ['/privacy', '/terms', '/support']) assert.ok(html.includes(`href="${href}"`), href)
  assertNoCalculator(html)
})

test('rendered shared protocol keeps its disclaimer without calculator promotion', async () => {
  const SharePage = load('../app/share/[token]/page.tsx', {
    '@supabase/supabase-js': { createClient: () => ({
      from(table) {
        return {
          select() { return this }, eq() { return this },
          async single() {
            return { data: table === 'shared_protocols'
              ? { protocol_id: 'saved' }
              : { name: 'Shared record', start_date: null, compounds: [] } }
          },
        }
      },
    }) },
    'next/navigation': { notFound() { throw new Error('Unexpected missing fixture') } },
  }).default
  const html = renderToStaticMarkup(await SharePage({ params: Promise.resolve({ token: 'fixture' }) }))
  assert.match(html, /Shared record/)
  assert.match(html, /This is a shared protocol for reference only. Not medical advice./)
  assertNoCalculator(html)
})

test('generated sitemap excludes the removed calculator', () => {
  const entries = load('../app/sitemap.ts').default()
  assert.ok(entries.some(entry => new URL(entry.url).pathname === '/'))
  for (const entry of entries) assert.doesNotMatch(new URL(entry.url).pathname, /^\/calculator(?:\/|$)/)
})

test('generated robots rules no longer advertise the calculator', () => {
  const robots = load('../app/robots.ts').default()
  const rules = Array.isArray(robots.rules) ? robots.rules : [robots.rules]
  for (const rule of rules) assert.ok(![rule.allow].flat().includes('/calculator'))
  assert.equal(robots.sitemap, 'https://www.mypepprotocol.app/sitemap.xml')
})

test('anonymous calculator request passes auth proxy to normal not-found routing', async () => {
  const { NextRequest } = require('next/server')
  const { proxy } = load('../proxy.ts', {
    '@supabase/ssr': {
      ...require('@supabase/ssr'),
      createServerClient: () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } }),
    },
    './lib/authRedirect': load('../lib/authRedirect.ts'),
  }, { process: { env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://fixture.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'fixture-anon-key',
  } } })
  const response = await proxy(new NextRequest('https://www.mypepprotocol.app/calculator'))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('x-middleware-next'), '1')
  assert.equal(response.headers.get('location'), null)
})
