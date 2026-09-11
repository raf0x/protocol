import { timelineFilters, type TimelineFilter } from '../../lib/health/timelinePresentation'
import styles from '../../app/timeline/timeline.module.css'

export default function TimelineFilters({ value, onChange }: { value: TimelineFilter; onChange: (value: TimelineFilter) => void }) {
  return <div className={styles.filters} role="group" aria-label="Filter timeline">
    {timelineFilters.map(filter => <button key={filter} type="button" aria-pressed={value === filter} onClick={() => onChange(filter)}>{filter}</button>)}
  </div>
}
