import { formatTimelineDate } from '../../lib/health/timeline'
import { timelineFilters, type timelineTreatmentOptions, type TimelineFilter } from '../../lib/health/timelinePresentation'
import styles from '../../app/timeline/timeline.module.css'

type TreatmentOption = ReturnType<typeof timelineTreatmentOptions>[number]

export default function TimelineFilters({
  value,
  treatments = [],
  treatmentKey = '',
  treatmentUnavailable = false,
  onChange,
  onTreatmentChange = () => {},
}: {
  value: TimelineFilter
  treatments?: TreatmentOption[]
  treatmentKey?: string
  treatmentUnavailable?: boolean
  onChange: (value: TimelineFilter) => void
  onTreatmentChange?: (value: string) => void
}) {
  const repeatedLabels = new Set(
    treatments
      .filter((item, index) => treatments.findIndex(other => other.label === item.label) !== index)
      .map(item => item.label)
  )

  return (
    <div className={styles.filterControls}>
      <div className={styles.filters} role="group" aria-label="Filter timeline by event type">
        {timelineFilters.map(filter => (
          <button
            key={filter}
            type="button"
            aria-pressed={value === filter}
            onClick={() => onChange(filter)}
          >
            {filter}
          </button>
        ))}
      </div>

      {treatments.length > 0 && (
        <div className={styles.treatmentFilter}>
          <span className={styles.treatmentLabel}>Treatment</span>

          <div
            className={styles.treatmentChips}
            role="group"
            aria-label="Filter protocol history by treatment"
          >
            <button
              type="button"
              aria-pressed={value === 'Protocols' && !treatmentKey && !treatmentUnavailable}
              onClick={() => onTreatmentChange('')}
            >
              All
            </button>

            {treatmentUnavailable && (
              <button
                type="button"
                aria-pressed="true"
                disabled
                title="This linked treatment is not present in the loaded timeline"
              >
                Unavailable
              </button>
            )}

            {treatments.map(item => (
              <button
                key={item.key}
                type="button"
                aria-pressed={value === 'Protocols' && treatmentKey === item.key}
                onClick={() => onTreatmentChange(item.key)}
                title={
                  repeatedLabels.has(item.label) && item.startedAt
                    ? `${item.label}, started ${formatTimelineDate(item.startedAt)}`
                    : item.label
                }
              >
                {item.label}
                {repeatedLabels.has(item.label) && item.startedAt
                  ? ` · ${formatTimelineDate(item.startedAt)}`
                  : ''}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
