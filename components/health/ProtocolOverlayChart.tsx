import { overlayChart, type OverlayMarker } from '../../lib/health/protocolOverlay'
import type { LabObservation } from '../../lib/health/labs'
import { formatTimelineDate } from '../../lib/health/timeline'
import styles from '../../app/health/health.module.css'

export default function ProtocolOverlayChart({ observations, markers, name, unit }: { observations: LabObservation[]; markers: OverlayMarker[]; name: string; unit: string }) {
  const chart = overlayChart(observations, markers)
  const rangesVary = chart.points.length > 1 && !chart.range && observations.some(item => item.result.reference_low != null || item.result.reference_high != null)
  if (!observations.length) return <p className={styles.caption}>No readings are available in this time window.</p>
  if (!chart.points.length) return <div className={styles.overlayChartEmpty}><p>Numeric chart unavailable for this series.</p><span>Saved readings and protocol events remain listed below.</span></div>
  return <figure className={styles.overlayChart}>
    <svg viewBox="0 0 300 132" role="img" aria-label={`${name} in ${unit}, with recorded protocol events aligned by date. Exact details follow.`}>
      {chart.range && <rect x="16" y={chart.range.top} width="268" height={Math.max(1, chart.range.bottom - chart.range.top)} className={styles.referenceBand} />}
      <line x1="16" y1="112" x2="284" y2="112" className={styles.chartAxis} />
      {chart.markers.map(marker => <g key={marker.id} className={styles.overlayMarker}><line x1={marker.x} y1="14" x2={marker.x} y2="112" /><circle cx={marker.x} cy="18" r="4" /><title>{marker.title} on {marker.date}</title></g>)}
      <polyline points={chart.points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" />
      {chart.points.map(point => <circle key={point.observation.result.id} cx={point.x} cy={point.y} r="4" fill="currentColor"><title>{point.observation.result.value} {unit} on {point.observation.date}</title></circle>)}
    </svg>
    <figcaption><span>{formatTimelineDate([...observations].sort((a, b) => a.date.localeCompare(b.date))[0].date)}</span><span>Protocol events are dotted markers</span><span>{formatTimelineDate([...observations].sort((a, b) => b.date.localeCompare(a.date))[0].date)}</span></figcaption>
    {rangesVary && <p className={styles.caption}>Reference ranges vary or are incomplete, so no single range is drawn.</p>}
  </figure>
}
