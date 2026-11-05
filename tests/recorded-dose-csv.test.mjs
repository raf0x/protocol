import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const options = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
function load(file) {
  const url = new URL(file, import.meta.url), result = { exports: {} }
  new Function('require', 'module', 'exports', ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: options }).outputText)(name => {
    assert.ok(name.startsWith('.'), `Unexpected dependency: ${name}`)
    return load(new URL(name + '.ts', url))
  }, result, result.exports)
  return result.exports
}
const recorded = load('../lib/health/recordedDose.ts')
const { entryFromForm } = load('../lib/health/dosingEntry.ts')
const { protocolLifecycle } = load('../lib/health/protocolDates.ts')

// Extract the actual handler body, retaining all export loops and download behavior.
function handler(file, context) {
  const ast = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  let body
  function visit(node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'exportToCSV') body = node.getText(ast)
    ts.forEachChild(node, visit)
  }
  visit(ast)
  assert.ok(body, `${file} has an exportToCSV handler`)
  return new Function('context', 'with(context){' + ts.transpileModule(body, { compilerOptions: options }).outputText + ';return exportToCSV}')(context)
}
function parseCsv(csv) {
  const rows = []; let row = [], cell = '', quoted = false
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]
    if (char === '"') {
      if (quoted && csv[i + 1] === '"') { cell += '"'; i++ }
      else quoted = !quoted
    } else if (char === ',' && !quoted) { row.push(cell); cell = '' }
    else if (char === '\n' && !quoted) { row.push(cell); rows.push(row); row = []; cell = '' }
    else cell += char
  }
  assert.equal(quoted, false, 'CSV quotes are balanced')
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); Object.values(value).forEach(freeze) }
  return value
}
const phase = (extra = {}) => ({ id: 'synthetic-phase', dose: '5', dose_unit: 'mg', dose_semantics_version: 1, frequency: 'daily', start_week: 1, end_week: 2, ...extra })
const entry = (extra = {}) => entryFromForm({ input_mode: 'medication', dose: '4.50e-3', dose_unit: 'mg', reviewed: true, ...extra })
async function exported(file, compound) {
  const protocols = freeze([{ id: 'synthetic-protocol', name: 'Synthetic plan', status: 'completed', start_date: '2026-01-01T12:00:00Z', compounds: [{ id: 'synthetic-compound', name: 'Synthetic compound', vial_strength: 20, vial_unit: 'mg', bac_water_ml: 2, ml_per_dose: .4, phases: [], injection_logs: [], ...compound }] }])
  const before = JSON.stringify(protocols), calls = []
  let blob, clicked = false, removed = false, revoked = false
  const link = { style: {}, click() { clicked = true }, remove() { removed = true } }
  const context = { ...recorded, protocolLifecycle, localCalendarDate: () => '2026-10-04', Blob,
    createClient: () => ({ auth: { async getUser() { calls.push('auth'); return { data: { user: { id: 'synthetic-owner' } } } } }, from(table) {
      assert.equal(table, 'protocols'); calls.push('from')
      return { select(columns) { assert.ok(columns.includes('injection_logs(date, taken)')); calls.push('select'); return this }, async eq(column, owner) {
        assert.equal(column, 'user_id'); assert.equal(owner, 'synthetic-owner'); calls.push('eq'); return { data: protocols }
      } }
    } }),
    window: { URL: { createObjectURL(value) { blob = value; return 'blob:synthetic-csv' }, revokeObjectURL(url) { assert.equal(url, 'blob:synthetic-csv'); revoked = true } }, setTimeout(callback) { callback() } },
    document: { createElement(tag) { assert.equal(tag, 'a'); return link }, body: { appendChild(value) { assert.equal(value, link) } } },
    alert() { assert.fail('Unexpected empty export') },
  }
  await handler(file, context)()
  assert.deepEqual(calls, ['auth', 'from', 'select', 'eq'], 'Only authenticated owner-scoped reads occur')
  assert.equal(JSON.stringify(protocols), before, 'Source records and injection logs remain unchanged')
  assert.ok(clicked && removed && revoked, 'Existing download and URL cleanup remain functional')
  assert.match(link.download, /^protocol-export-.*\.csv$/)
  assert.equal(blob.type, 'text/csv')
  const [headers, ...rows] = parseCsv(await blob.text())
  for (const row of rows) assert.equal(row.length, headers.length, 'Column positions remain aligned')
  return { headers, rows }
}

for (const file of ['../app/protocol/page.tsx', '../app/protocol/manage/page.tsx']) {
  const label = file.includes('/manage/') ? 'Manage CSV' : 'Today CSV'
  test(`${label}: no-phase count includes only taken logs and physical vial usage stays unknown`, async () => {
    const { headers, rows } = await exported(file, { injection_logs: [true, false, null, undefined, 1, 'true', true].map(taken => ({ date: '2026-01-02', taken })) })
    assert.equal(headers[7], 'Total Injections')
    assert.equal(headers[8], 'Vials Used')
    assert.equal(rows[0][7], '2')
    assert.equal(rows[0][8], 'Unknown')
    assert.equal(headers[9], 'Legacy compound mL per injection (origin unverified)')
    assert.equal(rows[0][9], '0.4')
  })
  test(`${label}: phase count retains inclusive boundaries and excludes untaken/outside logs`, async () => {
    const injection_logs = [
      { date: '2026-01-01T11:59:59Z', taken: true },
      { date: '2026-01-01T12:00:00Z', taken: true },
      { date: '2026-01-04T12:00:00Z', taken: false },
      { date: '2026-01-05T12:00:00Z', taken: 'true' },
      { date: '2026-01-08T12:00:00Z', taken: true },
      { date: '2026-01-08T12:00:01Z', taken: true },
    ]
    const { rows } = await exported(file, { phases: [phase()], injection_logs })
    assert.equal(rows[0][7], '2')
    assert.equal(rows[0][8], 'Unknown')
  })
  test(`${label}: empty taken history is zero injections but never zero physical vials`, async () => {
    for (const phases of [[], [phase()]]) {
      const { rows } = await exported(file, { phases, vial_strength: 0, ml_per_dose: 0, injection_logs: [{ date: '2026-01-02', taken: false }] })
      assert.equal(rows[0][7], '0')
      assert.equal(rows[0][8], 'Unknown')
      assert.equal(rows[0][9], '0', 'An actually saved zero volume stays zero')
    }
  })
  test(`${label}: raw legacy volume is retained with unverified origin; absence stays unknown`, async () => {
    for (const value of [null, undefined, 0, '0.0', '.4000', '4.50e-3']) {
      for (const phases of [[], [phase()]]) {
        const { headers, rows } = await exported(file, { ml_per_dose: value, phases })
        assert.equal(headers[9], 'Legacy compound mL per injection (origin unverified)')
        assert.equal(rows[0][9], value == null ? 'Unknown' : String(value))
        assert.equal(rows[0][8], 'Unknown')
      }
    }
  })
  test(`${label}: explicit medication retains original precision, zeros and JSON provenance`, async () => {
    for (const amount of ['4.5000', '4.50e-3', '4e0', '0', '0.0']) {
      const dosing_entry = entry({ dose: amount })
      const { headers, rows } = await exported(file, { phases: [phase({ dosing_entry, dose: 99 })] })
      const row = rows[0]
      assert.equal(row[2], amount)
      assert.equal(row[3], 'mg')
      assert.equal(row[headers.indexOf('Medication provenance')], 'explicit_medication_entry')
      assert.equal(row[headers.indexOf('Original amount')], amount)
      assert.deepEqual(JSON.parse(row[headers.indexOf('Original dosing entry JSON')]), dosing_entry)
      assert.equal(row[8], 'Unknown')
    }
  })
  test(`${label}: known legacy medication semantics retain original values`, async () => {
    const { headers, rows } = await exported(file, { phases: [phase({ dose: '1.00e0', dose_unit: 'IU' })] })
    assert.equal(rows[0][2], '1.00e0'); assert.equal(rows[0][3], 'IU')
    assert.equal(rows[0][headers.indexOf('Medication provenance')], 'legacy_medication_semantics_v1')
  })
  test(`${label}: syringe, volume and ambiguous legacy cannot acquire derived medication`, async () => {
    const entries = [
      entry({ input_mode: 'syringe', dose: '', syringe_markings: '40.00', syringe_scale: '100', preparation: 'mixing', vial_strength: '20', vial_unit: 'mg', bac_water_ml: '2' }),
      entry({ input_mode: 'volume', dose: '', injection_volume: '.4000', preparation: 'ready', concentration_value: '10', concentration_unit: 'mg/mL' }),
    ]
    const candidates = entries.map(dosing_entry => phase({ dosing_entry }))
    candidates.push(phase({ dose: '4.000', dose_semantics_version: null, syringe_units: 40, injection_volume_ml: .4 }))
    for (const candidate of candidates) {
      const { headers, rows } = await exported(file, { phases: [candidate] })
      assert.equal(rows[0][2], '', 'No medication amount is invented from administration or preparation')
      assert.equal(rows[0][3], '')
      assert.equal(rows[0][headers.indexOf('Medication provenance')], 'not_recorded')
      const originalJson = rows[0][headers.indexOf('Original dosing entry JSON')]
      if (candidate.dosing_entry) assert.deepEqual(JSON.parse(originalJson), candidate.dosing_entry)
      else { assert.equal(originalJson, ''); assert.equal(rows[0][headers.indexOf('Original amount')], '4.000') }
      assert.equal(rows[0][8], 'Unknown')
    }
  })
}

for (const file of ['../app/protocol/page.tsx', '../app/protocol/manage/page.tsx']) {
 const label = file.includes('/manage/') ? 'Manage CSV' : 'Today CSV'
 test(`${label}: runtime units remain unknown and original malformed JSON survives actual export`, async () => {
  const valid = await exported(file, { phases: [phase({ dosing_entry: entry() })] })
  for (const unit of [null, undefined, '', '  ', 2, true, false, { unit: 'mg,"quoted"\nunit' }, ['mg']]) {
   const dosing_entry = { ...entry(), dose_unit: unit }
   for (const candidate of [phase({ dosing_entry }), phase({ dose: '4.50e-3', dose_unit: unit })]) {
    const { headers, rows } = await exported(file, { phases: [candidate] })
    assert.deepEqual(headers, valid.headers, 'CSV column schema is unchanged')
    assert.equal(rows.length, 1)
    const row = rows[0]
    assert.equal(row[2], ''); assert.equal(row[3], '', 'No malformed unit becomes medication')
    assert.equal(row[headers.indexOf('Medication provenance')], 'not_recorded')
    assert.equal(row[headers.indexOf('Original amount unit')], typeof unit === 'string' ? unit : '')
    assert.equal(row[headers.indexOf('Original amount')], candidate.dosing_entry ? '4.50e-3' : candidate.dose)
    if (candidate.dosing_entry) {
     assert.deepEqual(JSON.parse(row[headers.indexOf('Original dosing entry JSON')]), JSON.parse(JSON.stringify(dosing_entry)))
    }
   }
  }
 })
 test(`${label}: all supported medication units retain exact raw output`, async () => {
  for (const unit of ['mg', 'mcg', 'IU']) {
   const dosing_entry = entry({ dose_unit: unit })
   const { headers, rows } = await exported(file, { phases: [phase({ dosing_entry })] })
   assert.equal(rows[0][2], '4.50e-3'); assert.equal(rows[0][3], unit)
   assert.equal(rows[0][headers.indexOf('Original amount unit')], unit)
   assert.deepEqual(JSON.parse(rows[0][headers.indexOf('Original dosing entry JSON')]), dosing_entry)
  }
 })
}