import { recordedAdministrationDisplay, recordedDoseDisplay, type RecordedPhase } from '../../lib/health/recordedDose'
import { phaseDosingIssue, type ReviewTarget, type DosingReviewField } from '../../lib/health/dosingGuidance'
export { dosingIssue, phaseDosingIssue } from '../../lib/health/dosingGuidance'

type Props = { phase: RecordedPhase | null | undefined; onReview?: (target: ReviewTarget, field?: DosingReviewField) => void; editing?: boolean; compact?: boolean; showIssue?: boolean }

export default function DoseSummary({ phase, onReview, editing = false, compact = false, showIssue = true }: Props) {
  const display = recordedDoseDisplay(phase), admin = recordedAdministrationDisplay(phase)
  const issue = phaseDosingIssue(phase)
  return <span className="dose-summary">
    {!editing && <strong>{display.primary}</strong>}
    {!compact && display.medication && admin.syringe && <span>{admin.syringe}</span>}
    {!compact && admin.volume && (display.medication || admin.syringe) && <span>{admin.volume}</span>}
    {!compact && display.facts.ambiguousAmount && (admin.syringe || admin.volume) && <span>Saved amount: {display.facts.ambiguousAmount.value} {display.facts.ambiguousAmount.unit} · meaning unverified</span>}
    {issue && showIssue && <span className="dose-issue" role="status"><b>{issue.title}</b><span>{issue.explanation}</span>{onReview && <button type="button" className="dose-review-link" onClick={() => onReview(issue.target, issue.field)}>{issue.action}</button>}</span>}
  </span>
}
