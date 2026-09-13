import { formatTimelineDate } from '../../lib/health/timeline'
import { timelineFilters, type timelineTreatmentOptions, type TimelineFilter } from '../../lib/health/timelinePresentation'
import styles from '../../app/timeline/timeline.module.css'

type TreatmentOption = ReturnType<typeof timelineTreatmentOptions>[number]

export default function TimelineFilters({ value, treatments = [], treatmentKey = '', treatmentUnavailable = false, onChange, onTreatmentChange = () => {} }: {
  value: TimelineFilter
  treatments?: TreatmentOption[]
  treatmentKey?: string
  treatmentUnavailable?: boolean
  onChange: (value: TimelineFilter) => void
  onTreatmentChange?: (value: string) => void
}) {
  const repeatedLabels = new Set(treatments.filter((item, index) => treatments.findIndex(other => other.label === item.label) !== index).map(item => item.label))
  return <div className={styles.filterControls}>
    <div className={styles.filters} role="group" aria-label="Filter timeline by event type">
      {timelineFilters.map(filter => <button key={filter} type="button" aria-pressed={value === filter} onClick={() => onChange(filter)}>{filter}</button>)}
    </div>
    {treatments.length > 0 && <label className={styles.treatmentFilter} htmlFor="timeline-treatment">Treatment
      <select id="timeline-treatment" value={treatmentUnavailable ? '__unavailable__' : treatmentKey} onChange={event => onTreatmentChange(event.target.value)}>
        <option value="">All treatments</option>
        {treatmentUnavailable && <option value="__unavailable__">Unavailable treatment</option>}
        {treatments.map(item => <option key={item.key} value={item.key}>{item.label}{repeatedLabels.has(item.label) && item.startedAt ? ` · ${formatTimelineDate(item.startedAt)}` : ''}</option>)}
      </select>
    </label>}
  </div>
}
