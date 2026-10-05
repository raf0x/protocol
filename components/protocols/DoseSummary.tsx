import { administrationDisplay, dosingDisplay, formatProtocolAmount, formatProtocolNumber, interpretEntry, type DosingEntry } from '../../lib/health/dosingEntry'

type ReviewTarget = 'vial' | 'syringe' | 'dose'
type DosingIssue = { title: string; explanation: string; action: string; target: ReviewTarget }
type Props = { phase: Parameters<typeof dosingDisplay>[0]; onReview?: (target: ReviewTarget) => void; editing?: boolean; compact?: boolean; showIssue?: boolean }

// These messages classify existing interpreter guidance; no dose is calculated here.
export function dosingIssue(entry: DosingEntry): DosingIssue | null {
  const result = interpretEntry(entry)
  const has = (phrase: string) => result.warnings.some(warning => warning.includes(phrase))
  if (has('Entered syringe markings and injection volume conflict')) return {
    title: 'Syringe details need review',
    explanation: 'Your syringe units and entered volume do not line up.',
    action: 'Review syringe details', target: 'syringe',
  }
  if (has('Entered medication dose and syringe markings disagree')) return {
    title: 'Vial details need review',
    explanation: 'Your syringe amount and vial information calculate different medication amounts.',
    action: 'Review vial details', target: 'vial',
  }
  if (has('Entered medication dose and injection volume disagree')) return {
    title: 'Vial details need review',
    explanation: 'Your entered volume and vial information calculate a different medication amount.',
    action: 'Review vial details', target: 'vial',
  }
  if (has('Saved mixing details conflict') || has('Saved labelled concentration conflicts') || has('both saved preparations')) return {
    title: 'Vial details need review',
    explanation: 'Your saved vial details do not match the preparation selected.',
    action: 'Review vial details', target: 'vial',
  }
  if (has('Unsupported syringe scale')) return {
    title: 'Syringe scale needs review',
    explanation: `The saved U-${entry.syringe_scale} scale cannot be used to calculate volume.`,
    action: 'Review syringe details', target: 'syringe',
  }
  if (has('Medication and concentration units differ')) return {
    title: 'Vial units need review',
    explanation: 'The medication and vial units do not line up.',
    action: 'Review vial details', target: 'vial',
  }
  if (has('A derived value was too large')) return {
    title: 'Entered amounts need review',
    explanation: 'One amount is too large to calculate reliably.',
    action: 'Review dose', target: 'dose',
  }
  if (has('Preparation is unconfirmed') || has('Choose which preparation information applies')) return {
    title: 'Vial details need review',
    explanation: 'Check whether the vial is ready to use or needs mixing.',
    action: 'Review vial details', target: 'vial',
  }
  if (entry.mode === 'unknown' && result.status === 'unverified' && (entry.syringe_markings || entry.injection_volume || entry.dose)) return {
    title: 'Dose details need review',
    explanation: 'Check what the saved amount measures.',
    action: 'Review dose', target: 'dose',
  }
  if (result.hasConflict) return {
    title: 'Dose details need review',
    explanation: 'Your entered dose and administration amounts do not line up.',
    action: 'Review dose', target: 'dose',
  }
  return null
}

export default function DoseSummary({ phase, onReview, editing = false, compact = false, showIssue = true }: Props) {
  const entry = phase?.dosing_entry
  if (!entry) {
    const display = dosingDisplay(phase)
    const admin = administrationDisplay(phase)
    return <span className="dose-summary">
      <strong title={phase && !display.medication ? 'Medication dose not calculated.' : undefined}>{display.medication ? formatProtocolAmount(display.medication.value, display.medication.unit) : phase ? 'Medication amount unknown' : 'Dose not entered'}</strong>
      {!compact && admin.syringe && <span>{admin.syringe}</span>}{!compact && admin.volume && <span>{admin.volume}</span>}
      {phase && !display.medication && onReview && <button type="button" className="dose-review-link" onClick={() => onReview('dose')}>Review dose</button>}
    </span>
  }
  try {
    const result = interpretEntry(entry)
    const issue = dosingIssue(entry)
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
      {issue && showIssue && (compact ? <span className="dose-issue-title">{issue.title}</span> : <span className="dose-issue" role="status"><b>{issue.title}</b><span>{issue.explanation}</span>{onReview && <button type="button" className="dose-review-link" onClick={() => onReview(issue.target)}>{issue.action}</button>}</span>)}
      {!compact && !issue && !medication && <span className="dose-guidance">Add vial details to calculate it.</span>}
      {editing && !issue && !medication && onReview && <button type="button" className="dose-review-link" onClick={() => onReview('vial')}>Add vial details</button>}
    </span>
  } catch {
    return <span className="dose-summary" role="status"><strong>Dose details need review</strong><span>Check the entered amounts and units.</span>{onReview && <button type="button" className="dose-review-link" onClick={() => onReview('dose')}>Review dose</button>}</span>
  }
}
