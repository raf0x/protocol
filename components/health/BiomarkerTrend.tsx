import Link from 'next/link'
import { compareLatest, trendChart } from '../../lib/health/biomarkerIntelligence'
import { labValue, type BiomarkerHistory } from '../../lib/health/labs'
import { formatTimelineDate } from '../../lib/health/timeline'
import LabResultRow from './LabResultRow'
import LabStatusBadge from './LabStatusBadge'
import styles from '../../app/health/health.module.css'

export default function BiomarkerTrend({ history }: { history: BiomarkerHistory }) {
  return <section className={styles.trend}><div className={styles.trendHeader}><span className={styles.eyebrow}>{history.category}</span><h2>{history.name}</h2><p>{history.panelCount} panels</p></div>
    {history.units.length > 1 && <p className={styles.notice}>Units differ across these results. Each unit is shown separately; no conversion or combined comparison is made.</p>}
    {history.units.map(group => {
      const chart = trendChart(group.observations), points = chart.points
      const latest = group.observations[0]
      const sameDate = group.observations.filter(item => item.date === latest.date)
      const comparison = compareLatest(group.observations)
      const rangesDiffer = points.length > 1 && !chart.range && group.observations.some(item => item.result.reference_low != null || item.result.reference_high != null)
      return <section className={styles.trendGroup} key={group.unit} aria-label={`${history.name}: ${group.unit || 'unit not recorded'}`}>
        <h3>{group.unit || 'Unit not recorded'}</h3>
        <p className={styles.caption}>Latest test · {formatTimelineDate(latest.date)}</p>
        <div className={styles.rowHeading}><p className={styles.value}>{sameDate.length === 1 ? labValue(latest.result) : `${sameDate.length} results on this date`}</p><LabStatusBadge status={latest.result.status} /></div>
        {comparison && <p className={styles.comparison}><strong>{comparison.direction === 'up' ? '↑ Up' : comparison.direction === 'down' ? '↓ Down' : '→ Unchanged'} {Math.abs(comparison.delta).toLocaleString(undefined, { maximumFractionDigits: 2 })} {group.unit}</strong>{comparison.percent != null && <span>{comparison.percent > 0 ? '+' : ''}{comparison.percent.toFixed(1)}%</span>}<small>Previous: {labValue(comparison.previous.result)} on {formatTimelineDate(comparison.previous.date)}</small></p>}
        {points.length > 1 ? <figure className={styles.chart}>
          <svg viewBox="0 0 300 120" role="img" aria-label={`${history.name} in ${group.unit} over time. Exact values and dates follow.`}>
            {chart.range && <rect x="12" y={chart.range.top} width="276" height={Math.max(1, chart.range.bottom-chart.range.top)} className={styles.referenceBand} />}
            <line x1="12" y1="108" x2="288" y2="108" className={styles.chartAxis} />
            <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" />
            {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3" fill="currentColor" />)}
          </svg><figcaption><span>{formatTimelineDate(group.observations.at(-1)!.date)}</span><span>{formatTimelineDate(latest.date)}</span></figcaption>
        </figure> : <p className={styles.caption}>A chart needs numeric values, a recorded unit, and one reading per date. All saved results are below.</p>}
        {rangesDiffer && <p className={styles.caption}>Reference ranges vary or are incomplete, so no single range is drawn on the chart.</p>}
        <ol className={styles.observations}>{group.observations.map(item => <li key={item.result.id}>
          <Link href={`/health?panel=${encodeURIComponent(item.panelId)}`}>View panel · {formatTimelineDate(item.date)}</Link><LabResultRow result={item.result} />
        </li>)}</ol>
      </section>
    })}
  </section>
}
