import type { DosingEntry } from './dosingEntry'

/** Read-only facts, never equivalents. review_status describes review, not entry origin. */
export type RecordedPhase = {
  legacyMedication?: boolean; unverifiedFields?: readonly string[]; id?: string; dosing_entry?: DosingEntry | null; dose?: number | string | null; dose_unit?: string | null
  dose_semantics_version?: number | null; syringe_scale?: number | string | null
  injection_volume_ml?: number | string | null; syringe_units?: number | string | null
}
export type RecordedFact = { reviewStatus: DosingEntry['review_status'] | null; value: string; unit: string; field: string; source: 'dosing_entry' | 'legacy_phase'; origin: 'explicit_field' | 'legacy_medication' | 'saved_origin_unverified'; phaseId: string | null }
const raw = (value: unknown): string | null => typeof value === 'string' ? value.trim() ? value : null : typeof value === 'number' && Number.isFinite(value) ? String(value) : null
export const recordedAmount = (value: unknown, unit?: string | null) => {
  const amount = raw(value)
  return amount === null ? null : unit?.trim() ? `${amount} ${unit}` : amount
}

export function recordedDose(phase?: RecordedPhase | null) {
  const entry = phase?.dosing_entry
  const source = entry ? 'dosing_entry' as const : 'legacy_phase' as const
  const fact = (value: unknown, unit: string | null | undefined, field: string): RecordedFact | null => {
    const valueText = raw(value)
    return valueText === null ? null : { reviewStatus: entry?.review_status ?? null, value: valueText, unit: unit ?? '', field, source: field === 'dose' && phase?.legacyMedication ? 'legacy_phase' : source, origin: !(field === 'dose' && phase?.legacyMedication) && !phase?.unverifiedFields?.includes(field) && entry && ((field === 'dose' && entry.mode === 'medication') || (field === 'syringe_markings' && entry.mode === 'syringe') || (field === 'injection_volume' && entry.mode === 'volume')) ? 'explicit_field' : field === 'dose' && ((!entry && phase?.dose_semantics_version === 1) || phase?.legacyMedication) ? 'legacy_medication' : 'saved_origin_unverified', phaseId: phase?.id ?? null }
  }
  const originalAmount = fact(entry ? entry.dose : phase?.dose, entry ? entry.dose_unit : phase?.dose_unit, 'dose')
  const medicationOrigin = entry ? entry.version === 2 && entry.mode === 'medication' : phase?.dose_semantics_version === 1
  const medication = medicationOrigin && originalAmount && Number.isFinite(Number(originalAmount.value)) && Number(originalAmount.value) >= 0 && ['mg', 'mcg', 'IU'].includes(originalAmount.unit) ? originalAmount : null
  const markings = fact(entry ? entry.syringe_markings : phase?.syringe_units, 'markings', entry ? 'syringe_markings' : 'syringe_units')
  const volume = fact(entry ? entry.injection_volume : phase?.injection_volume_ml, 'mL', entry ? 'injection_volume' : 'injection_volume_ml')
  const scale = fact(entry ? entry.syringe_scale : phase?.syringe_scale, 'markings/mL', 'syringe_scale')
  return { medication, markings, volume, scale, originalAmount, ambiguousAmount: medication ? null : originalAmount,
    source, phaseId: phase?.id ?? null, mode: entry?.mode ?? null, reviewStatus: entry?.review_status ?? null,
    semanticsVersion: phase?.dose_semantics_version ?? null,
    medicationOrigin: medication ? entry && !phase?.legacyMedication ? 'explicit_medication_entry' as const : 'legacy_medication_semantics_v1' as const : null,
    originalEntry: entry ? { ...entry } : null }
}

export function recordedAdministrationDisplay(phase?: RecordedPhase | null) {
  const facts = recordedDose(phase)
  return { volume: facts.volume ? `${recordedAmount(facts.volume.value, 'mL')}${facts.volume.origin === 'saved_origin_unverified' ? ' · saved value, origin unverified' : ' recorded volume'}` : null,
    syringe: facts.markings ? `${facts.markings.value} ${facts.markings.origin === 'saved_origin_unverified' ? 'saved markings · origin unverified' : 'recorded markings'} · ${facts.scale ? 'U-' + facts.scale.value : 'scale unknown'}` : null }
}
export function recordedDoseDisplay(phase?: RecordedPhase | null) {
  const facts = recordedDose(phase), admin = recordedAdministrationDisplay(phase)
  const primary = facts.medication ? recordedAmount(facts.medication.value, facts.medication.unit)!
    : admin.syringe ?? (admin.volume ? admin.volume : facts.ambiguousAmount ? `${recordedAmount(facts.ambiguousAmount.value, facts.ambiguousAmount.unit)} · meaning unverified` : 'Medication amount not recorded')
  return { primary, medication: facts.medication, facts,
    secondary: facts.ambiguousAmount ? 'Saved amount has unverified meaning; original values are preserved.' : !facts.medication ? 'Medication amount not recorded.' : facts.reviewStatus === 'unverified' ? 'Recorded entry is unverified.' : '' }
}

/** Appended export columns carry meaning and original representation. */
export const recordedDoseCsvHeaders = ['Medication provenance', 'Administration provenance', 'Phase ID', 'Entry mode', 'Review status', 'Saved syringe markings', 'Saved syringe scale', 'Saved liquid volume (mL)', 'Original amount', 'Original amount unit', 'Original dosing entry JSON']
export function recordedDoseCsvFields(phase?: RecordedPhase | null) {
  const f = recordedDose(phase)
  return [f.medicationOrigin ?? 'not_recorded', JSON.stringify({ markings: f.markings?.origin ?? null, volume: f.volume?.origin ?? null, scale: f.scale?.origin ?? null }), f.phaseId ?? '', f.mode ?? '', f.reviewStatus ?? '', f.markings?.value ?? '', f.scale?.value ?? '', f.volume?.value ?? '', f.originalAmount?.value ?? '', f.originalAmount?.unit ?? '', f.originalEntry ? JSON.stringify(f.originalEntry) : '']
}
export const csvRecordedCell = (value: unknown) => '"' + String(value ?? '').replaceAll('"', '""') + '"'

/** Structured event snapshots retain original V2 JSON; V1 doseConfirmed was emitted
 * only for saved medication semantics by protocol_phase_event_state_v1. */
export function recordedEventMedication(metadata: Record<string, unknown> | null | undefined, side: 'previous' | 'new' = 'new') {
  if (metadata?.version !== 1) return null
  const value = metadata[`${side}State`]
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const state = value as Record<string, unknown>
  const entry = state.dosingEntry && typeof state.dosingEntry === 'object' ? state.dosingEntry as DosingEntry : null
  return recordedDose({ id: typeof state.phaseId === 'string' ? state.phaseId : undefined, dosing_entry: entry,
    dose: !entry && state.doseConfirmed === true && (typeof state.medicationDose === 'string' || typeof state.medicationDose === 'number') ? state.medicationDose : null,
    dose_unit: typeof state.medicationUnit === 'string' ? state.medicationUnit : null,
    dose_semantics_version: !entry && state.doseConfirmed === true ? 1 : null }).medication
}

/** Presentation only: a hydrated legacy field is not a new explicit user entry. */
export function recordedReviewPhase(entry: DosingEntry, historical?: { phase?: RecordedPhase; touched: Record<string, boolean>; addingPhase: boolean }): RecordedPhase {
  const original = historical?.phase
  if (!original || original.dosing_entry || historical?.addingPhase) return { id: original?.id, dosing_entry: entry }
  const touched = historical!.touched
  if (!['input_mode', 'dose', 'dose_unit', 'syringe_markings', 'injection_volume', 'syringe_scale'].some(field => touched[field])) return original
  return { id: original.id, dosing_entry: entry, legacyMedication: original.dose_semantics_version === 1 && !['dose', 'dose_unit', 'input_mode'].some(field => touched[field]),
    unverifiedFields: ['syringe_markings', 'injection_volume', 'syringe_scale'].filter(field => !touched[field]) }
}
