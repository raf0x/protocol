import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { test } from 'node:test'

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8')

test('retired personal-tracking routes and legacy admin constant are absent', () => {
  for (const path of ['../app/admin/page.tsx', '../app/tracker/page.tsx', '../lib/constants.ts']) {
    assert.equal(existsSync(new URL(path, import.meta.url)), false, path)
  }
})

test('legacy tracker generator scripts cannot recreate retired personal data', () => {
  for (const script of [
    '../write-tracker.js', '../fix-tracker.js', '../fix-tracker-days.js',
    '../p1-admin-id.js', '../fix-secret-tab.js',
  ]) {
    assert.equal(existsSync(new URL(script, import.meta.url)), false, script)
  }
})

test('More menu retains current destinations without retired links or admin lookup', () => {
  const navigation = source('../components/app/BottomTabBar.tsx')
  for (const destination of ['/profile', '/learn', '/privacy', '/support']) {
    assert.ok(navigation.includes(`'${destination}'`), `Expected ${destination} to remain available`)
  }
  assert.doesNotMatch(navigation, /\/admin\b|\/tracker\b|ADMIN_USER_ID|isAdmin|getUser\(\)/)
})

test('Profile no longer displays an account-specific legacy admin link', () => {
  const profile = source('../app/profile/page.tsx')
  assert.doesNotMatch(profile, /href=["']\/admin(?:\/|["'])|Admin Dashboard/)
  assert.match(profile, /<AiProcessingSettings/)
  assert.match(profile, /<DeleteAccount/)
})
