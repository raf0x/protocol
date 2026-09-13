import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import { expectedQuest, questPages, labPdfFixture } from './fixtures/lab-import-quest.mjs'
const require = createRequire(import.meta.url), cache = new Map()
function load(path) {
  const url = new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }; cache.set(url.href, out.exports)
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => name.startsWith('.') ? load(new URL(name + '.ts', url).href) : require(name), out, out.exports)
  return out.exports
}
const { parsePdfLines, parseCsv, mapCsv, detectColumns } = load('../lib/health/labImport.ts')
const { extractLabDocument } = load('../lib/health/labPdfParser.ts')
const { validateLabCandidate, measurementUnitKind } = load('../lib/health/labImportValidation.ts')
const { prepareLabSubmission } = load('../lib/health/labEditor.ts')
const { saveLabPanelV2 } = load('../lib/health/loadLabs.ts')
const { groupPdfTextRows } = load('../lib/health/pdfImport.ts')
const { classifyBiomarker } = load('../lib/health/biomarkerIntelligence.ts')
const lines = (texts, page = 1) => texts.map(text => ({ page, text }))
const parse = (...texts) => extractLabDocument(lines(texts)).rows
const base = { name: 'Example marker', entry: '12', unit: 'mg/L', reference: '10-20', flag: '', source: { page: 1, row: 1, text: 'Example marker 12 mg/L 10-20' }, evidence: ['table_columns'] }
const projection = row => [row.biomarker_name, row.entry, row.unit, row.reference_low, row.reference_high, row.status]
const fixtureLines = questPages.flatMap((spans, i) => groupPdfTextRows(spans, i + 1))
const golden = parsePdfLines(fixtureLines, 'deidentified-report.pdf')

test('golden layout produces exactly seven supported analytes with values, units, ranges and H flag', () => {
  assert.deepEqual(golden.results.map(projection), expectedQuest)
  assert.ok(golden.results.every(r => r.included && r.import_confidence === 'high'))
})
test('golden metadata distinguishes collection, report, fasting and literal laboratory name', () => {
  assert.equal(golden.test_date, '2025-08-14'); assert.equal(golden.provider, 'Quest Diagnostics')
  assert.deepEqual(golden.source_metadata.report_dates, ['2025-08-16']); assert.equal(golden.source_metadata.fasting, true)
  assert.equal(golden.source_metadata.report_status, 'final')
})
test('golden provenance contains result evidence only, no patient/admin document copy', () => {
  const saved = prepareLabSubmission(golden, true)
  const raw = JSON.stringify(saved)
  assert.doesNotMatch(raw, /SYNTHETIC|EXAMPLE,PATIENT|90000|555-0100|Newbrook|Ortega|copyright|example\.test|extracted_lines/i)
  assert.equal(saved.results.length, 7)
  for (const row of saved.results) { assert.equal(row.source_raw.page, 1); assert.ok(row.source_raw.lines.length); assert.ok(row.source_raw.extraction.canonical_identity) }
})
test('actual PDF extractor plus parser passes the synthetic golden PDF, including baseline offsets', async () => {
  let code = ts.transpileModule(readFileSync(new URL('../lib/health/pdfImport.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  code = code.replace('pdfjs-dist/legacy/build/pdf.mjs', new URL('../node_modules/pdfjs-dist/legacy/build/pdf.mjs', import.meta.url).href)
  const { extractPdfText } = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'))
  assert.deepEqual(parsePdfLines(await extractPdfText(labPdfFixture(questPages)), 'fictional.pdf').results.map(projection), expectedQuest)
  await assert.rejects(extractPdfText(labPdfFixture([[]])), /scanned/)
  await assert.rejects(extractPdfText(new Uint8Array([1, 2, 3])), /could not be read/)
})
test('baseline grouping tolerates font offsets without combining adjacent rows or mutating inputs', () => {
  const spans = structuredClone(questPages[0]), snapshot = JSON.stringify(spans)
  const grouped = groupPdfTextRows(spans, 1)
  assert.ok(grouped.some(r => r.text === 'ALBUMIN 4.2 Reference Range: 3.6-5.1 g/dL'))
  assert.equal(JSON.stringify(spans), snapshot)
  assert.ok(!grouped.some(r => /ALBUMIN.*TESTOSTERONE/.test(r.text)))
})
test('clean non-Quest table handles name result unit range on one line', () => {
  const rows = parse('Laboratory: Fictional Labs', 'Analyte Result Unit Range', 'Glucose 92 mg/dL 70-99', 'Albumin 4.4 g/dL 3.5-5.1')
  assert.equal(rows.length, 2); assert.ok(rows.every(r => r.included)); assert.equal(rows[0].reference_high, '99')
})
test('name on one line and result on next preserves both source rows', () => {
  const [row] = parse('Analyte Value', 'Example multi-word analyte', '12 mg/L', 'Reference Range: 10-20 mg/L')
  assert.equal(row.entry, '12'); assert.equal(row.reference_low, '10'); assert.equal(row.source_raw.lines.length, 3)
})
test('adjacent name/result association does not cross page boundaries', () => {
  assert.equal(extractLabDocument([...lines(['Example analyte']), ...lines(['12 mg/L'], 2)]).rows.length, 0)
})
test('numeric analyte names are not result values', () => {
  assert.equal(parse('IGF 1', 'IGF 1, LC/MS', 'IGF 1 LC/MS').length, 0)
  const [row] = parse('IGF 1, LC/MS 180 ng/mL 50-300')
  assert.equal(row.biomarker_name, 'IGF 1, LC/MS'); assert.equal(row.entry, '180')
  assert.equal(parse('Analyte Value', 'Vitamin B12 400 pg/mL')[0].entry, '400')
})
test('negative and decimal supplied reference bounds remain exact', () => {
  const rows = parse('Z SCORE (MALE) -0.2 SD -2.0 - +2.0', 'ALBUMIN 4.1 g/dL 3.6-5.1')
  assert.equal(rows[0].reference_low, '-2.0'); assert.equal(rows[0].reference_high, '+2.0'); assert.equal(rows[1].reference_low, '3.6')
})
test('printed high/low flags are preserved without invented clinical interpretation', () => {
  const rows = parse('Analyte Value', 'Example alpha 30 H mg/L 10-20', 'Example beta 5 mg/L 10-20 LOW')
  assert.deepEqual(rows.map(r => r.status), ['high', 'low'])
})
test('missing unit is preserved with a review reason, never invented', () => {
  const [row] = parse('Analyte Value', 'Example alpha 12')
  assert.equal(row.unit, ''); assert.equal(row.included, false); assert.match(row.warnings.join(' '), /Unit not supplied/)
})
test('missing reference remains missing, a structured unit/result is still selectable', () => {
  const [row] = parse('Analyte Value', 'Example alpha 12 mg/L')
  assert.equal(row.reference_low, ''); assert.equal(row.reference_high, ''); assert.equal(row.included, true)
})
test('qualitative outcomes need no invented unit or status', () => {
  const [row] = parse('Analyte Value', 'Example antibody Not detected')
  assert.equal(row.entry, 'Not detected'); assert.equal(row.unit, ''); assert.equal(row.status, ''); assert.equal(row.included, true)
})
for (const artifact of [
  'Reference Range: 250-1100 ng/dL', 'Reference Range: 3.6-5.1 g/dL', 'Reference Range: 46.0-224.0 pg/mL',
  '14225 Newbrook Dr', '33608 Ortega Hwy', 'COVINA, CA 91723', 'Phone: (415) 555-0100',
  'Copyright 2022 Quest', 'Specimen: 12345', 'Requisition: 67890', 'Patient ID: 98765', 'Analyte Value', 'Page 1 of 2',
  'Laboratory Director: Example 123', 'https://example.test/2022', 'This assay has been validated with 250 samples',
  'Privacy policy 2022',
]) test(`metadata never becomes an analyte: ${artifact}`, () => assert.equal(parse(artifact).length, 0))
test('headers and footers repeat without adding results', () => {
  const rows = extractLabDocument([...lines(['Analyte Value', 'Marker alpha 2 mg/L', 'Page 1 of 2']), ...lines(['Analyte Value', 'Marker beta 4 mg/L', 'Page 2 of 2'], 2)]).rows
  assert.equal(rows.length, 2)
})
test('performing-site sections cannot leak addresses into review', () => {
  assert.equal(parse('Analyte Value', 'Albumin 4 g/dL', 'Performing Sites', 'Example lab 42 ng/dL', 'Laboratory Director: Example').length, 1)
})
test('multiple collection dates never choose first date or auto-select a combined panel', () => {
  const draft = parsePdfLines(lines(['Collected: 2025-01-01', 'Analyte Value', 'Albumin 4 g/dL', 'Collected: 2025-02-01', 'Analyte Value', 'Glucose 90 mg/dL']), 'multi.pdf')
  assert.equal(draft.test_date, ''); assert.ok(draft.results.every(r => !r.included)); assert.deepEqual(draft.results.map(r => r.source_raw.extraction.collection_date), ['2025-01-01', '2025-02-01'])
})
test('invalid calendar dates and unlabeled footer dates are not collection dates', () => {
  const draft = parsePdfLines(lines(['Collected: 02/30/2025', 'DOB: 01/01/1980', '9/12/26', 'Albumin 4 g/dL']), 'dates.pdf')
  assert.equal(draft.test_date, ''); assert.match(draft.source_metadata.warnings.join(' '), /date/)
})
test('equal repeated analytes preserve both occurrences and require deliberate inclusion', () => {
  const rows = parse('Analyte Value', 'Albumin 4 g/dL', 'Albumin 4 g/dL')
  assert.equal(rows.length, 2); assert.ok(rows.every(r => !r.included)); assert.notEqual(rows[0].source_row_index, rows[1].source_row_index)
})
test('conflicting and different-unit analyte rows are never silently reconciled', () => {
  const rows = parse('Analyte Value', 'Albumin 4 g/dL', 'Albumin 5 g/dL', 'Albumin 40 g/L')
  assert.equal(rows.length, 3); assert.ok(rows.every(r => !r.included)); assert.deepEqual(rows.map(r => r.entry), ['4', '5', '40'])
})
test('ambiguous unlabelled layout is excluded while manual review remains possible', () => {
  const [row] = parse('Example marker 12 mg/L')
  assert.equal(row.import_confidence, 'medium'); assert.equal(row.included, false)
  assert.equal(parse('Random prose 2022').length, 0)
})
test('unknown dedicated unit is different from an invalid neighboring word', () => {
  const row = validateLabCandidate({ ...base, unit: 'arbitrary-units', explicitUnit: true })
  assert.equal(row.unit, 'arbitrary-units'); assert.equal(row.included, false)
  assert.equal(validateLabCandidate({ ...base, unit: 'arbitrary-units', explicitUnit: false }), null)
  for (const unit of ['Reference', 'Newbrook', 'Ortega', 'Quest']) {
    assert.equal(measurementUnitKind(unit), 'invalid'); assert.equal(parse(`Example 12 ${unit}`).length, 0)
  }
})
test('numeric overflow, NaN and malformed numeric PDF output are not accepted', () => {
  for (const entry of ['NaN', 'Infinity', '1e999', '1.2.3', '12abc', '<1e999']) assert.equal(validateLabCandidate({ ...base, entry }), null)
})
test('reversed ranges stay text with review required, never swapped', () => {
  const [row] = parse('Analyte Value', 'Marker 12 mg/L Reference Range: 20-10 mg/L')
  assert.equal(row.reference_low, ''); assert.equal(row.reference_high, ''); assert.equal(row.reference_text, '20-10'); assert.equal(row.included, false)
})
test('different result/range units are preserved with explicit uncertainty', () => {
  const [row] = parse('Analyte Value', 'Marker 12 mg/L Reference Range: 10-20 ng/mL')
  assert.equal(row.unit, 'mg/L'); assert.equal(row.included, false); assert.match(row.warnings.join(' '), /different units/)
  assert.equal(row.reference_low, ''); assert.equal(row.reference_high, ''); assert.match(row.reference_text, /ng\/mL/)
})
test('conservative registry is reused without changing method-specific identities', () => {
  const row = golden.results.find(r => r.biomarker_name === 'TESTOSTERONE, FREE')
  assert.equal(row.source_raw.extraction.canonical_identity, classifyBiomarker('Free Testosterone').key)
  assert.notEqual(classifyBiomarker('IGF 1, LC/MS').key, classifyBiomarker('IGF 1').key)
})
test('CSV low confidence is excluded by default; manual inclusion and correction retain source cells', () => {
  const table = parseCsv('Test,Result,Unit,Date\nMarker,,mg/L,2025-01-01')
  const draft = mapCsv(table, detectColumns(table.headers), 'fictional.csv')
  assert.equal(draft.results[0].included, false)
  draft.results[0].entry = '5'; draft.results[0].included = true
  const saved = prepareLabSubmission(draft, true)
  assert.equal(saved.results[0].value, 5); assert.equal(saved.results[0].source_raw.cells[1], '')
})
test('high confidence is selected; explicit edits preserve extracted value and correction state', () => {
  const draft = structuredClone(golden)
  draft.results[0].entry = '1000'
  const saved = prepareLabSubmission(draft, true)
  assert.equal(saved.results[0].value, 1000); assert.equal(saved.results[0].source_raw.extraction.fields.entry, '1077')
  assert.ok(saved.results[0].source_raw.review.corrected_fields.includes('entry'))
})
test('import review is mandatory; excluded rows never enter persistence', () => {
  const draft = structuredClone(golden); draft.results[0].included = false
  assert.throws(() => prepareLabSubmission(draft, false), /Confirm/)
  assert.equal(prepareLabSubmission(draft, true).results.length, 6)
})
test('parser does not read sessions, network, storage, AI, or mutate caller data', () => {
  const snapshot = JSON.stringify(fixtureLines); parsePdfLines(fixtureLines, 'fictional.pdf'); assert.equal(JSON.stringify(fixtureLines), snapshot)
  for (const file of ['labPdfParser.ts', 'labImportValidation.ts']) assert.doesNotMatch(readFileSync(new URL(`../lib/health/${file}`, import.meta.url), 'utf8'), /fetch\(|\.rpc\(|localStorage|sessionStorage|OPENAI|console\./)
})
test('unauthenticated import cannot persist; ownership is not accepted from form data', async () => {
  let calls = 0
  const client = { auth: { getUser: async () => ({ data: { user: null }, error: null }) }, rpc: async () => { calls++; return { data: 'saved', error: null } } }
  await assert.rejects(saveLabPanelV2(golden, null, true, client), /sign in/i); assert.equal(calls, 0)
  client.auth.getUser = async () => ({ data: { user: { id: 'fictional-owner' } }, error: null })
  client.rpc = async (_name, args) => { calls++; assert.ok(!JSON.stringify(args).includes('user_id')); return { data: 'saved', error: null } }
  assert.equal(await saveLabPanelV2({ ...golden, user_id: 'different-owner' }, null, true, client), 'saved'); assert.equal(calls, 1)
})
test('PDF dedicated unit columns retain unfamiliar units for review', () => {
  const span = (text, x, y) => ({ text, x, y, height: 8, width: text.length * 3 })
  const rows = groupPdfTextRows([span('Analyte', 40, 700), span('Result', 240, 700), span('Units', 340, 700), span('Reference Range', 440, 700),
    span('Fictional marker', 40, 680), span('12', 240, 680), span('arbitrary-units', 340, 680), span('10-20', 440, 680)], 1)
  const draft = parsePdfLines(rows, 'columns.pdf')
  assert.equal(draft.results[0].unit, 'arbitrary-units'); assert.equal(draft.results[0].included, false); assert.equal(draft.results[0].reference_low, '10')
})
test('invalid page/row provenance is never auto-accepted', () => {
  for (const source of [{ page: 0, row: 1 }, { page: 1, row: -1 }, { page: 1, row: 1, lines: [{ page: 2, row: 1, text: 'other page' }] }])
    assert.equal(validateLabCandidate({ ...base, source }), null)
})
test('detached range between two results cannot silently move to the wrong analyte', () => {
  const rows = parse('Analyte Value', 'Reference Range: 250-1100 ng/dL', 'Example hormone 900', 'Reference Range: 3.6-5.1 g/dL', 'Albumin 4.2')
  assert.equal(rows.length, 2)
  assert.ok(rows.every(r => r.reference_low === '' && r.reference_high === '' && !r.included))
  assert.equal(rows[0].unit, '', 'do not steal the next analyte unit')
})
test('numeric assay heading in the name column cannot masquerade as a result/unit pair', () => {
  const span = (text, x, y, width = text.length * 3) => ({ text, x, y, width, height: 8 })
  const rows = groupPdfTextRows([span('Analyte', 40, 700), span('Value', 300, 700), span('IGF 1 LC/MS', 40, 680),
    span('IGF 1 LC/MS', 40, 660), span('180', 300, 660), span('Reference Range: 50-300 ng/mL', 340, 661.2)], 1)
  const parsed = extractLabDocument(rows).rows
  assert.equal(parsed.length, 1); assert.equal(parsed[0].entry, '180'); assert.equal(parsed[0].biomarker_name, 'IGF 1 LC/MS')
})
