import { dosingDisplay, interpretEntry, type DosingEntry } from './dosingEntry'

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
  ({ code, title, explanation, target, field, action })

// Presentation only: preserve the interpreter's calculations, conflicts and review status.
export function dosingIssue(entry: DosingEntry): DosingIssue | null {
  const result = interpretEntry(entry)
  const has = (text: string) => result.warnings.some(warning => warning.includes(text))
  if (has('Entered syringe markings and injection volume conflict')) return issue(
    'markings-volume-conflict', 'Syringe markings and volume disagree',
    `Recorded markings (${entry.syringe_markings} on U-${entry.syringe_scale}) and entered volume (${entry.injection_volume} mL) do not agree. Review Injection volume (mL), then Syringe markings and Syringe scale. Both recorded values are preserved.`,
    'syringe', 'Injection volume (mL)', 'Review injection volume')
  if (has('Entered medication dose and injection volume disagree')) return issue(
    'medication-volume-conflict', 'Medication dose and volume disagree',
    `The entered volume (${entry.injection_volume} mL) differs from the volume calculated from the recorded medication dose (${entry.dose} ${entry.dose_unit}) and preparation. Review Injection volume (mL), then Medication dose and preparation. No value has been corrected automatically.`,
    'syringe', 'Injection volume (mL)', 'Review injection volume')
  if (has('Entered medication dose and syringe markings disagree')) return issue(
    'medication-markings-conflict', 'Medication dose and syringe markings disagree',
    `Recorded medication dose (${entry.dose} ${entry.dose_unit}) and markings (${entry.syringe_markings} on U-${entry.syringe_scale}) calculate different amounts using the saved preparation. Review Syringe markings, then Medication dose and preparation. Both records are preserved.`,
    'syringe', 'Syringe markings', 'Review syringe markings')
  if (has('Unsupported syringe scale')) return issue(
    'unsupported-scale', 'Saved syringe scale is unsupported',
    `The saved U-${entry.syringe_scale} scale is preserved. Review Syringe scale against the recorded device; volume cannot be calculated from these markings with an unsupported scale.`,
    'syringe', 'Syringe scale', 'Review syringe scale')
  if (has('Add your syringe scale')) return issue(
    'missing-scale', 'Syringe scale is missing',
    'Syringe markings are recorded, but their scale is missing. Review Syringe scale using the recorded device. No scale or markings-to-volume conversion is assumed.',
    'syringe', 'Syringe scale', 'Review syringe scale')
  if (has('Medication and concentration units differ')) return issue(
    'incompatible-units', 'Medication and preparation units are incompatible',
    `Medication uses ${entry.dose_unit || 'an unknown unit'} while preparation uses ${result.concentration?.unit || 'an unknown unit'}. IU and mass units cannot be converted from these facts. Review Medication dose unit, then Vial unit or Concentration unit.`,
    'dose', 'Medication dose unit', 'Review medication dose unit')
  if (has('A derived value was too large')) return issue(
    'calculation-overflow', 'Recorded amounts exceed calculation limits',
    'A calculated equivalent is too large to represent reliably. Review the recorded amount and its unit against the original record. The entered values are preserved.',
    'dose', entry.mode === 'syringe' ? 'Syringe markings' : entry.mode === 'volume' ? 'Injection volume (mL)' : entry.mode === 'unknown' ? 'How do you measure it?' : 'Medication dose', 'Review recorded amount')
  if (has('Saved mixing details conflict')) return issue(
    'preparation-source-conflict', 'Ready-to-use and mixing details are both saved',
    'Ready to use is selected, but mixing details are also retained. Review Preparation source and the original records. The retained mixing values have not been cleared or confirmed for the current vial.',
    'vial', 'Preparation source', 'Review preparation source')
  if (has('Saved labelled concentration conflicts')) return issue(
    'preparation-source-conflict', 'Mixing and labelled concentration are both saved',
    'Mixing is selected, but a labelled concentration is also retained. Review Preparation source and the original records. The retained concentration has not been cleared or confirmed for the current vial.',
    'vial', 'Preparation source', 'Review preparation source')
  if (has('both saved preparations') || has('Preparation is unconfirmed')) return issue(
    'unknown-preparation', 'Preparation source is unconfirmed',
    'Review Preparation source to identify which saved preparation applies. Mixing details and labelled concentration are distinct records; neither is assumed to describe the current vial.',
    'vial', 'Preparation source', 'Review preparation source')
  if (entry.mode === 'unknown' && entry.review_status !== 'confirmed') return issue(
    'unknown-semantics', 'Dose meaning is unverified',
    'The saved amount has not been identified as medication dose, syringe markings or liquid volume. Review How do you measure it? using the original instructions. The original amount is preserved.',
    'dose', 'How do you measure it?', 'Review what the amount measures')
  // Optional absent preparation does not invalidate an explicit medication record.
  const preparationEntered = [entry.vial_strength, entry.vial_unit, entry.bac_water_ml, entry.concentration_value, entry.concentration_unit].some(value => value.trim())
  if (!result.medication || preparationEntered) {
    if (has('or labelled concentration')) return issue('missing-preparation', 'Preparation information is missing',
      'Review Preparation source using the original record, then add the applicable labelled concentration or mixing facts. Neither preparation type is assumed.',
      'vial', 'Preparation source', 'Review preparation source')
    if (has('complete labelled concentration')) {
      const field = Number(entry.concentration_value) > 0 ? 'Concentration unit' : 'Concentration value'
      return issue('incomplete-concentration', 'Labelled concentration is incomplete',
        `A positive concentration value and its recorded unit are needed for equivalent calculations. Review ${field}. No concentration has been inferred.`,
        'vial', field, `Review ${field.toLowerCase()}`)
    }
    if (has('Add vial strength and reconstitution volume')) {
      const field = !(Number(entry.vial_strength) > 0) ? 'Vial amount' : !['mg', 'mcg', 'IU'].includes(entry.vial_unit) ? 'Vial unit' : 'BAC water in mL'
      return issue('incomplete-mixing', 'Mixing information is incomplete',
        `Equivalent calculations need the recorded vial amount, its unit and liquid added. Review ${field}. Missing values remain unknown, and saved phase preparation is not confirmation of the current vial.`,
        'vial', field, field === 'BAC water in mL' ? 'Review liquid added' : `Review ${field.toLowerCase()}`)
    }
  }
  if (!result.medication) {
    const field = entry.mode === 'medication' ? (entry.dose.trim() ? 'Medication dose unit' : 'Medication dose') :
      entry.mode === 'syringe' ? 'Syringe markings' : entry.mode === 'volume' ? 'Injection volume (mL)' : 'How do you measure it?'
    return issue('missing-amount', 'Medication amount cannot be established',
      `Review ${field} against the original record. A missing medication dose is not inferred from the compound name or historical treatment.`,
      'dose', field, 'Review recorded amount')
  }
  if (result.hasConflict) return issue('unresolved-conflict', 'Recorded administration values disagree',
    'Review the recorded amount and units against the original record. Conflicting values are preserved.',
    'dose', 'How do you measure it?', 'Review recorded measurements')
  if (entry.review_status === 'unverified') return issue('unconfirmed-entry', 'Dose entry is unconfirmed',
    'This entry is marked unverified. Review the recorded amount and units against the original instructions. A calculated equivalent does not clinically confirm treatment instructions.',
    'dose', entry.mode === 'medication' ? 'Medication dose' : entry.mode === 'syringe' ? 'Syringe markings' : entry.mode === 'volume' ? 'Injection volume (mL)' : 'How do you measure it?',
    'Review recorded amount')
  return null
}

export function phaseDosingIssue(phase?: Parameters<typeof dosingDisplay>[0] | null): DosingIssue | null {
  if (!phase) return null
  if (phase.dosing_entry) {
    try { return dosingIssue(phase.dosing_entry) }
    catch { return issue('invalid-entry', 'Saved dose entry is invalid',
      'Some saved amounts or units cannot be interpreted. Review How do you measure it? and the recorded numeric fields. The original values are preserved.',
      'dose', 'How do you measure it?', 'Review saved dose fields') }
  }
  if (phase.dose_semantics_version !== 1) return issue('legacy-semantics', 'Dose meaning is unverified',
    'This older phase does not identify whether its saved amount means medication dose, syringe markings or liquid volume. Review How do you measure it? using the original record. Historical values are preserved.',
    'dose', 'How do you measure it?', 'Review what the amount measures')
  if (!dosingDisplay(phase).medication) return issue('missing-medication', 'Medication amount is not recorded',
    'Review Medication dose and Medication dose unit against the original instructions. Missing treatment instructions remain unknown.',
    'dose', 'Medication dose', 'Review medication dose')
  return null
}

