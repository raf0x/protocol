import type { JournalEntryRow } from '../../lib/health/timeline'
import { journalSnapshot } from '../../lib/health/today'
import { convertWeight, formatWeight, type WeightUnit } from '../../lib/weightUtils'
import styles from '../../app/protocol/today-v2.module.css'

/** Compact header weight tile using the same recorded snapshot as Health Trends. */
export default function TodayStatusStrip({ entries, unit, onToggleUnit }: {
  entries: JournalEntryRow[]; unit: WeightUnit; onToggleUnit: () => void
}) {
  const data = journalSnapshot(entries)
  const weight = (value: number) => formatWeight(convertWeight(value, 'lbs', unit), unit)
  const unitLabel = `Weight in ${unit}. Switch to ${unit === 'lbs' ? 'kg' : 'lbs'}`
  return <button type="button" className={`${styles.statusCard} ${styles.currentWeight}`} onClick={onToggleUnit} aria-label={`Current weight ${data.latest ? `${weight(data.latest.weight!)} ${unit}` : 'Not logged'}. ${unitLabel}`}>
      <span className={styles.statusLabel}>Current weight</span>
      <span className={styles.statusNumber}>
        <strong className={styles.statusValue}>{data.latest ? weight(data.latest.weight!) : '—'}</strong>
        <span className={styles.statusUnit}>{unit}</span>
      </span>
      <span className={styles.statusHint}>tap to switch to {unit === 'lbs' ? 'kg' : 'lbs'}</span>
      {!data.latest && <span className={styles.statusDate}>Not logged</span>}
    </button>
}
