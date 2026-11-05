import { administrationDisplay, dosingDisplay, formatProtocolAmount, formatProtocolNumber, interpretEntry } from '../../lib/health/dosingEntry'

import { phaseDosingIssue, type ReviewTarget, type DosingReviewField } from '../../lib/health/dosingGuidance'
export { dosingIssue, phaseDosingIssue } from '../../lib/health/dosingGuidance'

type Props = { phase: Parameters<typeof dosingDisplay>[0]; onReview?: (target: ReviewTarget, field?: DosingReviewField) => void; editing?: boolean; compact?: boolean; showIssue?: boolean }

export default function DoseSummary({ phase, onReview, editing = false, compact = false, showIssue = true }: Props) {
  const entry = phase?.dosing_entry
  const issue = phaseDosingIssue(phase)
  if (!entry) {
    const display = dosingDisplay(phase)
    const admin = administrationDisplay(phase)
    return <span className="dose-summary">
      <strong title={phase && !display.medication ? 'Medication dose not calculated.' : undefined}>{display.medication ? formatProtocolAmount(display.medication.value, display.medication.unit) : phase ? 'Medication amount unknown' : 'Dose not entered'}</strong>
      {!compact && admin.syringe && <span>{admin.syringe}</span>}{!compact && admin.volume && <span>{admin.volume}</span>}
      {issue && showIssue && <span className="dose-issue" role="status"><b>{issue.title}</b><span>{issue.explanation}</span>{onReview && <button type="button" className="dose-review-link" onClick={() => onReview(issue.target, issue.field)}>{issue.action}</button>}</span>}
    </span>
  }
  try {
    const result = interpretEntry(entry)
    const medication = result.medication && formatProtocolAmount(result.medication.value, result.medication.unit)
    const volume = formatProtocolAmount(result.volume, 'mL', 'volume')
    const markings = formatProtocolNumber(result.markings, 'syringe')
    const syringePrimary = !medication && entry.mode !== 'volume' && markings !== null
    const enteredMarkings = entry.syringe_markings.trim() ? Number(entry.syringe_markings) : null
    const syringeVolume = enteredMarkings !== null && result.scale ? enteredMarkings / result.scale : null
    const displayedMarkings = markings === null ? null : Number(markings)
    const displayedVolume = volume === null ? null : Number(volume.replace(/ mL$/, ''))
    const showSyringeEquivalence = editing && entry.mode === 'syringe' && entry.injection_volume.trim() === '' &&
      (result.scale === 100 || result.scale === 40) && enteredMarkings !== null &&
      syringeVolume !== null && Number.isFinite(syringeVolume) && result.markings === enteredMarkings &&
      displayedMarkings === enteredMarkings && displayedVolume === syringeVolume &&
      result.volume === syringeVolume && !result.hasConflict
    if (editing && entry.mode === 'medication' && medication && !issue) return null
    return <span className="dose-summary">
      {!editing && <strong>{medication || (syringePrimary ? `${markings} units` : volume) || (entry.mode === 'unknown' ? 'Add what you know' : 'Dose not entered')}</strong>}
      {!compact && syringePrimary && <span>{[entry.syringe_scale ? `U-${entry.syringe_scale}` : 'Syringe scale unknown', volume].filter(Boolean).join(' · ')}</span>}
      {!compact && medication && entry.mode !== 'medication' && markings !== null && <span>{markings} syringe units{entry.syringe_scale && ` · U-${entry.syringe_scale}`}</span>}
      {showSyringeEquivalence && <span className="dose-equivalent">{markings} units ≈ {volume}</span>}
      {editing && entry.mode === 'syringe' && medication && !showSyringeEquivalence && volume && <span>{volume}</span>}
      {!medication && <span title="Medication dose not calculated.">Medication amount unknown</span>}
      {issue && showIssue && <span className="dose-issue" role="status"><b>{issue.title}</b><span>{issue.explanation}</span>{onReview && <button type="button" className="dose-review-link" onClick={() => onReview(issue.target, issue.field)}>{issue.action}</button>}</span>}
      {!compact && !issue && !medication && <span className="dose-guidance">No current dose is recorded. Review the original instructions.</span>}
    </span>
  } catch {
    return <span className="dose-summary" role="status"><strong>{issue?.title || 'Saved dose entry is invalid'}</strong><span>{issue?.explanation || 'Review the recorded amounts and units. Original values are preserved.'}</span>{onReview && <button type="button" className="dose-review-link" onClick={() => onReview(issue?.target || 'dose', issue?.field || 'How do you measure it?')}>{issue?.action || 'Review saved dose fields'}</button>}</span>
  }
}
