import { isCalendarDate } from './protocolDates'

type Preparation = { vial_strength?: unknown; vial_unit?: string | null; bac_water_ml?: unknown }
type CompoundVial = Preparation & { reconstitution_date?: string | null }

const positive = (value: unknown) => (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) && Number(value) > 0

/** Presentation only. Legacy counters and compound logs have no physical-vial attribution. */
export function currentVialSafety(compound: CompoundVial, phasePreparation?: Preparation | null) {
  const reasons: string[] = []
  if (!compound.reconstitution_date || !isCalendarDate(compound.reconstitution_date)) reasons.push('The current vial reconstitution date is not recorded as a valid date. Review Reconstitution date if known.')
  if (!positive(compound.bac_water_ml)) reasons.push('The compound record has no positive liquid volume. Review Liquid added; saved phase mixing details do not confirm the current vial volume.')
  // Compare underlying facts, not rounded display text. Only mg/mcg share a mass dimension.
  const quantity = (value: unknown) => positive(value) ? Number(value) : null
  const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-12, Math.max(Math.abs(a), Math.abs(b)) * 1e-9)
  const amount = quantity(compound.vial_strength), savedAmount = quantity(phasePreparation?.vial_strength)
  const unit = compound.vial_unit?.trim(), savedUnit = phasePreparation?.vial_unit?.trim()
  if (amount !== null && savedAmount !== null && unit && savedUnit) {
    const mass = ['mg', 'mcg'].includes(unit) && ['mg', 'mcg'].includes(savedUnit)
    const agrees = mass ? close(amount * (unit === 'mg' ? 1000 : 1), savedAmount * (savedUnit === 'mg' ? 1000 : 1)) : unit === savedUnit && close(amount, savedAmount)
    if (!agrees) reasons.push('Preparation sources differ: compound vial amount ' + compound.vial_strength + ' ' + unit + '; saved phase vial amount ' + phasePreparation?.vial_strength + ' ' + savedUnit + '. Review Vial amount and Vial unit; neither source is automatically selected for this vial.')
  }
  const water = quantity(compound.bac_water_ml), savedWater = quantity(phasePreparation?.bac_water_ml)
  if (water !== null && savedWater !== null && !close(water, savedWater)) reasons.push('Preparation sources differ: compound liquid added ' + compound.bac_water_ml + ' mL; saved phase liquid added ' + phasePreparation?.bac_water_ml + ' mL. Review Liquid added for each source.')
  reasons.push('Remaining volume cannot be established because saved doses are not linked to an individual vial and no confirmed starting balance is recorded. Recorded amounts are preserved.')
  return { remainingMl: null, remainingFraction: null, reasons }
}
