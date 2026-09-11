import { trendChart } from '../../lib/health/biomarkerIntelligence'
import type { LabObservation } from '../../lib/health/labs'
import styles from '../../app/health/health.module.css'

export default function LabSparkline({ observations, label }: { observations: LabObservation[]; label: string }) {
  const { points } = trendChart(observations)
  if (points.length < 2) return null
  return <svg className={styles.sparkline} viewBox="0 0 300 120" role="img" aria-label={label}>
    <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="5" vectorEffect="non-scaling-stroke" />
    <circle cx={points.at(-1)!.x} cy={points.at(-1)!.y} r="6" fill="currentColor" />
  </svg>
}
