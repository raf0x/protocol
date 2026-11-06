import type { QuickStartDraft } from './form'
import { quickStartIssues, type QuickStartIssue } from './quickStart'
export const creationSteps = ['Preparation', 'Measurement', 'Schedule and review'] as const
export function creationIssueStep(issue: QuickStartIssue): typeof creationSteps[number] {
  if (['name', 'vial_strength', 'vial_unit', 'bac_water_ml', 'concentration_value', 'concentration_unit'].includes(issue.field)) return 'Preparation'
  if (['input_mode', 'dose', 'dose_unit', 'route', 'syringe_markings', 'syringe_scale', 'injection_volume', 'final_solution_volume_ml'].includes(issue.field)) return 'Measurement'
  return 'Schedule and review'
}
export function creationStepIssue(draft: QuickStartDraft, step: typeof creationSteps[number], index: number) {
  return quickStartIssues(draft).find(issue => (issue.index === index || issue.field === 'startDate') && creationIssueStep(issue) === step) ?? null
}
