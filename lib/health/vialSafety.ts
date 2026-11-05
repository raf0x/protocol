import { isCalendarDate } from './protocolDates'

type Preparation = { vial_strength?: unknown; vial_unit?: string | null; bac_water_ml?: unknown }
type CompoundVial = Preparation & { reconstitution_date?: string | null }

/** Independent historical preparations cannot establish a physical-vial starting balance. */
export function currentVialSafety(compound: CompoundVial, _phasePreparation?: Preparation | null) {
  const invalidFacts: string[] = []
  for (const [key, label] of [['vial_strength', 'vial amount'], ['bac_water_ml', 'liquid added']] as const) {
    const value = compound[key]
    if (value !== null && value !== undefined && value !== '' && (!(typeof value === 'string' || typeof value === 'number') || !String(value).trim() || !Number.isFinite(Number(value)) || Number(value) < 0)) {
      invalidFacts.push('Recorded compound ' + label + ' is invalid. This historical compound field cannot be corrected in this editor.')
    }
  }
  if (compound.reconstitution_date && !isCalendarDate(compound.reconstitution_date)) invalidFacts.push('The recorded reconstitution date is invalid. No date or expiration is inferred.')
  return { remainingMl: null, remainingFraction: null, invalidFacts,
    reasons: ['Remaining amount needs individual-vial history and a recorded starting balance. Saved doses are not linked to an individual vial; editing preparation details cannot establish that history.'] }
}
