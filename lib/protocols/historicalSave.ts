import type { Compound } from './form'
import { entryFromForm } from '../health/dosingEntry'
import { phaseEndWeek } from '../health/phaseLifecycle'
import { isCalendarDate } from '../health/protocolDates'

type Raw = Record<string, any>
export type HistoricalSource = {
  compound: Raw; compoundDraft: Raw; phase?: Raw; phaseDraft: Raw
  touched: Record<string, boolean>; addingPhase: boolean
}
const compoundFields = ['name', 'reconstitution_date', 'notes', 'vials_in_stock']
const entryFields: Record<string, string> = {
  input_mode: 'mode', dose: 'dose', dose_unit: 'dose_unit', syringe_markings: 'syringe_markings',
  syringe_scale: 'syringe_scale', injection_volume: 'injection_volume', vial_strength: 'vial_strength',
  vial_unit: 'vial_unit', bac_water_ml: 'bac_water_ml', concentration_value: 'concentration_value',
  concentration_unit: 'concentration_unit', vial_label: 'vial_label',
}
const phaseFields = [...Object.keys(entryFields), 'isPreMixed', 'preparation', 'reviewed',
  'phase_start_week', 'duration_weeks', 'frequency_mode', 'cycle_days', 'days_of_week', 'time_of_day', 'route']
const fieldLabels: Record<string, string> = { dose: 'Medication dose', dose_unit: 'Medication dose unit', syringe_markings: 'Syringe markings', syringe_scale: 'Syringe scale', injection_volume: 'Injection volume (mL)', vial_strength: 'Vial amount', vial_unit: 'Vial unit', bac_water_ml: 'Liquid added', concentration_value: 'Concentration value', concentration_unit: 'Concentration unit', vial_label: 'Vial label' }
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key)
function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) as T
  return value
}
const pick = (value: Raw, keys: string[]) => Object.fromEntries(keys.filter(key => own(value, key)).map(key => [key, clone(value[key])]))
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right)

/** Capture source facts separately from display hydration; never persist this metadata. */
export function captureHistoricalCompound(draft: Compound, compound: Raw, phase?: Raw): Compound {
  return { ...draft, historical: {
    compound: pick(compound, ['id', ...compoundFields]), compoundDraft: pick(draft, compoundFields),
    phase: phase ? clone(phase) : undefined, phaseDraft: pick(draft, phaseFields), touched: {}, addingPhase: false,
  } }
}
export function markHistoricalEdit(source: HistoricalSource | undefined, field: string): HistoricalSource | undefined {
  return source && { ...source, touched: { ...source.touched, [field]: true } }
}
export function rebindHistoricalPhase(current: Compound, draft: Compound, phase?: Raw, addingPhase = false): Compound {
  if (!current.historical) return draft
  return { ...draft, historical: { ...current.historical, phase: phase ? clone(phase) : undefined,
    phaseDraft: pick(draft, phaseFields), addingPhase,
    touched: Object.fromEntries(Object.entries(current.historical.touched).filter(([key]) => !phaseFields.includes(key))),
  } }
}
function stop(compound: Compound, explanation: string): never {
  throw new Error(compound.name + ': ' + explanation + ' No changes were saved. Cancel to keep the recorded history unchanged.')
}
function rawEntry(compound: Compound, entry: unknown): asserts entry is Raw {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) stop(compound, 'This phase has no historical dosing entry that this save can preserve. Use Add phase only when you intend to record a new treatment phase.')
  const value = entry as Raw
  if (String(value.version) !== '2' || !['medication', 'syringe', 'volume', 'unknown'].includes(value.mode) || !['confirmed', 'unverified'].includes(value.review_status)) {
    stop(compound, 'The historical dosing entry has an unsupported version, measurement meaning or review status. Review the original record; a separate supported correction is required.')
  }
  for (const key of ['dose', 'syringe_markings', 'syringe_scale', 'injection_volume', 'vial_strength', 'bac_water_ml', 'concentration_value']) {
    const text = value[key]
    if (typeof text !== 'string' || text.trim() && (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text.trim()) || !Number.isFinite(Number(text)) || Number(text) < 0 || key === 'syringe_scale' && Number(text) === 0)) {
      stop(compound, 'The historical dosing entry cannot preserve ' + fieldLabels[key] + '. Review this recorded field before saving; missing values must not be inferred.')
    }
  }
  for (const key of ['dose_unit', 'vial_unit', 'concentration_unit', 'vial_label']) if (typeof value[key] !== 'string') stop(compound, 'The historical dosing entry cannot preserve ' + fieldLabels[key] + '. Review this recorded field before saving.')
}

/** Existing SQL supports omission for compound facts, but requires a complete selected phase. */
export function historicalCompoundPayload(compound: Compound, newPayload: () => Raw) {
  const source = compound.historical
  if (!source || source.compound.id !== compound.id) stop(compound, 'The original compound facts are unavailable. Close and reopen the protocol before editing.')
  const changed = (key: string) => Boolean(source.touched[key]) || !same((compound as unknown as Raw)[key], (compoundFields.includes(key) ? source.compoundDraft : source.phaseDraft)[key])
  const name = changed('name') ? compound.name.trim() : source.compound.name
  if (typeof name !== 'string' || name !== name.trim() || !name || name.length > 100) stop(compound, 'The saved compound name cannot be preserved by this save. Explicitly review Compound name before saving.')
  const payload: { id: string; name: string; phase: Raw; reconstitution_date?: string | null; notes?: string; vials_in_stock?: number } = { id: compound.id!, name, phase: {} }
  // A ready-to-use phase never authorizes changing a separate compound observation.
  if (changed('reconstitution_date')) {
    if (compound.reconstitution_date && !isCalendarDate(compound.reconstitution_date)) stop(compound, 'Review Reconstitution date and enter a valid calendar date.')
    payload.reconstitution_date = compound.reconstitution_date || null
  }
  if (changed('notes')) payload.notes = compound.notes.trim()
  if (changed('vials_in_stock')) {
    if (compound.vials_in_stock.trim() === '') {
      if (source.compound.vials_in_stock !== null && source.compound.vials_in_stock !== undefined) stop(compound, 'This save cannot change a known stock count to unknown. Keep Vials in stock unchanged; a supported inventory correction is required.')
    } else {
      const stock = Number(compound.vials_in_stock)
      if (!Number.isSafeInteger(stock) || stock < 0) stop(compound, 'Review Vials in stock and enter a non-negative whole number.')
      payload.vials_in_stock = stock
    }
  }
  if (!compound.phase_id) {
    if (!source.addingPhase) stop(compound, 'There is no selected historical phase to preserve. Use Add phase only if a new treatment phase is intended.')
    payload.phase = newPayload().phase
    return payload
  }
  const phase = source.phase
  if (!phase || phase.id !== compound.phase_id) stop(compound, 'The original selected phase is unavailable. Select the phase again before editing.')
  if (!phase.dosing_entry || typeof phase.dosing_entry !== 'object' || Array.isArray(phase.dosing_entry)) rawEntry(compound, phase.dosing_entry)
  const entry: Raw = clone(phase.dosing_entry)
  const modifiedEntryFields = Object.keys(entryFields).filter(changed)
  const preparationChanged = changed('isPreMixed') || changed('preparation')
  if (modifiedEntryFields.length || preparationChanged) {
    const edited = entryFromForm(compound)
    for (const field of modifiedEntryFields) entry[entryFields[field]] = edited[entryFields[field] as keyof typeof edited]
    if (preparationChanged) { entry.is_premixed = edited.is_premixed; entry.preparation = edited.preparation }
    entry.review_status = source.touched.reviewed && compound.reviewed ? 'confirmed' : 'unverified'
  } else if (changed('reviewed')) entry.review_status = compound.reviewed ? 'confirmed' : 'unverified'
  rawEntry(compound, entry)
  const boundariesChanged = changed('phase_start_week') || changed('duration_weeks')
  const start = boundariesChanged ? Number(compound.phase_start_week) : phase.start_week
  const end = boundariesChanged ? phaseEndWeek(start, compound.duration_weeks) : phase.end_week
  if (!Number.isSafeInteger(start) || start < 1 || end !== null && (!Number.isSafeInteger(end) || end < start)) stop(compound, 'Review Phase start week and Phase duration weeks; the saved boundaries cannot safely round-trip.')
  const duration = end === null ? null : end - start + 1
  if (!boundariesChanged && phase.duration_weeks !== duration) stop(compound, 'The recorded phase duration disagrees with its boundaries. Explicitly review Phase start week and Phase duration weeks before saving.')
  const scheduleChanged = ['frequency_mode', 'cycle_days', 'days_of_week'].some(changed)
  const frequency = scheduleChanged ? compound.frequency_mode === 'rolling' ? (compound.cycle_days ? 'every' + compound.cycle_days + 'days' : '') : compound.days_of_week.length === 7 ? 'daily' : compound.days_of_week.length ? compound.days_of_week.length + 'x/week' : '' : phase.frequency
  const days = scheduleChanged ? compound.frequency_mode === 'weekly' ? clone(compound.days_of_week) : [] : clone(phase.days_of_week)
  const day = scheduleChanged ? compound.frequency_mode === 'weekly' ? compound.days_of_week[0] ?? null : null : phase.day_of_week
  const route = changed('route') ? compound.route || null : phase.route
  const time = changed('time_of_day') ? compound.time_of_day.toLowerCase() : phase.time_of_day
  if (frequency !== null && (typeof frequency !== 'string' || frequency !== '' && !/^(daily|[1-7]x\/week|every[1-7]days)$/.test(frequency))) stop(compound, 'The saved frequency cannot round-trip. Explicitly review the Schedule fields before saving.')
  if (days !== null && (!Array.isArray(days) || days.some((value: unknown) => !Number.isInteger(value) || Number(value) < 0 || Number(value) > 6))) stop(compound, 'The saved weekdays are unavailable or invalid. Review Schedule or reopen the protocol before saving.')
  if (scheduleChanged && Array.isArray(days) && new Set(days).size !== days.length) stop(compound, 'Review Schedule and choose each weekday only once before saving.')
  if (day !== null && (!Number.isInteger(day) || day < 0 || day > 6)) stop(compound, 'The saved weekday is unavailable or invalid. Review Schedule or reopen the protocol before saving.')
  if (route !== null && typeof route !== 'string') stop(compound, 'The recorded route is unavailable. Reopen the protocol before saving; no route can be assumed.')
  if (time !== null && typeof time !== 'string') stop(compound, 'The recorded time is unavailable. Reopen the protocol before saving; no schedule can be assumed.')
  payload.phase = { id: phase.id, dosing_entry: entry, start_week: start, end_week: end, frequency, days_of_week: days, day_of_week: day, time_of_day: time, route }
  return payload
}
