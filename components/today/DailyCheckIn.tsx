import type { JournalEntryRow } from '../../lib/health/timeline'
import { getWeightLabel, type WeightUnit } from '../../lib/weightUtils'

type ScoreField = 'mood' | 'energy' | 'hunger'
// reverse: hunger runs the opposite direction from mood/energy — 1 (not hungry)
// is the good end, 5 (very hungry) is the bad end. Same mapping CompactDailyLog
// used, just re-expressed as a rank so color stays purely in CSS.
const SCORE_FIELDS: { id: ScoreField; label: string; reverse?: boolean }[] = [
  { id: 'mood', label: 'Mood' },
  { id: 'energy', label: 'Energy' },
  { id: 'hunger', label: 'Hunger', reverse: true },
]

type Props = {
  today: string
  entries: JournalEntryRow[]
  mood: number | null
  energy: number | null
  hunger: number | null
  sleep: string
  weight: string
  notes: string
  weightUnit: WeightUnit
  saving: boolean
  saved: boolean
  scoreError: Partial<Record<ScoreField, string | null>>
  onScoreTap: (field: ScoreField, value: number) => void
  onSleepChange: (value: string) => void
  onWeightChange: (value: string) => void
  onNotesChange: (value: string) => void
  onSave: () => void
}

// Most recent entry before today that logged this field. entries is already
// newest-first, so the first match is the comparison point for the delta.
function priorValue(entries: JournalEntryRow[], today: string, field: ScoreField): number | null {
  const prior = entries.find(entry => entry.date !== today && entry[field] !== null && entry[field] !== undefined)
  return prior ? (prior[field] as number) : null
}

function ScoreDelta({ current, prior }: { current: number | null; prior: number | null }) {
  if (current === null || prior === null) return null
  const diff = current - prior
  return <span className="today-checkin-delta">{diff === 0 ? 'Same as last' : `${diff > 0 ? '+' : ''}${diff} vs last`}</span>
}

export default function DailyCheckIn({
  today, entries, mood, energy, hunger, sleep, weight, notes, weightUnit, saving, saved, scoreError,
  onScoreTap, onSleepChange, onWeightChange, onNotesChange, onSave,
}: Props) {
  const values: Record<ScoreField, number | null> = { mood, energy, hunger }
  return <div className="today-checkin">
    <div className="today-checkin-scores">
      {SCORE_FIELDS.map(field => {
        const value = values[field.id]
        return <div className="today-checkin-score" key={field.id}>
          <span className="today-checkin-score-label">{field.label}</span>
          <div className="today-checkin-score-row" role="group" aria-label={field.label}>
            {[1, 2, 3, 4, 5].map(v => <button key={v} type="button" className="today-checkin-score-btn" aria-label={`${field.label} ${v} of 5`} aria-pressed={value === v} data-active={value === v} data-rank={field.reverse ? 6 - v : v} onClick={() => onScoreTap(field.id, v)}>{v}</button>)}
          </div>
          {scoreError[field.id] ? <span className="today-checkin-error" role="alert">{scoreError[field.id]}</span> : <ScoreDelta current={value} prior={priorValue(entries, today, field.id)} />}
        </div>
      })}
    </div>
    <div className="today-checkin-secondary">
      <div className="today-checkin-fields">
        <label>Sleep (hrs)<input type="number" step="0.5" value={sleep} onChange={e => onSleepChange(e.target.value)} placeholder="7.5" /></label>
        <label>{`Weight (${getWeightLabel(weightUnit)})`}<input type="number" step="0.1" value={weight} onChange={e => onWeightChange(e.target.value)} placeholder="175" /></label>
      </div>
      <textarea value={notes} onChange={e => onNotesChange(e.target.value)} placeholder="Notes…" rows={2} />
      <button type="button" className="today-checkin-save" onClick={onSave} disabled={saving}>{saving ? 'Saving…' : saved ? 'Update' : 'Save'}</button>
    </div>
  </div>
}
