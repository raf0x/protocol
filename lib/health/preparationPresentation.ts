import { isCalendarDate } from './protocolDates'

type PreparationFacts = { vial_strength?: unknown; vial_unit?: unknown; bac_water_ml?: unknown; concentration_value?: unknown; concentration_unit?: unknown }
type CompoundFacts = PreparationFacts & { reconstitution_date?: string | null }

/** Calendar tracking only. This is not an expiration or beyond-use date. */
export function reconstitutionCheckReminder(date?: string | null): string | null {
  if (!date || !isCalendarDate(date)) return null
  const day = new Date(date + 'T12:00:00Z')
  day.setUTCDate(day.getUTCDate() + 28)
  const result = day.toISOString().slice(0, 10)
  return isCalendarDate(result) ? result : null
}

/** Read-only source selection; a saved preparation is never a physical-vial balance. */
export function preparationPresentation(compound: CompoundFacts, phase?: { dosing_entry?: unknown } | null) {
  const hasPhaseEntry = phase?.dosing_entry !== null && phase?.dosing_entry !== undefined
  const raw = hasPhaseEntry ? phase!.dosing_entry : compound
  const facts: PreparationFacts = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const value = facts.vial_strength, unit = facts.vial_unit
  const validAmount = (typeof value === 'number' || typeof value === 'string' && value.trim() !== '') && Number.isFinite(Number(value)) && Number(value) > 0
  const amount = validAmount && typeof unit === 'string' && ['mg', 'mcg', 'IU'].includes(unit) ? { value: value as string | number, unit } : null
  const recordedDate = compound.reconstitution_date && isCalendarDate(compound.reconstitution_date) ? compound.reconstitution_date : null
  return { amount, facts, source: hasPhaseEntry ? 'phase' as const : 'legacy' as const,
    label: hasPhaseEntry ? 'Saved phase preparation' : 'Saved legacy compound preparation',
    recordedDate, checkReminder: reconstitutionCheckReminder(recordedDate) }
}
