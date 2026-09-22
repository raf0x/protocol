import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url), ts = require('typescript'), cache = new Map()
function load(path) {
  const url = path.startsWith('file:') ? new URL(path) : new URL(path, import.meta.url)
  if (cache.has(url.href)) return cache.get(url.href)
  const out = { exports: {} }
  const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('require', 'module', 'exports', code)(name => {
    if (!name.startsWith('.')) return require(name)
    for (const suffix of ['', '.ts']) { try { return load(new URL(name + suffix, url).href) } catch (error) { if (error.code !== 'ENOENT') throw error } }
    throw new Error(`Missing module ${name}`)
  }, out, out.exports)
  cache.set(url.href, out.exports); return out.exports
}

const findings = load('../lib/health/labFindings.ts')

const ref = (status = 'normal', low = 2, high = 20, text = null) => ({ low, high, text, status, statusSource: 'reported' })
const reading = (id, date, value, extra = {}) => ({
  biomarkerKey: 'fictional-marker', name: 'Fictional marker', resultId: `result-${id}`, panelId: `panel-${id}`,
  ownerId: 'fictional-owner', date, value, unit: 'mg/dL', originalUnit: 'mg/dL', reference: ref(),
  provenance: { sourceType: 'csv', filename: 'fictional.csv', parser: 'fixture', rowIndex: 1, confidence: 'high', rawAvailable: true, metadataAvailable: true },
  issues: [], ...extra,
})
const date = row => ({ date: row.date, observations: [row], reading: row, reasons: [] })
const comparison = (previous, current, transition = 'remained_inside', limitations = ['assay_method_unknown']) => ({
  previous, current, unit: previous.unit, delta: current.value - previous.value, absoluteDelta: Math.abs(current.value - previous.value),
  percent: previous.value > 0 ? (current.value - previous.value) / previous.value * 100 : null,
  elapsedDays: Math.round((Date.parse(current.date) - Date.parse(previous.date)) / 86400000),
  direction: current.value > previous.value ? 'increased' : current.value < previous.value ? 'decreased' : 'unchanged',
  range: { previous: previous.reference.status === 'normal' ? 'inside' : 'outside', current: current.reference.status === 'normal' ? 'inside' : 'outside', transition }, limitations,
})
const trajectory = (rows, opts = {}) => {
  const ordered = rows.filter(Boolean)
  const latest = ordered.at(-1) ?? null, previous = ordered.at(-2) ?? null, earliest = ordered[0] ?? null
  const prior = ordered.slice(0, -1)
  const comp = previous && latest ? comparison(previous, latest, opts.transition ?? 'remained_inside', opts.comparisonLimitations ?? ['assay_method_unknown']) : null
  return {
    dates: ordered.map(date), ordered, latest, previous, earliest, priorEligibleDates: prior.length,
    priorObservedExtent: prior.length ? { min: Math.min(...prior.map(r => r.value)), max: Math.max(...prior.map(r => r.value)), start: prior[0].date, end: prior.at(-1).date, count: prior.length } : null,
    latestVsPrevious: { comparison: comp, reasons: comp ? [] : ['missing_comparator'], observations: ordered },
    latestVsEarliest: { comparison: comp, reasons: comp ? [] : ['missing_comparator'], observations: ordered },
    latestRecordedPair: { comparison: comp, reasons: opts.reasons ?? (comp ? [] : ['missing_comparator']), observations: ordered },
    limitations: opts.limitations ?? (ordered.length < 2 ? ['insufficient_history', 'assay_method_unknown'] : ['assay_method_unknown']),
  }
}
const series = (rows, opts = {}) => ({ biomarkerKey: opts.key ?? 'fictional-marker', biomarkerName: opts.name ?? 'Fictional marker', unit: opts.unit ?? 'mg/dL', trajectory: trajectory(rows, opts) })
const deriveOne = (rows, opts = {}) => findings.deriveLabFindings({ series: [series(rows, opts)] })[0]
const membership = (change, extra = {}) => ({ key: 'fictional-marker', name: 'Fictional marker', currentPanelId: 'panel-new', previousPanelId: 'panel-old', currentResultIds: ['result-new'], previousResultIds: ['result-old'], currentUsable: true, previousUsable: true, change, ...extra })

function rangePair(beforeStatus, afterStatus, beforeValue, afterValue, transition) {
  const a = reading('old', '2026-01-01', beforeValue, { reference: ref(beforeStatus) })
  const b = reading('new', '2026-02-01', afterValue, { reference: ref(afterStatus) })
  return { rows: [a, b], opts: { transition } }
}

test('newly outside range outranks generic increase', () => {
  const { rows, opts } = rangePair('normal', 'high', 10, 25, 'newly_outside')
  const f = deriveOne(rows, opts); assert.equal(f.type, 'newly_outside_range'); assert.equal(f.priority, 'attention')
})
test('returned to range outranks generic decrease', () => {
  const { rows, opts } = rangePair('high', 'normal', 25, 18, 'returned_inside')
  const f = deriveOne(rows, opts); assert.equal(f.type, 'returned_to_range'); assert.equal(f.priority, 'context')
})
test('persistently high and increasing is attention without risk language', () => {
  const { rows, opts } = rangePair('high', 'high', 25, 30, 'persistently_outside')
  const f = deriveOne(rows, opts); assert.equal(f.type, 'persistently_outside_range'); assert.equal(f.priority, 'attention')
})
test('persistently high but decreasing remains context', () => {
  const { rows, opts } = rangePair('high', 'high', 30, 25, 'persistently_outside')
  assert.equal(deriveOne(rows, opts).priority, 'context')
})
test('persistently low and decreasing is attention', () => {
  const { rows, opts } = rangePair('low', 'low', 1.5, 1, 'persistently_outside')
  assert.equal(deriveOne(rows, opts).priority, 'attention')
})
test('unknown prior status does not create a range-transition finding', () => {
  const a = reading('old', '2026-01-01', 10, { reference: ref('unknown', null, null) })
  const b = reading('new', '2026-02-01', 25, { reference: ref('high') })
  const f = deriveOne([a, b], { transition: 'prior_status_unknown' })
  assert.equal(f.type, 'increased'); assert.notEqual(f.type, 'newly_outside_range')
})
test('changed reference range does not invent a transition', () => {
  const a = reading('old', '2026-01-01', 10, { reference: ref('normal', 2, 20) })
  const b = reading('new', '2026-02-01', 25, { reference: ref('high', 3, 19) })
  assert.equal(deriveOne([a, b], { transition: 'reference_ranges_differ' }).type, 'increased')
})
test('generic increase is informational when no more specific fact applies', () => assert.equal(deriveOne([reading('old','2026-01-01',10), reading('new','2026-02-01',12)]).type, 'increased'))
test('generic decrease is informational', () => assert.equal(deriveOne([reading('old','2026-01-01',12), reading('new','2026-02-01',10)]).type, 'decreased'))
test('unchanged is informational', () => assert.equal(deriveOne([reading('old','2026-01-01',10), reading('new','2026-02-01',10)]).type, 'unchanged'))
test('outside previously observed high requires at least two prior eligible readings', () => {
  const f = deriveOne([reading('a','2025-12-01',8), reading('b','2026-01-01',10), reading('c','2026-02-01',14)])
  assert.equal(f.type, 'outside_previously_observed_values'); assert.match(f.reason, /above the prior eligible values/i)
})
test('outside previously observed low', () => {
  const f = deriveOne([reading('a','2025-12-01',8), reading('b','2026-01-01',10), reading('c','2026-02-01',6)])
  assert.equal(f.type, 'outside_previously_observed_values'); assert.match(f.reason, /below the prior eligible values/i)
})
test('reversal within previously observed values is distinct from a new personal extreme', () => {
  const f = deriveOne([reading('a','2025-12-01',8), reading('b','2026-01-01',12), reading('c','2026-02-01',10)])
  assert.equal(f.type, 'reversal')
  assert.equal(f.evidence.personalHistory.personalExtreme, null)
})
test('one eligible date produces insufficient history', () => assert.equal(deriveOne([reading('new','2026-02-01',10)]).type, 'insufficient_history'))
test('missing comparator reasons remain limitations', () => assert.ok(deriveOne([reading('new','2026-02-01',10)]).limitations.includes('missing_comparator')))
test('incompatible unit limitation never fabricates direction', () => {
  const f = deriveOne([reading('new','2026-02-01',10)], { limitations: ['incompatible_unit'], reasons: ['incompatible_unit'] })
  assert.equal(f.type, 'incompatible_comparison'); assert.ok(f.limitations.includes('incompatible_unit'))
})
test('missing unit limitation never fabricates direction', () => {
  const f = deriveOne([reading('new','2026-02-01',10)], { unit: '', limitations: ['missing_unit'], reasons: ['missing_unit'] })
  assert.equal(f.type, 'insufficient_history'); assert.ok(f.limitations.includes('missing_unit'))
})
for (const gap of ['qualitative_value', 'conflicting_same_day', 'same_day_records', 'malformed_value', 'invalid_date']) test(`${gap} remains insufficient rather than directional`, () => {
  const f = deriveOne([reading('new','2026-02-01',10)], { limitations: [gap], reasons: [gap] })
  assert.equal(f.type, 'insufficient_history'); assert.ok(f.limitations.includes(gap))
})
test('zero baseline keeps deterministic direction without inventing percentage-dependent semantics', () => {
  const f = deriveOne([reading('old','2026-01-01',0), reading('new','2026-02-01',2)])
  assert.equal(f.type, 'increased')
})
test('negative baseline keeps deterministic direction without inventing percentage-dependent semantics', () => {
  const f = deriveOne([reading('old','2026-01-01',-10), reading('new','2026-02-01',-8)])
  assert.equal(f.type, 'increased')
})
test('newly measured panel membership suppresses insufficient history', () => {
  const s = series([reading('new','2026-02-01',10)])
  const out = findings.deriveLabFindings({ series: [s], memberships: [membership('newly_measured', { previousResultIds: [] })] })
  assert.deepEqual(out.map(f => f.type), ['newly_measured'])
})
test('missing from latest panel suppresses stale trajectory finding', () => {
  const s = series([reading('old','2026-01-01',10)])
  const out = findings.deriveLabFindings({ series: [s], memberships: [membership('absent_from_latest', { currentResultIds: [], currentUsable: false })] })
  assert.deepEqual(out.map(f => f.type), ['missing_from_latest_panel']); assert.equal(out[0].evidence.current, null)
})
test('present both does not override trajectory finding', () => {
  const s = series([reading('old','2026-01-01',10), reading('new','2026-02-01',12)])
  const out = findings.deriveLabFindings({ series: [s], memberships: [membership('present_both')] })
  assert.equal(out[0].type, 'increased')
})
test('no previous panel does not manufacture newly measured', () => {
  const s = series([reading('new','2026-02-01',10)])
  const out = findings.deriveLabFindings({ series: [s], memberships: [membership('no_previous_panel', { previousPanelId: null, previousResultIds: [], previousUsable: false })] })
  assert.equal(out[0].type, 'insufficient_history')
})
test('cross-owner limitation yields no finding', () => {
  const s = series([reading('new','2026-02-01',10)], { limitations: ['different_owners'], reasons: ['different_owners'] })
  assert.deepEqual(findings.deriveLabFindings({ series: [s] }), [])
})
test('finding provenance references current and previous source identities', () => {
  const f = deriveOne([reading('old','2026-01-01',10), reading('new','2026-02-01',12)])
  assert.equal(f.evidence.previous.resultId, 'result-old'); assert.equal(f.evidence.current.resultId, 'result-new')
  assert.equal(f.evidence.comparison.previous.panelId, 'panel-old'); assert.equal(f.evidence.comparison.current.panelId, 'panel-new')
})
test('finding evidence excludes owner identity and parser raw content', () => {
  const f = deriveOne([reading('old','2026-01-01',10), reading('new','2026-02-01',12)])
  const serialized = JSON.stringify(f); assert.doesNotMatch(serialized, /fictional-owner|fictional\.csv|source_raw/)
  assert.equal(f.evidence.history[0].provenance.sourceType, 'csv')
})
test('source trajectories are not mutated', () => {
  const s = series([reading('old','2026-01-01',10), reading('new','2026-02-01',12)])
  const before = JSON.stringify(s); findings.deriveLabFindings({ series: [s] }); assert.equal(JSON.stringify(s), before)
})
test('stable ordering uses priority, specificity, recency, then name', () => {
  const attention = deriveOne(rangePair('normal','high',10,25,'newly_outside').rows, { transition: 'newly_outside', key: 'b', name: 'Beta' })
  const context = deriveOne([reading('a','2025-12-01',8), reading('b','2026-01-01',10), reading('c','2026-02-01',14)], { key: 'a', name: 'Alpha' })
  const info = deriveOne([reading('old','2026-01-01',10), reading('new','2026-02-01',12)], { key: 'c', name: 'Charlie' })
  assert.deepEqual(findings.rankLabFindings([info, context, attention]).map(f => f.priority), ['attention','context','informational'])
})
test('ranking is invariant to source finding order', () => {
  const a = { ...deriveOne([reading('old','2026-01-01',10), reading('new','2026-02-01',12)]), biomarkerKey: 'a', biomarkerName: 'Alpha', id: 'a' }
  const b = { ...a, biomarkerKey: 'b', biomarkerName: 'Beta', id: 'b' }
  assert.deepEqual(findings.rankLabFindings([b,a]).map(f=>f.id), findings.rankLabFindings([a,b]).map(f=>f.id))
})
test('findingsForBiomarker returns only requested identity', () => {
  const a = { ...deriveOne([reading('old','2026-01-01',10), reading('new','2026-02-01',12)]), biomarkerKey: 'a', id: 'a' }
  const b = { ...a, biomarkerKey: 'b', id: 'b' }
  assert.deepEqual(findings.findingsForBiomarker([a,b], 'b').map(f=>f.id), ['b'])
})
test('highestPriorityFindings returns only the top available tier', () => {
  const attention = deriveOne(rangePair('normal','high',10,25,'newly_outside').rows, { transition: 'newly_outside' })
  const info = deriveOne([reading('old','2026-01-01',10), reading('new','2026-02-01',12)])
  assert.deepEqual(findings.highestPriorityFindings([info, attention]).map(f=>f.priority), ['attention'])
})
test('headlines omit unchanged and insufficient findings', () => {
  const unchanged = deriveOne([reading('old','2026-01-01',10), reading('new','2026-02-01',10)])
  const insufficient = deriveOne([reading('new','2026-02-01',10)])
  const increase = deriveOne([reading('old','2026-01-01',10), reading('new','2026-02-01',12)])
  assert.deepEqual(findings.selectHeadlineFindings([unchanged, insufficient, increase]).map(f=>f.type), ['increased'])
})
test('headline limit is deterministic and validated', () => {
  const f = deriveOne([reading('old','2026-01-01',10), reading('new','2026-02-01',12)])
  assert.equal(findings.selectHeadlineFindings([f], 0).length, 0)
  assert.throws(() => findings.selectHeadlineFindings([f], -1), /non-negative integer/)
})
test('specific range finding suppresses redundant generic and personal-history findings', () => {
  const a = reading('a','2025-12-01',8, { reference: ref('normal') }), b = reading('b','2026-01-01',10, { reference: ref('normal') }), c = reading('c','2026-02-01',25, { reference: ref('high') })
  const out = findings.deriveLabFindings({ series: [series([a,b,c], { transition: 'newly_outside' })] })
  assert.deepEqual(out.map(f=>f.type), ['newly_outside_range'])
})
test('generated finding language contains no causal, diagnostic, safety or personal-normal claims', () => {
  const examples = [
    deriveOne(rangePair('normal','high',10,25,'newly_outside').rows, { transition: 'newly_outside' }),
    deriveOne(rangePair('high','normal',25,18,'returned_inside').rows, { transition: 'returned_inside' }),
    deriveOne([reading('a','2025-12-01',8), reading('b','2026-01-01',10), reading('c','2026-02-01',14)]),
    deriveOne([reading('new','2026-02-01',10)]),
  ]
  const text = examples.map(f=>f.reason).join(' ').toLowerCase()
  for (const forbidden of ['caused','treatment improved','treatment worsened','clinically significant','normal for this person','safe','optimal','dangerous']) assert.ok(!text.includes(forbidden), forbidden)
})
test('lab findings module has no reads, persistence, provider calls, journal or weight dependencies', () => {
  const source = readFileSync(new URL('../lib/health/labFindings.ts', import.meta.url), 'utf8')
  for (const forbidden of ['supabase', 'fetch(', 'openai', 'journal', 'weight', 'insert(', 'update(', 'delete(']) assert.ok(!source.toLowerCase().includes(forbidden), forbidden)
})

test('membership provenance attaches to the unit series containing the referenced result', () => {
  const mg = series([reading('old','2026-01-01',10)], { unit: 'mg/dL' })
  mg.trajectory.dates[0].observations[0].unit = 'mg/dL'; mg.trajectory.dates[0].reading.unit = 'mg/dL'; mg.trajectory.ordered[0].unit = 'mg/dL'; mg.trajectory.latest.unit = 'mg/dL'; mg.trajectory.earliest.unit = 'mg/dL'
  const pgReading = reading('new','2026-02-01',12, { unit: 'pg/mL', originalUnit: 'pg/mL' })
  const pg = series([pgReading], { unit: 'pg/mL' })
  const out = findings.deriveLabFindings({ series: [mg, pg], memberships: [membership('newly_measured', { currentResultIds: ['result-new'], previousResultIds: [] })] })
  assert.equal(out[0].unit, 'pg/mL'); assert.equal(out[0].evidence.current.resultId, 'result-new')
})

test('an unusable newest recorded date never promotes an older eligible pair as current finding', () => {
  const old = reading('old','2026-01-01',8), middle = reading('middle','2026-02-01',10)
  const t = trajectory([old, middle])
  const ambiguous = reading('ambiguous','2026-03-01',14)
  t.dates.push({ date: ambiguous.date, observations: [ambiguous, { ...ambiguous, resultId: 'result-ambiguous-2' }], reading: null, reasons: ['same_day_records'] })
  t.ordered = [old, middle]
  t.latest = middle
  t.previous = old
  t.latestRecordedPair = { comparison: null, reasons: ['same_day_records'], observations: [middle, ambiguous] }
  t.limitations = ['same_day_records', 'excluded_history', 'assay_method_unknown']
  const out = findings.deriveLabFindings({ series: [{ biomarkerKey: 'fictional-marker', biomarkerName: 'Fictional marker', unit: 'mg/dL', trajectory: t }] })
  assert.equal(out[0].type, 'insufficient_history'); assert.ok(out[0].limitations.includes('same_day_records'))
})
