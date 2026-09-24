import type { QuickStartDraft } from './form'
import { quickStartIssues, type QuickStartIssue } from './quickStart'

export const guidedSteps = ['compound', 'dose', 'schedule', 'start'] as const
export type GuidedStep = typeof guidedSteps[number]
export function scheduleQuestion(route: string) {
  return route === 'SubQ' || route === 'IM' ? 'When do you inject?' : route === 'Oral' ? 'When do you take it?' : 'When do you use it?'
}
export function stepTitle(step: GuidedStep, route: string) {
  return { compound: 'What are you tracking?', dose: 'How much do you take?', schedule: scheduleQuestion(route), start: 'When does this protocol begin?' }[step]
}
export function issueStep(issue: QuickStartIssue): GuidedStep {
  if (issue.field === 'name') return 'compound'
  if (['frequencyChoice', 'days_of_week', 'cycle_days', 'time_of_day'].includes(issue.field)) return 'schedule'
  if (['startDate', 'duration_weeks'].includes(issue.field)) return 'start'
  return 'dose'
}
export function guidedStepIssue(draft: QuickStartDraft, step: GuidedStep, index: number) {
  return quickStartIssues(draft).find(issue => (issue.index === index || issue.field === 'startDate') && issueStep(issue) === step) ?? null
}
