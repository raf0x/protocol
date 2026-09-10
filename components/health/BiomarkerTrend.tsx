import Link from 'next/link'
import { labValue, trendPoints, type BiomarkerHistory } from '../../lib/health/labs'
import { formatTimelineDate } from '../../lib/health/timeline'
import LabResultRow from './LabResultRow'
import styles from '../../app/health/health.module.css'

export default function BiomarkerTrend({ history }: { history: BiomarkerHistory }) {
  return <details className={styles.trend}><summary><strong>{history.name}</strong><span>{history.panelCount} panels · View trend</span></summary>
    {history.units.length > 1 && <p className={styles.notice}>Units differ across these results. Each unit is shown separately; no conversion or combined comparison is made.</p>}
    {history.units.map(group => {
      const points = trendPoints(group.observations)
      const latest = group.observations[0]
      const sameDate = group.observations.filter(item => item.date === latest.date)
      return <section className={styles.trendGroup} key={group.unit} aria-label={`${history.name}: ${group.unit || 'unit not recorded'}`}>
        <h3>{group.unit || 'Unit not recorded'}</h3>
        <p className={styles.caption}>Latest test · {formatTimelineDate(latest.date)}</p>
        <p className={styles.value}>{sameDate.length === 1 ? labValue(latest.result) : `${sameDate.length} results on this date`}</p>
        {points.length > 1 ? <figure className={styles.chart}>
          <svg viewBox="0 0 300 120" role="img" aria-label={`${history.name} in ${group.unit} over time. Exact values and dates follow.`}>
            <line x1="12" y1="108" x2="288" y2="108" className={styles.chartAxis} />
            <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" />
            {points.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r="3" fill="currentColor" />)}
          </svg><figcaption><span>{formatTimelineDate(group.observations.at(-1)!.date)}</span><span>{formatTimelineDate(latest.date)}</span></figcaption>
        </figure> : <p className={styles.caption}>A chart needs numeric values, a recorded unit, and one reading per date. All saved results are below.</p>}
        <ol className={styles.observations}>{group.observations.map(item => <li key={item.result.id}>
          <Link href={`/health?panel=${encodeURIComponent(item.panelId)}`}>View panel · {formatTimelineDate(item.date)}</Link><LabResultRow result={item.result} />
        </li>)}</ol>
      </section>
    })}
  </details>
}
