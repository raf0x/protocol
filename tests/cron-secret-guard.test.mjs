import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import ts from 'typescript'

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
const output = ts.transpileModule(read('../lib/cronAuth.ts'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { isValidCronAuthorization } = await import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)

test('missing or blank secrets always deny requests', () => {
  for (const secret of [undefined, '', ' ', '\\t']) {
    assert.equal(isValidCronAuthorization(`Bearer ${String(secret)}`, secret), false)
  }
})

test('only the exact configured bearer value is accepted', () => {
  assert.equal(isValidCronAuthorization('Bearer real-token', 'real-token'), true)
  for (const header of [null, '', 'Bearer undefined', 'Bearer real-token ', 'bearer real-token', 'Bearer other-token']) {
    assert.equal(isValidCronAuthorization(header, 'real-token'), false)
  }
})

test('both privileged GET endpoints use the shared guard', () => {
  for (const path of ['../app/api/cron/route.ts', '../app/api/push/route.ts']) {
    assert.match(read(path), /isValidCronAuthorization\(request\.headers\.get\('authorization'\), process\.env\.CRON_SECRET\)/)
  }
})
