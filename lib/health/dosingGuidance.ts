import { validateEntry, type DosingEntry } from './dosingEntry'
import { recordedDose, type RecordedPhase } from './recordedDose'

export const dosingReviewFields = [
  'Medication dose', 'Medication dose unit', 'Syringe markings', 'Syringe scale',
  'Injection volume (mL)', 'Vial amount', 'Vial unit', 'BAC water in mL',
  'Concentration value', 'Concentration unit', 'Preparation source', 'How do you measure it?',
] as const
export type DosingReviewField = typeof dosingReviewFields[number]
export type ReviewTarget = 'vial' | 'syringe' | 'dose'
export type DosingIssue = { code: string; title: string; explanation: string; action: string; target: ReviewTarget; field: DosingReviewField }
export function isDosingReviewField(value: unknown): value is DosingReviewField {
  return typeof value === 'string' && dosingReviewFields.includes(value as DosingReviewField)
}
const issue = (code: string, title: string, explanation: string, target: ReviewTarget, field: DosingReviewField, action = `Review ${field}`): DosingIssue =>
  ({ code, title, explanation: `${explanation} Review ${field}.`, target, field, action })

/** Completeness and source checks only. Never compare calculated equivalents. */
export function dosingIssue(entry: DosingEntry): DosingIssue | null {
  try { validateEntry(entry, { allowUnsupportedSyringeScale: true }) } catch { return issue('invalid-entry', 'Saved dose entry is invalid', 'Review the original amounts and units. Original values are preserved.', 'dose', 'How do you measure it?', 'Review saved dose fields') }
  const facts = recordedDose({ dosing_entry: entry })
  const has = (value: unknown) => typeof value === 'string' && Boolean(value.trim())
  if (facts.markings && !facts.scale) return issue('missing-scale', 'Syringe scale is missing',
    'Syringe markings are recorded, but their scale is missing. Check the recorded device; none is assumed.', 'syringe', 'Syringe scale')
  if (facts.scale && !['100', '40'].includes(facts.scale.value.trim())) return issue('unsupported-scale', 'Check the saved syringe scale',
    `Saved scale U-${facts.scale.value} is retained. It has not been confirmed as U-100 or U-40.`, 'syringe', 'Syringe scale')
  const mixing = [entry.vial_strength, entry.vial_unit, entry.bac_water_ml].some(has)
  const label = [entry.concentration_value, entry.concentration_unit].some(has)
  const preparation = entry.preparation ?? (entry.is_premixed === true ? 'ready' : entry.is_premixed === false ? 'mixing' : 'unknown')
  if ((mixing && label) || (preparation === 'ready' && mixing) || (preparation === 'mixing' && label)) return issue('preparation-source-conflict', 'Two preparation records are saved',
    'Mixing details and labelled concentration are separate records. Check which applies. Both are preserved; water added does not confirm final solution volume.', 'vial', 'Preparation source')
  if (preparation === 'unknown' && (mixing || label)) return issue('unknown-preparation', 'Preparation source is unconfirmed', 'Check the original preparation record; no final volume is assumed.', 'vial', 'Preparation source')
  if (label && (!has(entry.concentration_value) || !has(entry.concentration_unit))) {
    const field = has(entry.concentration_value) ? 'Concentration unit' : 'Concentration value'
    return issue('incomplete-concentration', 'Labelled concentration is incomplete', 'Only saved label facts are shown; missing information stays unknown.', 'vial', field)
  }
  if (mixing && (!has(entry.vial_strength) || !has(entry.vial_unit) || !has(entry.bac_water_ml))) {
    const field = !has(entry.vial_strength) ? 'Vial amount' : !has(entry.vial_unit) ? 'Vial unit' : 'BAC water in mL'
    return issue('incomplete-mixing', 'Mixing record is incomplete', 'Check the original mixing record. Water added does not confirm final solution volume.', 'vial', field)
  }
  if (facts.medication && ((entry.dose_unit === 'IU' && ((has(entry.vial_unit) && entry.vial_unit !== 'IU') || (has(entry.concentration_unit) && entry.concentration_unit !== 'IU/mL'))) || (entry.dose_unit !== 'IU' && (entry.vial_unit === 'IU' || entry.concentration_unit === 'IU/mL')))) return issue('incompatible-units', 'Medication and preparation units differ', 'Both saved units are retained. No unit conversion or equivalent is provided.', 'dose', 'Medication dose unit')
  if (entry.mode === 'unknown' || facts.ambiguousAmount) return issue('unknown-semantics', 'Saved amount needs clarification',
    `Saved amount${facts.ambiguousAmount ? ' (' + facts.ambiguousAmount.value + ' ' + facts.ambiguousAmount.unit + ')' : ''} has not been identified as a medication amount. Review the original record; confirmation does not change its meaning.`, 'dose', 'How do you measure it?')
  if ([facts.medication, facts.markings, facts.volume].filter(Boolean).length > 1) return issue('multiple-recorded-measurements', 'Check the recorded measurements',
    'Medication, markings and liquid volume are separate facts. Their agreement has not been verified. Nothing is recalculated or corrected.', 'dose', 'How do you measure it?')
  if (!facts.medication) return issue('missing-medication', 'Medication amount not recorded',
    'Only saved measurements are shown.', 'dose', 'Medication dose', 'Review recorded amount')
  if (entry.review_status !== 'confirmed') return issue('unconfirmed-entry', 'Recorded entry is unverified',
    'Check the amount and unit against your original record. Review does not clinically confirm treatment instructions.', 'dose', 'Medication dose', 'Review recorded amount')
  return null
}
export function phaseDosingIssue(phase?: RecordedPhase | null): DosingIssue | null {
  if (!phase) return null
  if (phase.dosing_entry) return dosingIssue(phase.dosing_entry)
  if (phase.dose_semantics_version !== 1) return issue('legacy-semantics', 'Saved amount needs clarification',
    `This older record does not identify what ${recordedDose(phase).originalAmount?.value ?? 'the saved amount'} ${recordedDose(phase).originalAmount?.unit ?? ''} measures. Historical values are preserved.`, 'dose', 'How do you measure it?', 'Review original record')
  if (!recordedDose(phase).medication) return issue('missing-medication', 'Medication amount not recorded',
    'Check the original record. Missing information stays unknown.', 'dose', 'Medication dose')
  return null
}
