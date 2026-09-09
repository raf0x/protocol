export const MEDICATION_UNITS = ['mg', 'mcg', 'IU'] as const
export type MedicationUnit = typeof MEDICATION_UNITS[number]
export type ConcentrationUnit = `${MedicationUnit}/mL`
export type DosingInput = {
  dose: number; dose_unit: string
  concentration_value?: number | null; concentration_unit?: string | null
  vial_strength?: number | null; vial_unit?: string | null; bac_water_ml?: number | null
  syringe_scale?: number | null
}
export const isMedicationUnit = (unit: unknown): unit is MedicationUnit => MEDICATION_UNITS.includes(unit as MedicationUnit)
const positive = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0

export function calculateDosing(input: DosingInput) {
  if (!positive(input.dose) || !isMedicationUnit(input.dose_unit)) throw new Error('Enter a positive medication dose in mg, mcg, or IU.')
  let concentration: { value: number; unit: ConcentrationUnit } | null = null
  if (input.concentration_value != null || input.concentration_unit) {
    if (!positive(input.concentration_value) || !['mg/mL', 'mcg/mL', 'IU/mL'].includes(input.concentration_unit ?? '')) throw new Error('Enter both concentration value and unit.')
    concentration = { value: input.concentration_value, unit: input.concentration_unit as ConcentrationUnit }
  } else if (input.vial_strength != null || input.bac_water_ml != null) {
    if (!positive(input.vial_strength) || !positive(input.bac_water_ml) || !isMedicationUnit(input.vial_unit)) throw new Error('Enter a positive vial amount, medication unit, and reconstitution volume.')
    concentration = { value: input.vial_strength / input.bac_water_ml, unit: `${input.vial_unit}/mL` }
  }
  let volume: number | null = null
  if (concentration) {
    const unit = concentration.unit.split('/')[0]
    if ((unit === 'IU') !== (input.dose_unit === 'IU')) throw new Error('Medication IU cannot be converted to or from mass units.')
    const doseInConcentrationUnit = input.dose_unit === unit ? input.dose : input.dose_unit === 'mg' ? input.dose * 1000 : input.dose / 1000
    volume = doseInConcentrationUnit / concentration.value
    if (!positive(volume)) throw new Error('Calculated volume is not valid.')
  }
  if (input.syringe_scale != null && ![40, 100].includes(input.syringe_scale)) throw new Error('Select a supported syringe scale explicitly.')
  if (input.syringe_scale != null && volume == null) throw new Error('Concentration is required to calculate syringe markings.')
  const markings = volume != null && input.syringe_scale != null ? volume * input.syringe_scale : null
  return {
    administeredDose: { value: input.dose, unit: input.dose_unit },
    concentration,
    injectionVolume: volume == null ? null : { value: volume, unit: 'mL' as const },
    syringeUnits: markings == null ? null : { value: markings, unit: 'syringe units' as const, scale: input.syringe_scale! },
  }
}

export function dosingFields(input: DosingInput) {
  const result = calculateDosing(input)
  return {
    compound: { concentration_value: result.concentration?.value ?? null, concentration_unit: result.concentration?.unit ?? null },
    phase: {
      dose: result.administeredDose.value, dose_unit: result.administeredDose.unit, dose_semantics_version: 1,
      injection_volume_ml: result.injectionVolume?.value ?? null,
      syringe_units: result.syringeUnits?.value ?? null, syringe_scale: result.syringeUnits?.scale ?? null,
    },
  }
}

export function currentPhase<T extends { start_week: number | null; end_week: number | null }>(phases: T[], start: string, date: string): T | null {
  const days = (Date.parse(date.slice(0, 10)) - Date.parse(start.slice(0, 10))) / 86400000
  if (!Number.isFinite(days) || days < 0) return null
  const week = Math.floor(days / 7) + 1
  const matches = phases.filter(p => p.start_week != null && week >= p.start_week && (p.end_week == null || week <= p.end_week))
  return matches.length === 1 ? matches[0] : null
}

export function quickCreatePayload(body: Record<string, unknown>) {
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100) throw new Error('Invalid name')
  const fields = dosingFields({ dose: body.dose as number, dose_unit: body.dose_unit as string,
    vial_strength: body.vial as number, vial_unit: body.vial_unit as string, bac_water_ml: body.water as number,
    concentration_value: body.concentration_value as number, concentration_unit: body.concentration_unit as string,
    syringe_scale: body.syringe_scale as number })
  if (body.vial != null && (!positive(body.vial) || !isMedicationUnit(body.vial_unit))) throw new Error('Invalid vial amount or unit')
  const frequency = body.frequency ?? '1x/week'
  if (typeof frequency !== 'string' || !/^(daily|[1-7]x\/week|every[1-7]days)$/.test(frequency)) throw new Error('Invalid frequency')
  return { name: body.name.trim(), compounds: [{ name: body.name.trim(), ...fields.compound,
    vial_strength: body.vial ?? null, vial_unit: body.vial_unit ?? null, bac_water_ml: body.water ?? null,
    phase: { ...fields.phase, name: 'Phase 1', start_week: 1, end_week: 4, frequency },
  }] }
}
