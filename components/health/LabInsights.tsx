'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { compareLatest, labIntelligence, statusIsFlagged, type BiomarkerCategory } from '../../lib/health/biomarkerIntelligence'
import { labReference, labValue, type BiomarkerHistory, type LabPanel } from '../../lib/health/labs'
import { formatTimelineDate } from '../../lib/health/timeline'
import LabSparkline from './LabSparkline'
import LabStatusBadge from './LabStatusBadge'
import styles from '../../app/health/health.module.css'

function latestGroup(history: BiomarkerHistory) {
  return [...history.units].sort((a, b) => b.observations[0].date.localeCompare(a.observations[0].date) || a.unit.localeCompare(b.unit))[0]
}

function changeText(history: BiomarkerHistory) {
  const comparison = compareLatest(latestGroup(history).observations)
  if (!comparison) return 'No comparable prior result'
  const arrow = comparison.direction === 'up' ? '↑' : comparison.direction === 'down' ? '↓' : '→'
  const absolute = Math.abs(comparison.delta).toLocaleString(undefined, { maximumFractionDigits: 2 })
  const percent = comparison.percent == null ? '' : ` · ${comparison.percent > 0 ? '+' : ''}${comparison.percent.toFixed(1)}%`
  return `${arrow} ${comparison.direction} ${absolute} ${latestGroup(history).unit}${percent}`
}

export default function LabInsights({ panels, histories }: { panels: LabPanel[]; histories: BiomarkerHistory[] }) {
  const intelligence = useMemo(() => labIntelligence(panels, histories), [panels, histories])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<BiomarkerCategory | 'All'>('All')
  const [mode, setMode] = useState<'all' | 'flagged' | 'history'>('all')
  const normalizedQuery = query.trim().toLowerCase()
  const matches = (history: BiomarkerHistory) => (category === 'All' || history.category === category) && (!normalizedQuery || history.name.toLowerCase().includes(normalizedQuery))
  const repeated = histories.filter(history => matches(history) && history.units.some(group => new Set(group.observations.map(item => item.date)).size > 1))
  const flagged = intelligence.flagged.filter(item => matches(item.history))
  const visibleTrends = mode === 'flagged' ? repeated.filter(history => latestGroup(history) && statusIsFlagged(latestGroup(history).observations[0].result.status)) : repeated

  return <>
    {intelligence.latestPanel && <section className={styles.summaryGrid} aria-label="Lab history summary">
      <div className={styles.summaryLead}><span>Latest panel</span><strong>{formatTimelineDate(intelligence.latestPanel.test_date)}</strong>{intelligence.latestPanel.provider && <small>{intelligence.latestPanel.provider}</small>}</div>
      <div><strong>{intelligence.latestPanel.results.length}</strong><span>Biomarkers</span></div>
      <div><strong>{intelligence.latestFlaggedCount}</strong><span>Outside range</span></div>
      <div><strong>{intelligence.repeatCount}</strong><span>With history</span></div>
    </section>}

    {intelligence.categories.length > 0 && <section aria-labelledby="categories-heading">
      <div className={styles.sectionHeading}><h2 id="categories-heading">By category</h2></div>
      <div className={styles.categoryGrid}>{intelligence.categories.map(item => <button key={item.category} type="button" className={styles.categoryCard} aria-pressed={category === item.category} onClick={() => setCategory(current => current === item.category ? 'All' : item.category)}>
        <strong>{item.category}</strong><span>{item.biomarkerCount} {item.biomarkerCount === 1 ? 'biomarker' : 'biomarkers'}</span><small>{item.flaggedCount ? `${item.flaggedCount} outside range` : 'No latest flags'}{item.repeatCount ? ` · ${item.repeatCount} with history` : ''}</small>
      </button>)}</div>
    </section>}

    <section aria-labelledby="explore-heading">
      <div className={styles.sectionHeading}><h2 id="explore-heading">Explore biomarkers</h2></div>
      <label className={styles.searchLabel}><span className="sr-only">Search biomarkers</span><input value={query} onChange={event => setQuery(event.target.value)} type="search" placeholder="Search biomarkers" /></label>
      <div className={styles.filterRow} aria-label="Biomarker filters">
        {([['all', 'All'], ['flagged', 'Outside range'], ['history', 'With trends']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}
        {category !== 'All' && <button type="button" aria-pressed="true" onClick={() => setCategory('All')}>{category} ×</button>}
      </div>
    </section>

    {(mode === 'all' || mode === 'flagged') && <section aria-labelledby="flagged-heading">
      <div className={styles.sectionHeading}><h2 id="flagged-heading">Outside supplied range</h2><span>{flagged.length}</span></div>
      {flagged.length ? <div className={styles.flaggedList}>{flagged.map(({ history, observation }) => <Link key={`${history.key}:${observation.result.unit}`} className={styles.flaggedRow} href={`/health?biomarker=${encodeURIComponent(history.key)}`}>
        <div><strong>{history.name}</strong><span>{labValue(observation.result)} · {formatTimelineDate(observation.date)}</span><small>Reference: {labReference(observation.result)}{observation.result.unit && (observation.result.reference_low != null || observation.result.reference_high != null) ? ` ${observation.result.unit}` : ''}</small></div><LabStatusBadge status={observation.result.status} />
      </Link>)}</div> : <div className={styles.card}><p>{query || category !== 'All' ? 'No matching latest results are outside their supplied range.' : 'No latest results are marked outside their supplied range.'}</p></div>}
    </section>}

    {mode !== 'flagged' && <section aria-labelledby="trends-heading">
      <div className={styles.sectionHeading}><h2 id="trends-heading">Biomarker trends</h2><span>{visibleTrends.length}</span></div>
      {visibleTrends.length ? <div className={styles.trendList}>{visibleTrends.map(history => {
        const group = latestGroup(history), latest = group.observations[0]
        return <Link key={history.key} className={styles.trendCard} href={`/health?biomarker=${encodeURIComponent(history.key)}`}>
          <div className={styles.trendCopy}><span className={styles.eyebrow}>{history.category}</span><strong>{history.name}</strong><span>{labValue(latest.result)} · {group.observations.length} readings</span><small>{changeText(history)}</small></div>
          <LabSparkline observations={group.observations} label={`${history.name} trend. Exact values are available in the detail view.`} />
        </Link>
      })}</div> : <div className={styles.card}><p>No biomarkers match this view with comparable history.</p></div>}
      {!normalizedQuery && category === 'All' && intelligence.singleReadingCount > 0 && <p className={styles.caption}>{intelligence.singleReadingCount} additional {intelligence.singleReadingCount === 1 ? 'biomarker needs' : 'biomarkers need'} another reading before a trend can be shown.</p>}
    </section>}
  </>
}
