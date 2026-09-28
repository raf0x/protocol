import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import React from 'react'
import ts from 'typescript'
import { reactHarness } from './helpers/reactHarness.mjs'
import { testosteroneImportHistory } from './fixtures/lab-findings-ux.mjs'

const require = createRequire(import.meta.url)

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const baseline = read('components/timeline/TimelineBaseline.tsx')
const history = read('components/timeline/TimelineHistory.tsx')
const timelinePage = read('app/timeline/page.tsx')
const timelineCss = read('app/timeline/timeline.module.css')
const briefing = read('components/health/HealthBriefing.tsx')
const findings = read('components/health/LabFindingsSummary.tsx')
const dashboard = read('components/health/HealthDashboard.tsx')
const insights = read('components/health/LabInsights.tsx')
const healthCss = read('app/health/health.module.css')

const styleModule = new Proxy({}, { get: (_target, property) => String(property) })
const Link = ({ children, ...props }) => React.createElement('a', props, children)

function componentRuntime(overrides = {}, options = {}) {
  const renderer = reactHarness()
  let nextId = 0
  const fakeReact = {
    ...React,
    useEffect: options.useEffect ?? renderer.hooks.useEffect,
    useLayoutEffect: renderer.hooks.useEffect,
    useMemo: callback => callback(),
    useId: () => `test-id-${++nextId}`,
    useRef: renderer.hooks.useRef,
    useState: renderer.hooks.useState,
  }
  const cache = new Map()
  function load(path) {
    const url = path instanceof URL ? path : new URL(path, import.meta.url)
    if (cache.has(url.href)) return cache.get(url.href)
    const out = { exports: {} }
    cache.set(url.href, out.exports)
    const code = ts.transpileModule(readFileSync(url, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
    } }).outputText
    new Function('require', 'module', 'exports', code)(name => {
      if (Object.hasOwn(overrides, name)) return overrides[name]
      if (name === 'react') return fakeReact
      if (name === 'next/link') return { __esModule: true, default: Link }
      if (name.endsWith('.css')) return { __esModule: true, default: styleModule }
      if (!name.startsWith('.')) return require(name)
      for (const suffix of ['', '.ts', '.tsx']) {
        const candidate = new URL(name + suffix, url)
        if (existsSync(candidate)) return load(candidate)
      }
      throw new Error(`Missing test module ${name} from ${url.pathname}`)
    }, out, out.exports)
    cache.set(url.href, out.exports)
    return out.exports
  }
  return { load, render: element => renderer.render(element), reset: renderer.reset }
}

function nodes(node, predicate) {
  if (node == null || typeof node !== 'object') return []
  if (Array.isArray(node)) return node.flatMap(child => nodes(child, predicate))
  return [...(predicate(node) ? [node] : []), ...nodes(node.props?.children, predicate)]
}

function renderedText(node, accessible = false) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(child => renderedText(child, accessible)).join('')
  if (accessible && node.props?.['aria-hidden'] === true) return ''
  return renderedText(node.props?.children, accessible)
}

const summaryAccessibleName = summary => summary.props['aria-label'] ?? renderedText(summary, true)

function findingsRuntime() {
  const runtime = componentRuntime()
  const component = runtime.load('../components/health/LabFindingsSummary.tsx')
  const { biomarkerHistories } = runtime.load('../lib/health/labs.ts')
  return {
    ...runtime,
    component,
    model(panels) { return component.buildLabFindingsSummaryModel(panels, biomarkerHistories(panels)) },
  }
}

const supplementalUpdate = (extra = {}) => ({
  kind: 'latest_without_comparison', id: 'latest:one', biomarkerKey: 'single-marker', biomarkerName: 'Single marker',
  value: 31, unit: 'mg/dL', date: '2026-09-08', panelName: 'Test panel', provider: 'Test lab',
  evidenceReasons: ['missing_comparator'], label: '1 reading',
  reference: { low: 5, high: 20, text: null, status: 'high', statusSource: 'reported' },
  needsVerification: true, href: '/health?biomarker=single-marker', ...extra,
})

function emptyReadyModel() {
  return { state: 'ready', latestDate: '2026-09-08', latestPanelId: 'latest', headlines: [], totalFindingsCount: 0,
    newlyMeasuredCount: 0, missingFromLatestCount: 0, previousPanelAmbiguous: false }
}

test('timeline scorecard keeps only existing baseline facts', () => {
  for (const label of ['Latest weight', 'Active protocols', 'Last protocol change']) assert.match(baseline, new RegExp(label))
  assert.ok(!/health score|readiness score|protocol score/i.test(baseline))
})

test('timeline scorecard uses compact KPI presentation', () => {
  assert.match(baseline, /baselineKpis/)
  assert.match(baseline, /kpiWide/)
  assert.match(timelineCss, /\.baselineKpis \{ display: grid;/)
})

test('timeline event grouping happens after the existing filter', () => {
  assert.ok(timelinePage.indexOf('events.filter') < timelinePage.indexOf('groupTimeline(visible)'))
})

test('timeline months are collapsible and newest month starts expanded', () => {
  assert.match(history, /<details className=\{styles\.monthGroup\}/)
  assert.match(history, /open=\{index === 0\}/)
  assert.match(history, /eventCount = month\.days\.reduce/)
})

test('timeline month counts come from events inside each filtered month', () => {
  assert.match(history, /day\.events\.length/)
  assert.match(history, /eventCount === 1 \? 'event' : 'events'/)
})

test('timeline month controls preserve event IDs and cards', () => {
  assert.match(history, /key=\{event\.id\}/)
  assert.match(history, /<TimelineEventCard event=\{event\}/)
})

test('timeline month disclosure is visually compact and keyboard-focusable through summary', () => {
  const runtime = componentRuntime()
  const TimelineHistory = runtime.load('../components/timeline/TimelineHistory.tsx').default
  const rendered = runtime.render(React.createElement(TimelineHistory, {
    months: [
      { key: '2026-09', label: 'September 2026', days: [] },
      { key: '2026-08', label: 'August 2026', days: [] },
    ], comparisons: new Map(),
  }))
  const groups = nodes(rendered, node => node.type === 'details')
  assert.equal(groups.length, 2)
  assert.equal(groups[0].props.open, true)
  assert.equal(groups[1].props.open, false)
  const summaries = groups.map(group => nodes(group, node => node.type === 'summary')[0])
  assert.deepEqual(summaries.map(summary => summary.props.children.map(child => renderedText(child, true))), [
    ['September 2026', '0 events'], ['August 2026', '0 events'],
  ])
  for (const summary of summaries) {
    assert.equal(summary.type, 'summary')
    assert.equal(summary.props.className, 'monthSummary')
    assert.equal(summary.props.role, undefined)
    assert.equal(summary.props.tabIndex, undefined)
  }
  const indicators = nodes(rendered, node => node.props?.className === 'monthChevron')
  assert.equal(indicators.length, 2)
  assert.ok(indicators.every(indicator => indicator.props['aria-hidden'] === 'true' && renderedText(indicator) === ''))
  assert.doesNotMatch(renderedText(rendered), /[\u00c3\u00e2\u203a]/)
  assert.doesNotMatch(timelineCss, /[\u00c3\u00e2\u203a]|monthSummary span::after/)
  assert.match(timelineCss, /\.monthSummary \{[^}]*min-height:\s*52px/s)
  assert.match(timelineCss, /:is\([^)]*\bsummary\b[^)]*\):focus-visible/)
  assert.match(timelineCss, /\.monthSummary::marker \{[^}]*content:\s*''/s)
  assert.match(timelineCss, /\.monthSummary::-webkit-details-marker \{[^}]*display:\s*none/s)
  assert.match(timelineCss, /\.monthChevron \{[^}]*border-right:\s*2px solid var\(--app-secondary\);[^}]*border-bottom:\s*2px solid var\(--app-secondary\);[^}]*transform:\s*rotate\(-45deg\)/s)
  assert.match(timelineCss, /\.monthGroup\[open\] \.monthChevron \{[^}]*transform:\s*rotate\(45deg\)/s)
})

test('health briefing uses a compact active-compound grid', () => {
  assert.match(briefing, /briefingCompounds/)
  assert.match(healthCss, /\.briefingCompounds \{ display: grid;/)
})

test('compound identity color is derived from protocol and compound identity only', () => {
  assert.match(briefing, /const identity = `\$\{item\.protocolId\}:\$\{item\.compoundId\}`/)
  assert.match(briefing, /compoundAccent\(identity\)/)
  assert.match(briefing, /hash % 5/)
})

test('compound presentation preserves medication dose, frequency, and route order', () => {
  assert.match(briefing, /item\.medication[\s\S]*item\.frequency, item\.route/)
  assert.ok(!briefing.includes('syringe_units'))
  assert.ok(!briefing.includes('injection_volume'))
})

test('compound decorative accents do not reuse status-semantic success or warning tokens', () => {
  const accentCss = healthCss.slice(healthCss.indexOf('.compoundAccent'), healthCss.indexOf('.briefingFinding'))
  assert.ok(!accentCss.includes('var(--app-success)'))
  assert.ok(!accentCss.includes('var(--app-warning)'))
})

test('health briefing does not change the five-compound model contract', () => {
  assert.match(briefing, /snapshot\.compounds\.map/)
  assert.match(briefing, /snapshot\.additionalCompounds/)
})

test('embedded Lab updates is capped at four total updates without deriving findings in presentation', () => {
  assert.match(findings, /embedded \? model\.headlines\.slice\(0, 4\) : model\.headlines/)
  assert.match(findings, /supplemental\.slice\(0, Math\.max\(0, 4 - visibleHeadlines\.length\)\)/)
  assert.ok(!findings.includes('deriveLabFindings'))
})

test('embedded finding cards retain evidence disclosure', () => {
  const runtime = findingsRuntime()
  const panels = testosteroneImportHistory()
  const rendered = runtime.render(React.createElement(runtime.component.default, { model: runtime.model(panels), embedded: true }))
  const card = nodes(rendered, node => node.type === 'article')[0]
  const observations = nodes(card, node => node.props?.['data-comparison-preview'] !== undefined)[0]
  assert.equal(nodes(observations, node => node.type === 'strong').length, 3)
  assert.deepEqual(nodes(observations, node => node.type === 'time').map(node => node.props.dateTime), ['2026-04-10', '2026-06-29', '2026-09-08'])
  assert.match(renderedText(card), /Lab status: Normal/)
  assert.doesNotMatch(renderedText(card), /Reported status:/)
  assert.match(renderedText(card), /Imported result needs verification/)
  const details = nodes(card, node => node.type === 'details')[0]
  assert.equal(summaryAccessibleName(nodes(details, node => node.type === 'summary')[0]), 'View details')
  assert.match(renderedText(details), /Within the supplied 250\u20131100 range/)
  assert.doesNotMatch(renderedText(card), /Source evidence|Personal baseline|\bEvidence\b/)

  const withoutMetadata = structuredClone(panels)
  Object.assign(withoutMetadata.at(-1).results[0], {
    reference_low: null, reference_high: null, reference_text: null,
    status: 'unknown', status_source: 'unknown', import_confidence: null,
  })
  const plain = runtime.render(React.createElement(runtime.component.default, { model: runtime.model(withoutMetadata), embedded: true }))
  const plainCard = nodes(plain, node => node.type === 'article')[0]
  assert.equal(nodes(plainCard, node => node.props?.className === 'consumerStatus').length, 0)
  assert.equal(nodes(plainCard, node => node.props?.className === 'verificationNotice').length, 0)
  assert.equal(nodes(plainCard, node => node.type === 'details').length, 0)

  const unavailableSupplemental = runtime.render(React.createElement(runtime.component.default, {
    model: emptyReadyModel(), embedded: true,
    supplemental: [supplementalUpdate({ needsVerification: false,
      reference: { low: null, high: null, text: null, status: 'unknown', statusSource: 'unknown' } })],
  }))
  const unavailableCard = nodes(unavailableSupplemental, node => node.type === 'article')[0]
  assert.equal(nodes(unavailableCard, node => node.props?.className === 'consumerStatus').length, 0)
  assert.equal(nodes(unavailableCard, node => node.props?.className === 'verificationNotice').length, 0)
  assert.equal(nodes(unavailableCard, node => node.type === 'details').length, 0)
})

test('briefing update cards render name then value then status then Evidence', () => {
  const runtime = findingsRuntime()
  const canonicalTree = runtime.render(React.createElement(runtime.component.default, { model: runtime.model(testosteroneImportHistory()), embedded: true }))
  const supplementalTree = runtime.render(React.createElement(runtime.component.default, { model: emptyReadyModel(), supplemental: [supplementalUpdate()], embedded: true }))
  const canonical = nodes(canonicalTree, node => node.type === 'article')[0]
  const canonicalBlocks = nodes(canonical, node => node.type === 'h4' || node.type === 'ol'
    || (node.type === 'p' && ['consumerStatus', 'verificationNotice', 'summary'].includes(node.props.className)) || node.type === 'details')
  assert.deepEqual(canonicalBlocks.map(node => node.type === 'p' ? node.props.className : node.type),
    ['h4', 'ol', 'consumerStatus', 'verificationNotice', 'summary', 'details'])
  assert.equal(canonicalBlocks[1].props['aria-label'], 'Recent recorded values')
  assert.equal(renderedText(canonicalBlocks[2]), 'Lab status: Normal')

  const supplemental = nodes(supplementalTree, node => node.type === 'article')[0]
  const supplementalBlocks = nodes(supplemental, node => node.type === 'h4'
    || (node.type === 'p' && ['value briefingUpdateValue', 'consumerStatus', 'verificationNotice', 'summary'].includes(node.props.className)) || node.type === 'details')
  assert.deepEqual(supplementalBlocks.map(node => node.type === 'p' ? node.props.className : node.type),
    ['h4', 'value briefingUpdateValue', 'consumerStatus', 'verificationNotice', 'summary', 'details'])
  assert.equal(renderedText(supplementalBlocks[2]), 'Lab status: High')
  const preview = runtime.render(React.createElement(runtime.component.ComparisonPreview, { finding: runtime.model(testosteroneImportHistory()).headlines[0] }))
  const previewItems = nodes(preview, node => node.type === 'li')
  assert.equal(previewItems.length, 3)
  assert.deepEqual(previewItems.map(item => {
    const children = nodes(item, node => node.type === 'strong' || node.type === 'time')
    return { sequence: children.map(child => child.type), value: renderedText(children[0]), date: children[1].props.dateTime }
  }), [
    { sequence: ['strong', 'time'], value: '59 ng/dL', date: '2026-04-10' },
    { sequence: ['strong', 'time'], value: '1009 ng/dL', date: '2026-06-29' },
    { sequence: ['strong', 'time'], value: '1077 ng/dL', date: '2026-09-08' },
  ])
})

test('percentage change is formatted with no more than one decimal in presentation', () => {
  assert.match(findings, /maximumFractionDigits: 1/)
  assert.match(findings, /formatPercent\(comparison\.percent\)/)
})

test('underlying comparison percentage is not mutated', () => {
  assert.ok(!/comparison\.percent\s*=(?!=)/.test(findings))
})

test('Latest Panel summary sits between Health Briefing and Recent panels', () => {
  const briefingIndex = dashboard.indexOf('<HealthBriefing panels={panels} histories={histories} />')
  const summaryIndex = dashboard.indexOf('<LabHistorySummary panels={panels} histories={histories} />')
  const recentIndex = dashboard.indexOf('id="panels-heading"')
  assert.ok(briefingIndex > -1 && summaryIndex > briefingIndex && recentIndex > summaryIndex)
  assert.match(insights, /export function LabHistorySummary/)
  assert.equal((dashboard.match(/<LabHistorySummary /g) || []).length, 1)
})

test('Recent panels now renders before detailed LabInsights', () => {
  const recent = dashboard.indexOf('id="panels-heading"')
  const detail = dashboard.indexOf('<LabInsights panels={panels} histories={histories} />')
  assert.ok(recent > -1 && detail > -1 && recent < detail)
})

test('embedded Evidence disclosure is compact without changing its content path', () => {
  const runtime = findingsRuntime()
  const rendered = runtime.render(React.createElement(runtime.component.default, { model: runtime.model(testosteroneImportHistory()), embedded: true }))
  const details = nodes(rendered, node => node.type === 'details')[0]
  const summary = nodes(details, node => node.type === 'summary')[0]
  assert.equal(summary.type, 'summary')
  assert.equal(summaryAccessibleName(summary), 'View details')
  assert.match(renderedText(details), /Within the supplied 250\u20131100 range/)
  assert.doesNotMatch(renderedText(details), /Current:|Previous:|Change:|Limitations:|Source evidence/)
  assert.match(healthCss, /\.briefingFinding \.formDetails summary \{[^}]*min-height:\s*44px/s)
})

test('embedded comparison Evidence omits values already visible above the disclosure', () => {
  const runtime = findingsRuntime()
  const rendered = runtime.render(React.createElement(runtime.component.default, { model: runtime.model(testosteroneImportHistory()), embedded: true }))
  const card = nodes(rendered, node => node.type === 'article')[0]
  const inline = nodes(card, node => node.props?.['data-comparison-preview'] !== undefined)[0]
  const details = nodes(card, node => node.type === 'details')[0]
  for (const observation of nodes(inline, node => node.type === 'strong' || node.type === 'time').map(renderedText)) {
    assert.ok(observation)
    assert.doesNotMatch(renderedText(details), new RegExp(observation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
  }
  assert.doesNotMatch(renderedText(details), /Up 68|6\.7%|June 29/)
})

test('four briefing updates form an even two-by-two grid and closed cards share a minimum height', () => {
  assert.match(healthCss, /\.findingsList \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/s)
  assert.match(healthCss, /@media \(min-width:\s*640px\)[\s\S]*findingsList\[data-visible-count='4'\][^}]*repeat\(2, minmax\(0, 1fr\)\)/)
  assert.match(healthCss, /@media \(min-width:\s*640px\)[\s\S]*\.briefing \.findingsList \{[^}]*align-items:\s*stretch/s)
  assert.match(healthCss, /@media \(min-width:\s*640px\)[\s\S]*\.briefing \.briefingFinding \{[^}]*align-self:\s*stretch/s)
  assert.doesNotMatch(healthCss, /\.briefing \.briefingFinding \{[^}]*min-height:\s*168px/s)
  assert.match(healthCss, /\.briefingFinding \{[^}]*min-width:\s*0;[^}]*max-width:\s*100%;[^}]*overflow-wrap:\s*anywhere/s)
  assert.match(healthCss, /\.briefingFinding \.formDetails summary \{[^}]*min-height:\s*44px/s)
})

test('Recent panels defaults to four without reranking', () => {
  assert.match(dashboard, /showAllPanels \? panels : panels\.slice\(0, 4\)/)
  assert.ok(!/sort\(/.test(dashboard.slice(dashboard.indexOf('visiblePanels'), dashboard.indexOf('useEffect'))))
})

test('Recent panels can reveal every existing panel', () => {
  assert.match(dashboard, /View all \$\{panels\.length\} panels/)
  assert.match(dashboard, /visiblePanels\.map/)
  assert.match(dashboard, /aria-expanded=\{showAllPanels\}/)
})

test('Outside supplied range defaults to first five in existing order', () => {
  assert.match(insights, /showAllFlagged \? flagged : flagged\.slice\(0, 5\)/)
  const block = insights.slice(insights.indexOf('const visibleFlagged'), insights.indexOf('return <>'))
  assert.ok(!block.includes('.sort('))
})

test('Outside supplied range can reveal every filtered item', () => {
  assert.match(insights, /visibleFlagged\.map/)
  assert.match(insights, /View all \$\{flagged\.length\}/)
  assert.match(insights, /aria-expanded=\{showAllFlagged\}/)
})

test('flagged rows use divider-style presentation rather than nested cards', () => {
  assert.match(healthCss, /\.flaggedRow \{[^}]*border-radius: 0;/s)
  assert.match(healthCss, /\.flaggedList \{ border-top: 1px solid var\(--app-border\); \}/)
})

test('Journal history is removed from prominent Health navigation', () => {
  assert.ok(!dashboard.includes('Journal history'))
  assert.ok(!dashboard.includes('href="/journal"'))
})

test('Journal route remains intact', () => {
  assert.equal(existsSync(new URL('../app/journal/page.tsx', import.meta.url)), true)
})

test('Health Briefing remains before Recent panels', () => {
  assert.ok(dashboard.indexOf('<HealthBriefing') < dashboard.indexOf('id="panels-heading"'))
})

test('UI simplification leaves Analyst and Doctor Report components untouched by navigation changes', async t => {
  const navigationRuntime = componentRuntime()
  const HealthNavigation = navigationRuntime.load('../components/health/HealthNavigation.tsx').default
  for (const [active, currentHref] of [['analyst', '/health?view=analyst'], ['report', '/health/report']]) {
    const navigation = navigationRuntime.render(React.createElement(HealthNavigation, { active }))
    const links = nodes(navigation, node => node.type === 'a')
    assert.ok(links.some(link => link.props.href === '/health?view=analyst'))
    assert.ok(links.some(link => link.props.href === '/health/report'))
    assert.equal(links.find(link => link.props.href === currentHref).props['aria-current'], 'page')
  }

  const previousFetch = globalThis.fetch
  t.after(() => { globalThis.fetch = previousFetch })
  const inertDialog = { __esModule: true, default: () => null }

  const analystRuntime = componentRuntime({ './AiConsentDialog': inertDialog })
  const HealthAnalyst = analystRuntime.load('../components/health/HealthAnalyst.tsx').default
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({
    action: 'since_last_labs',
    analysis: { summary: 'Recorded values changed.', findings: [{ title: 'Recorded finding', detail: 'One recorded value is available.', evidenceIds: ['E1'], confidence: 'high' }], uncertainties: [], nextObservations: [] },
    evidence: [{ id: 'E1', title: 'Recorded lab value', detail: '31 mg/dL', date: '2026-09-08', sourceLabel: 'Test panel' }],
  }) })
  let analyst = analystRuntime.render(React.createElement(HealthAnalyst))
  nodes(analyst, node => node.type === 'button')[0].props.onClick()
  await Promise.resolve(); await Promise.resolve()
  analyst = analystRuntime.render(React.createElement(HealthAnalyst))
  const analystEvidence = nodes(analyst, node => node.type === 'details')[0]
  assert.equal(renderedText(nodes(analystEvidence, node => node.type === 'summary')[0]), 'View evidence')
  assert.match(renderedText(analystEvidence), /Recorded lab value.*31 mg\/dL.*Test panel/)

  const reportRuntime = componentRuntime({ './AiConsentDialog': inertDialog })
  const DoctorReport = reportRuntime.load('../components/health/DoctorReport.tsx').default
  const finding = findingsRuntime().model(testosteroneImportHistory()).headlines[0]
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({
    report: {
      intelligence: { contextNotes: [], biomarkerDomains: [], protocolTimeline: [], headlineChanges: [finding], reviewItems: [],
        verification: [{ code: 'comparison_gaps', text: 'Recorded verification limitation remains inspectable.' }] },
      generatedAt: '2026-09-28T12:00:00Z', asOfDate: '2026-09-28', range: '6m', periodLabel: 'Mar 28 - Sep 28, 2026',
      currentProtocols: [], protocolHistory: [], labPanels: [], highlightedResults: [], trends: [], weight: null, journal: null,
      protocolLabContext: [], limitations: [],
    }, aiSummary: null, aiError: null,
  }) })
  let report = reportRuntime.render(React.createElement(DoctorReport))
  nodes(report, node => node.type === 'button' && renderedText(node) === 'Preview report')[0].props.onClick()
  await Promise.resolve(); await Promise.resolve()
  report = reportRuntime.render(React.createElement(DoctorReport))
  const reportEvidence = nodes(report, node => node.type === 'details' && /View details for TESTOSTERONE/.test(nodes(node, child => child.type === 'summary')[0]?.props['aria-label'] ?? ''))[0]
  assert.ok(reportEvidence)
  assert.match(renderedText(reportEvidence), /Current:.*1077 ng\/dL.*Previous:.*1009 ng\/dL.*Change:.*\+68 ng\/dL/s)
  assert.match(renderedText(reportEvidence), /Personal baseline:.*import confidence low/s)
  const sourceEvidence = nodes(reportEvidence, node => node.props?.['aria-label'] === 'Source evidence')[0]
  assert.ok(sourceEvidence)
  assert.equal(nodes(sourceEvidence, node => node.type === 'li').length, 4)
  assert.match(renderedText(sourceEvidence), /2025-11-20: 432 ng\/dL.*2026-09-08: 1077 ng\/dL.*source row 28/s)
  assert.match(renderedText(report), /Data Verification & Limitations.*Recorded verification limitation remains inspectable/)
})

test('Protocol Changes route remains present and unchanged as a destination', async t => {
  const oldWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const previousFetch = globalThis.fetch
  t.after(() => {
    if (oldWindow) Object.defineProperty(globalThis, 'window', oldWindow)
    else Reflect.deleteProperty(globalThis, 'window')
    globalThis.fetch = previousFetch
  })
  let current = new URL('https://example.test/health?view=analyst')
  const historyApi = { pushState(_state, _unused, href) { current = new URL(href, current) } }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { history: historyApi, get location() { return current } } })
  const longitudinal = { asOf: '2026-09-28', window: { baselineDays: 90, followupStartDays: 1, followupEndDays: 84 },
    interventions: [], observations: [], versions: [], limitations: ['Mocked data boundary; real changes view rendered.'] }
  globalThis.fetch = async (url) => {
    assert.equal(url, '/api/health-longitudinal')
    return { ok: true, status: 200, json: async () => longitudinal }
  }
  const RoutedLink = ({ children, href, onClick, ...props }) => React.createElement('a', {
    ...props, href, onClick: event => { onClick?.(event); window.history.pushState(null, '', href) },
  }, children)
  const runtime = componentRuntime({
    'next/navigation': { useRouter: () => ({ push() {}, replace() {} }), useSearchParams: () => new URLSearchParams(current.search) },
    'next/link': { __esModule: true, default: RoutedLink },
  }, { useEffect: effect => effect() })
  const HealthDashboard = runtime.load('../components/health/HealthDashboard.tsx').default
  let rendered = runtime.render(React.createElement(HealthDashboard))
  const control = nodes(rendered, node => node.type === 'a' && node.props.href === '/health?view=changes')[0]
  assert.ok(control)
  assert.equal(control.props['aria-current'], undefined)
  control.props.onClick({ preventDefault() {} })
  assert.equal(`${current.pathname}${current.search}`, '/health?view=changes')
  rendered = runtime.render(React.createElement(HealthDashboard))
  await Promise.resolve(); await Promise.resolve()
  rendered = runtime.render(React.createElement(HealthDashboard))
  const active = nodes(rendered, node => node.type === 'a' && node.props.href === '/health?view=changes')[0]
  assert.equal(active.props['aria-current'], 'page')
  assert.match(renderedText(rendered), /Changes following protocol updates/)
  assert.match(renderedText(rendered), /Mocked data boundary; real changes view rendered\./)
})

test('mobile compound grid is one column and expands only at wider width', () => {
  assert.match(healthCss, /\.briefingCompounds \{[^}]*grid-template-columns: minmax\(0, 1fr\)/s)
  assert.match(healthCss, /@media \(min-width: 640px\)[\s\S]*\.briefingCompounds \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/)
})

test('briefing update grid favors readable one-line names over forced three columns', () => {
  assert.match(healthCss, /\.briefingUpdateName \{[^}]*white-space: nowrap;/s)
  assert.match(healthCss, /\.briefing \.findingsList \{ align-items: start; \}/)
  assert.match(healthCss, /\.briefingFinding \{[^}]*align-self: start;/s)
  assert.doesNotMatch(healthCss, /findingsList\[data-visible-count='3'\][^}]*repeat\(3/)
})

test('briefing supplemental cards use their own deterministic Evidence disclosure', () => {
  const runtime = findingsRuntime()
  const supplemental = runtime.render(React.createElement(runtime.component.default, { model: emptyReadyModel(), supplemental: [supplementalUpdate()], embedded: true }))
  const card = nodes(supplemental, node => node.props?.['data-update-kind'] === 'latest_without_comparison')[0]
  assert.match(renderedText(card), /31 mg\/dL.*Sep 8, 2026/)
  assert.match(renderedText(card), /No eligible prior comparison is recorded\./)
  assert.match(renderedText(nodes(card, node => node.type === 'details')[0]), /Outside the supplied 5\u201320 range/)
  assert.doesNotMatch(renderedText(card), /\b(?:Up|Down|Unchanged)\b|\bsince\b|\u2192|Previous:|Change:/)

  const comparison = runtime.render(React.createElement(runtime.component.default, { model: runtime.model(testosteroneImportHistory()), embedded: true }))
  assert.match(renderedText(nodes(comparison, node => node.type === 'article')[0]), /\u2192.*Up 68 \(\+6\.7%\) since June 29/)
})

test('embedded Evidence uses accent color and native details summary interaction', () => {
  const runtime = findingsRuntime()
  const rendered = runtime.render(React.createElement(runtime.component.default, { model: emptyReadyModel(), supplemental: [supplementalUpdate()], embedded: true }))
  const card = nodes(rendered, node => node.type === 'article')[0]
  const details = nodes(card, node => node.type === 'details')[0]
  const summary = nodes(details, node => node.type === 'summary')[0]
  assert.equal(details.props.open, undefined)
  assert.equal(summary.type, 'summary')
  assert.equal(summary.props.role, undefined)
  assert.equal(summary.props.tabIndex, undefined)
  assert.equal(summaryAccessibleName(summary), 'View details')
  assert.doesNotMatch(renderedText(card), /\bEvidence\b/)
  assert.match(healthCss, /\.briefingFinding \.formDetails summary \{[^}]*color:\s*var\(--app-accent\);[^}]*font-weight:\s*650/s)
  assert.match(healthCss, /\.briefingFinding \.formDetails summary:focus-visible \{[^}]*outline:\s*2px solid var\(--app-accent\)/s)
  assert.match(healthCss, /\.briefingFinding \.formDetails summary \{[^}]*min-height:\s*44px/s)
})

test('Next review evidence action is compact while retaining primary styling', () => {
  assert.match(briefing, /styles\.primary.*styles\.briefingPrimaryAction/)
  assert.match(healthCss, /\.page a\.briefingPrimaryAction \{[^}]*width: fit-content;[^}]*min-height: 0;[^}]*padding: 6px 10px;/s)
  assert.match(briefing, /Create clinician report|model\.reviewActions/)
})
