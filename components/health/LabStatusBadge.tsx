import type { LabStatus } from '../../lib/health/labs'
import styles from '../../app/health/health.module.css'

const labels: Record<LabStatus, [string, string]> = { low: ['↓', 'Low'], normal: ['✓', 'Normal'], high: ['↑', 'High'], abnormal: ['!', 'Abnormal'], unknown: ['?', 'Unknown'] }
export default function LabStatusBadge({ status }: { status: LabStatus }) {
  const [icon, label] = labels[status] ?? labels.unknown
  return <span className={styles.badge} data-status={status}><span aria-hidden="true">{icon}</span>{label}</span>
}
