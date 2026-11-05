import { type DosingEntry } from './dosingEntry'
import { recordedDose, type RecordedPhase } from './recordedDose'

export const dosingReviewFields = [
  'Medication dose', 'Medication dose unit', 'Saved amount', 'Saved amount unit', 'Syringe markings', 'Syringe scale',
  'Injection volume (mL)', 'Vial amount', 'Vial unit', 'BAC water in mL',
  'Concentration value', 'Concentration unit', 'Preparation source', 'How do you measure it?',
] as const
export type DosingReviewField = typeof dosingReviewFields[number]
export type ReviewTarget = 'vial' | 'syringe' | 'dose'
export type DosingIssue = { code: string; title: string; explanation: string; severity: 'warning' | 'info'; action?: string; target: ReviewTarget; field: DosingReviewField }
export function isDosingReviewField(value: unknown): value is DosingReviewField {
  return typeof value === 'string' && dosingReviewFields.includes(value as DosingReviewField)
}
const information = (code: string, title: string, explanation: string): DosingIssue =>
  ({ code, title, explanation, severity: 'info', target: 'dose', field: 'How do you measure it?' })
const numericFields = [
  ['dose', 'Medication dose', 'dose'], ['syringe_markings', 'Syringe markings', 'syringe'],
  ['syringe_scale', 'Syringe scale', 'syringe'], ['injection_volume', 'Injection volume (mL)', 'dose'],
  ['vial_strength', 'Vial amount', 'vial'], ['bac_water_ml', 'BAC water in mL', 'vial'],
  ['concentration_value', 'Concentration value', 'vial'],
] as const

/** Classify recorded facts without comparing equivalents or assuming a shared physical vial. */
export function dosingIssue(entry: DosingEntry): DosingIssue | null {
  if (entry.version !== 2 || !['medication', 'syringe', 'volume', 'unknown'].includes(entry.mode) || !['confirmed', 'unverified'].includes(entry.review_status)) {
    return { ...information('unsupported-entry', 'Saved entry format is unsupported', 'Original values are preserved. This editor cannot repair this historical format.'), severity: 'warning' }
  }
  if ([...numericFields.map(([key]) => key), 'dose_unit', 'vial_unit', 'concentration_unit', 'vial_label'].some(key => typeof entry[key as keyof DosingEntry] !== 'string')) {
    return { ...information('unsupported-entry', 'Saved entry format is unsupported', 'Original values are preserved. This editor cannot repair this historical format.'), severity: 'warning' }
  }
  for (const [key, numericField, target] of numericFields) {
    const field = key === 'dose' && entry.mode !== 'medication' ? 'Saved amount' : numericField
    const value = entry[key]
    if (typeof value !== 'string' || value.trim() && (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim()) || !Number.isFinite(Number(value)) || Number(value) < 0 || key === 'syringe_scale' && Number(value) === 0)) {
      return { code: 'invalid-entry', severity: 'warning', title: field + ' is invalid', explanation: 'The saved value is not a valid ' + (key === 'syringe_scale' ? 'positive' : 'non-negative') + ' number. Enter only a value you can confirm from the original record.', target, field, action: 'Review ' + field }
    }
  }
  const facts = recordedDose({ dosing_entry: entry })
  const has = (value: unknown) => typeof value === 'string' && Boolean(value.trim())
  if (facts.scale && ![100, 40].includes(Number(facts.scale.value))) return information('unsupported-scale', 'Saved syringe scale is not supported', 'The recorded scale is preserved. No equivalent is calculated.')
  if (facts.markings && !facts.scale) return information('missing-scale', 'Syringe scale not recorded', 'The original markings are preserved; no scale is assumed.')
  if (entry.mode === 'unknown' || facts.ambiguousAmount) return information('unknown-semantics', 'Measurement meaning is unverified', 'The saved amount is preserved without identifying it as a medication dose.')
  const mixing = [entry.vial_strength, entry.vial_unit, entry.bac_water_ml].some(has)
  const label = [entry.concentration_value, entry.concentration_unit].some(has)
  if (mixing && label) return information('separate-preparations', 'Separate preparation records', 'Mixing details and labelled concentration are preserved separately. They do not establish the same physical vial.')
  if (entry.review_status === 'unverified') return information('unconfirmed-entry', 'Recorded facts have not been reviewed', 'The saved review status is preserved. Review is optional and does not establish historical provenance.')
  return null
}
export function phaseDosingIssue(phase?: RecordedPhase | null): DosingIssue | null {
  if (!phase) return null
  if (phase.dosing_entry) return dosingIssue(phase.dosing_entry)
  for (const key of ['dose', 'syringe_units', 'syringe_scale', 'injection_volume_ml'] as const) {
    const value = phase[key]
    if (value !== null && value !== undefined && value !== '' && (!String(value).trim() || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(String(value).trim()) || !Number.isFinite(Number(value)) || Number(value) < 0 || key === 'syringe_scale' && Number(value) === 0)) {
      return { ...information('invalid-legacy-value', 'A saved historical value is invalid', 'Original values are preserved. This editor cannot correct this older record.'), severity: 'warning' }
    }
  }
  if (phase.dose_semantics_version !== 1) return information('legacy-semantics', 'Measurement meaning is unverified',
    'This older record does not identify what ' + (recordedDose(phase).originalAmount?.value ?? 'the saved amount') + ' ' + (recordedDose(phase).originalAmount?.unit ?? '') + ' measures. Historical values are preserved; this editor cannot assign their original meaning.')
  return null
}
