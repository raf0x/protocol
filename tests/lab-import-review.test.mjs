import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'
import { labPdfFixture, questPages, expectedQuest } from './fixtures/lab-import-quest.mjs'
const require = createRequire(import.meta.url)
function load(path, overrides = {}, cache = new Map()) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }; cache.set(url.href, out.exports)
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (name in overrides) return overrides[name]
    if (name.endsWith('.css')) return { default: {} }
    if (!name.startsWith('.')) return require(name)
    const extension = existsSync(new URL(name + '.ts', url)) ? '.ts' : '.tsx'
    return load(new URL(name + extension, url).href, overrides, cache)
  }, out, out.exports)
  return out.exports
}
function mount(path, props, overrides = {}) {
  let slot = 0
  const values = new Map()
  const state = initial => {
    const index = slot++
    if (!values.has(index)) values.set(index, typeof initial === 'function' ? initial() : initial)
    return [values.get(index), next => values.set(index, typeof next === 'function' ? next(values.get(index)) : next)]
  }
  const { default: View } = load(path, { ...overrides, react: { ...React, useState: state, useRef: initial => state({ current: initial })[0], useMemo: calculate => calculate() } })
  function nodes() {
    slot = 0
    const result = []
    function visit(node) {
      if (Array.isArray(node)) return node.forEach(visit)
      if (!React.isValidElement(node)) return
      result.push(node); visit(node.props.children)
    }
    visit(View(props)); return result
  }
  return { nodes, type: type => nodes().filter(n => n.type === type), submit: () => nodes().find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }) }
}
const labEditor = load('../lib/health/labEditor.ts')
const { parsePdfLines } = load('../lib/health/labImport.ts')
const { groupPdfTextRows } = load('../lib/health/pdfImport.ts')
const draft = parsePdfLines(questPages.flatMap((rows, index) => groupPdfTextRows(rows, index + 1)), 'fictional.pdf')
function setWindow(t) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { scrollTo() {} } })
  t.after(() => previous ? Object.defineProperty(globalThis, 'window', previous) : Reflect.deleteProperty(globalThis, 'window'))
}

test('actual file-input handler runs PDF extraction and feeds seven candidates to the review form', async () => {
  let code = ts.transpileModule(readFileSync(new URL('../lib/health/pdfImport.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  code = code.replace('pdfjs-dist/legacy/build/pdf.mjs', new URL('../node_modules/pdfjs-dist/legacy/build/pdf.mjs', import.meta.url).href)
  const pdf = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
  let finish
  const finished = new Promise(resolve => { finish = resolve })
  const app = mount('../components/health/ImportLabForm.tsx', { kind: 'pdf', panels: [], onSaved() {}, onCancel() {} }, {
    '../../lib/health/pdfImport': { extractPdfText: async data => { try { return await pdf.extractPdfText(data) } finally { finish() } } },
  })
  const bytes = labPdfFixture(questPages)
  const target = { files: [{ name: 'fictional.pdf', size: bytes.length, arrayBuffer: async () => bytes.buffer }], value: 'chosen' }
  app.type('input').find(n => n.props.type === 'file').props.onChange({ target })
  await finished; await new Promise(resolve => setImmediate(resolve))
  const review = app.nodes().find(n => n.props.initialDraft)
  assert.ok(review, 'file input must transition into AddLabForm')
  assert.deepEqual(review.props.initialDraft.results.map(r => r.biomarker_name), expectedQuest.map(r => r[0]))
  assert.equal(target.value, '')
  assert.equal(app.type('pre').length, 0, 'whole document and patient text must not be exposed')
})
test('review collapses high-confidence fields, keeps inclusion and manual edits accessible, requires final confirmation', async t => {
  setWindow(t)
  const saved = [], ids = []
  const app = mount('../components/health/AddLabForm.tsx', { initialDraft: structuredClone(draft), panels: [], onSaved: id => ids.push(id), onCancel() {} }, {
    '../../lib/health/loadLabs': { saveLabPanelV2: async (current, _original, confirmed) => { saved.push(labEditor.prepareLabSubmission(current, confirmed)); return 'fixture-panel' } },
  })
  await app.submit()
  assert.equal(app.type('summary').filter(n => JSON.stringify(n.props.children).includes('Check or edit')).length, 7)
  const includes = app.type('input').filter(n => n.props.type === 'checkbox')
  assert.equal(includes.length, 7); assert.ok(includes.every(n => n.props.checked))
  const result = app.type('input').find(n => n.props.value === '1077')
  result.props.onChange({ target: { value: '1000' } })
  app.type('input').filter(n => n.props.type === 'checkbox')[1].props.onChange({ target: { checked: false } })
  await app.submit() // Review, no save.
  assert.equal(saved.length, 0)
  await app.submit() // Confirmation missing, rejected at actual submission preparation.
  assert.equal(saved.length, 0)
  assert.ok(app.nodes().some(n => n.props.role === 'alert'))
  app.type('input').find(n => n.props.type === 'checkbox').props.onChange({ target: { checked: true } })
  await app.submit()
  assert.equal(saved.length, 1); assert.equal(saved[0].results.length, 6); assert.equal(saved[0].results[0].value, 1000)
  assert.deepEqual(saved[0].results[0].source_raw.review.corrected_fields, ['entry'])
  assert.deepEqual(ids, ['fixture-panel'])
})
test('uncertain candidates are expanded, initially excluded and can be deliberately included', async t => {
  setWindow(t)
  const uncertain = parsePdfLines([{ page: 1, text: 'Example marker 12 mg/L' }], 'uncertain.pdf')
  uncertain.test_date = '2025-01-01'
  const saved = []
  const app = mount('../components/health/AddLabForm.tsx', { initialDraft: uncertain, panels: [], onSaved() {}, onCancel() {} }, {
    '../../lib/health/loadLabs': { saveLabPanelV2: async (current, _original, confirmed) => { saved.push(labEditor.prepareLabSubmission(current, confirmed)); return 'fixture' } },
  })
  await app.submit()
  assert.equal(app.type('summary').filter(n => JSON.stringify(n.props.children).includes('Check or edit')).length, 0)
  const include = app.type('input').find(n => n.props.type === 'checkbox')
  assert.equal(include.props.checked, false)
  include.props.onChange({ target: { checked: true } })
  await app.submit()
  app.type('input').find(n => n.props.type === 'checkbox').props.onChange({ target: { checked: true } })
  await app.submit()
  assert.equal(saved.length, 1); assert.equal(saved[0].results[0].value, 12)
})
test('manual fallback remains editable and uses the same canonical submission', async t => {
  setWindow(t)
  const app = mount('../components/health/AddLabForm.tsx', { initialDraft: { test_date: '2025-01-01', panel_name: '', provider: '', notes: '', results: [{ biomarker_name: 'Manual marker', entry: '12', unit: '', reference_low: '', reference_high: '', reference_text: '', status: '' }] }, panels: [], onSaved() {}, onCancel() {} })
  await app.submit()
  assert.equal(app.type('input').filter(n => n.props.type === 'checkbox').length, 0)
  assert.ok(app.type('input').some(n => n.props.value === 'Manual marker'))
})
