import type { DosingEntry } from '../health/dosingEntry'
import { updateCompoundDraft, type Compound } from './form'

/** Creation-only edits: never infer a calibration or carry confirmation across changed facts. */
export function updateCreation<K extends keyof Compound>(current: Compound, field: K, value: Compound[K]): Compound {
  const next = updateCompoundDraft(current, field, value)
  if (field === 'input_mode') next.syringe_scale = current.syringe_scale
  if (['vial_strength', 'vial_unit', 'bac_water_ml', 'final_solution_volume_ml', 'concentration_value', 'concentration_unit', 'preparation', 'isPreMixed'].includes(field)) next.preparation_confirmed = false
  if (field === 'preparation') next.isPreMixed = value === 'ready'
  if (field === 'final_solution_volume_ml') next.reviewed = false
  return next
}

const number = (value: unknown): number | null => typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null
const positive = (value: unknown) => { const n = number(value); return n !== null && n > 0 ? n : null }
const close = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * 1e-9
const units = ['mg', 'mcg', 'IU']
const mass = (value: number, unit: string) => unit === 'mcg' ? value / 1000 : value
export type MeasurementPreview = { message: string; medication: { value: number; unit: string } | null; volume: number | null; markings: number | null; concentration: { value: number; unit: string } | null }

/** Pure, display-only interpretation. Never feeds medication writes or historical displays. */
export function measurementPreview(e: DosingEntry): MeasurementPreview {
  const blocked = (message: string): MeasurementPreview => ({ message, medication: null, volume: null, markings: null, concentration: null })
  for (const key of ['dose', 'syringe_markings', 'syringe_scale', 'injection_volume', 'vial_strength', 'bac_water_ml', 'concentration_value', 'final_solution_volume_ml'] as const) {
    if (e[key] !== undefined && e[key] !== '' && number(e[key]) === null) return blocked('Review the recorded amounts. An equivalent is unavailable.')
  }
  if (e.version !== 2 || e.preparation_confirmed !== true || e.review_status !== 'confirmed') return blocked('Confirm the preparation and measurement details to see an equivalent.')
  if (e.preparation !== 'mixing' && e.preparation !== 'ready') return blocked('Preparation is not confirmed. Your recorded facts can still be saved.')
  const hasMix = Boolean(e.vial_strength || e.vial_unit || e.final_solution_volume_ml)
  const hasLabel = Boolean(e.concentration_value || e.concentration_unit)
  const vial = positive(e.vial_strength), finalVolume = positive(e.final_solution_volume_ml), label = positive(e.concentration_value)
  const labelUnit = e.concentration_unit.replace(/\/mL$/, '')
  if (hasMix && (vial === null || finalVolume === null || !units.includes(e.vial_unit))) return blocked('A vial amount, medication unit and confirmed final solution volume are needed. Liquid added is a separate fact.')
  if (hasLabel && (label === null || !['mg/mL', 'mcg/mL', 'IU/mL'].includes(e.concentration_unit))) return blocked('Review the recorded label concentration and its unit.')
  const mixed = hasMix ? { value: vial! / finalVolume!, unit: e.vial_unit } : null
  const labelled = hasLabel ? { value: label!, unit: labelUnit } : null
  if (mixed && labelled && ((mixed.unit === 'IU') !== (labelled.unit === 'IU') || !close(mass(mixed.value, mixed.unit), mass(labelled.value, labelled.unit)))) return blocked('The recorded label concentration and preparation facts do not agree. Both are preserved; review them before viewing an equivalent.')
  const concentration = e.preparation === 'mixing' ? mixed : labelled
  if (!concentration || !Number.isFinite(concentration.value) || concentration.value <= 0) return blocked('The preparation is incomplete. No medication equivalent is calculated.')
  const scale = e.syringe_scale === '100' ? 100 : e.syringe_scale === '40' ? 40 : null
  if (e.syringe_scale && scale === null) return blocked('Choose the calibration printed on your syringe: U-100 or U-40.')
  const markings = number(e.syringe_markings), enteredVolume = number(e.injection_volume), dose = number(e.dose)
  if ((e.mode === 'syringe' || markings !== null) && scale === null) return blocked('Confirm the calibration printed on your syringe to see an equivalent.')
  if (e.mode === 'unknown') return blocked('Choose what your measurement represents to see an equivalent.')
  let volume: number | null = null
  if (e.mode === 'syringe' && markings !== null) volume = markings / scale!
  if (e.mode === 'volume') volume = enteredVolume
  if (e.mode === 'medication') {
    if (dose === null || !units.includes(e.dose_unit)) return blocked('Record a medication amount and unit to see an equivalent.')
    if ((e.dose_unit === 'IU') !== (concentration.unit === 'IU')) return blocked('Medication IU and mass units cannot be converted from these facts.')
    volume = mass(dose, e.dose_unit) / mass(concentration.value, concentration.unit)
  }
  if (volume === null) return blocked('Record your intended measurement to see an equivalent.')
  if ((enteredVolume !== null && !close(volume, enteredVolume)) || (markings !== null && !close(volume, markings / scale!))) return blocked('The recorded measurements do not agree. Review the facts before viewing an equivalent.')
  if (dose !== null && (e.mode !== 'medication') && (!units.includes(e.dose_unit) || (e.dose_unit === 'IU') !== (concentration.unit === 'IU') || !close(mass(dose, e.dose_unit), mass(volume * concentration.value, concentration.unit)))) return blocked('The recorded medication amount and measurement do not agree. Both are preserved.')
  if (volume === 0 && ((e.mode === 'medication' && dose !== 0) || (e.mode === 'syringe' && markings !== 0))) return blocked('These amounts are too small to calculate reliably.')
  const value = volume * concentration.value, derivedMarkings = scale === null ? null : volume * scale
  if (volume > 0 && (value === 0 || derivedMarkings === 0)) return blocked('These amounts are too small to calculate reliably.')
  if (![volume, value, concentration.value, ...(derivedMarkings === null ? [] : [derivedMarkings])].every(Number.isFinite)) return blocked('These amounts cannot be calculated reliably. Your recorded facts are preserved.')
  return { message: 'Mathematical equivalent only, based on the confirmed facts. This does not recommend an amount.', medication: { value, unit: concentration.unit }, volume, markings: derivedMarkings, concentration }
}
