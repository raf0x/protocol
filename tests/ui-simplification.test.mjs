import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'

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
  assert.match(timelineCss, /\.monthSummary \{/)
  assert.match(timelineCss, /min-height: 52px/)
  assert.match(timelineCss, /:is\(button, a, summary\):focus-visible/)
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
  assert.match(findings, /<Evidence finding=\{finding\} compact=\{embedded && Boolean\(finding\.evidence\.comparison\)\} \/>/)
  assert.match(findings, /<summary>Evidence<\/summary>/)
})

test('briefing update cards render name then value then status then Evidence', () => {
  const canonical = findings.slice(findings.indexOf('visibleHeadlines.map'), findings.indexOf('visibleSupplemental.map'))
  assert.ok(canonical.indexOf('briefingUpdateName') < canonical.indexOf('briefingUpdateValue'))
  assert.ok(canonical.indexOf('briefingUpdateValue') < canonical.indexOf('styles.summary'))
  assert.ok(canonical.indexOf('styles.summary') < canonical.indexOf('<Evidence finding={finding}'))
  const supplementalBlock = findings.slice(findings.indexOf('visibleSupplemental.map'), findings.indexOf('</div>', findings.indexOf('visibleSupplemental.map')))
  assert.ok(supplementalBlock.indexOf('briefingUpdateName') < supplementalBlock.indexOf('briefingUpdateValue'))
  assert.ok(supplementalBlock.indexOf('briefingUpdateValue') < supplementalBlock.indexOf('styles.summary'))
  assert.ok(supplementalBlock.indexOf('styles.summary') < supplementalBlock.indexOf('<SupplementalEvidence item={item} />'))
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
  assert.match(healthCss, /\.briefingFinding \.formDetails summary \{[^}]*display: inline-flex;[^}]*width: fit-content;[^}]*min-height: 0;[^}]*padding-block: 4px;/s)
  assert.match(findings, /<summary>Evidence<\/summary>/)
  assert.match(findings, /<strong>Current:<\/strong>/)
  assert.match(findings, /<strong>Previous:<\/strong>/)
  assert.match(findings, /<strong>Change:<\/strong>/)
  assert.match(findings, /<strong>Limitations:<\/strong>/)
})

test('embedded comparison Evidence omits values already visible above the disclosure', () => {
  assert.match(findings, /function Evidence\(\{ finding, compact = false \}/)
  assert.match(findings, /!compact && current/)
  assert.match(findings, /!compact && previous/)
  assert.match(findings, /!compact && comparison/)
  assert.match(findings, /compact=\{embedded && Boolean\(finding\.evidence\.comparison\)\}/)
})

test('four briefing updates form an even two-by-two grid and closed cards share a minimum height', () => {
  assert.doesNotMatch(findings, /gridColumn: '1 \/ -1'/)
  assert.doesNotMatch(findings, /updateStyle/)
  assert.match(healthCss, /findingsList\[data-visible-count='4'\][^}]*repeat\(2, minmax\(0, 1fr\)\)/s)
  assert.match(healthCss, /\.briefing \.briefingFinding \{ min-height: 168px; \}/)
  assert.match(healthCss, /\.briefingFinding \.formDetails \{ margin-top: auto; padding-top: 6px; \}/)
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

test('UI simplification leaves Analyst and Doctor Report components untouched by navigation changes', () => {
  assert.match(dashboard, /<HealthAnalyst \/>/)
  assert.match(dashboard, /href="\/health\/report"/)
  assert.match(dashboard, /href="\/health\?view=analyst"/)
})

test('Protocol Changes route remains present and unchanged as a destination', () => {
  assert.match(dashboard, /href="\/health\?view=changes"/)
  assert.match(dashboard, /<LongitudinalChanges \/>/)
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
  assert.match(findings, /data-update-kind=\{item\.kind\}/)
  assert.match(findings, /<SupplementalEvidence item=\{item\} \/>/)
  assert.match(findings, /No eligible prior comparison is recorded\./)
  assert.ok(!/SupplementalEvidence[\s\S]{0,1800}<strong>Previous:<\/strong>|SupplementalEvidence[\s\S]{0,1800}<strong>Change:<\/strong>/.test(findings))
})

test('embedded Evidence uses accent color and native details summary interaction', () => {
  assert.match(findings, /<details className=\{styles\.formDetails\}>/)
  assert.match(findings, /<summary>Evidence<\/summary>/)
  assert.match(healthCss, /\.briefingFinding \.formDetails summary \{ color: var\(--app-accent\); font-weight: 650; \}/)
  assert.match(healthCss, /summary:focus-visible/)
})

test('Next review evidence action is compact while retaining primary styling', () => {
  assert.match(briefing, /styles\.primary.*styles\.briefingPrimaryAction/)
  assert.match(healthCss, /\.page a\.briefingPrimaryAction \{[^}]*width: fit-content;[^}]*min-height: 0;[^}]*padding: 6px 10px;/s)
  assert.match(briefing, /Create clinician report|model\.reviewActions/)
})
