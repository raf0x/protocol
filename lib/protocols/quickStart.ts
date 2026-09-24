import { canonicalCompoundName, compoundNameError, normalizeCompoundName, resolveCompound } from './catalog'
import { newCompound, type Compound, type DefaultSource, type QuickStartDraft } from './form'
import { dosingDisplay, entryFormState, entryFromForm, interpretEntry, type DosingEntry } from '../health/dosingEntry'
import { isCalendarDate, localCalendarDate, protocolSaveDates } from '../health/protocolDates'
import { inventoryProtocolFields } from '../inventory/protocol'
import type { InventoryItem } from '../inventory/model'

const priority: Record<DefaultSource, number> = { previous: 1, session: 2, inventory: 3, handoff: 4 }
export function applyDefaults(current: Compound, values: Partial<Compound>, source: DefaultSource): Compound {
  const next = { ...current, origins: { ...current.origins } }
  for (const key of Object.keys(values) as (keyof Compound)[]) {
    if (key === 'origins' || key === 'id' || key === 'phase_id' || key === 'phase_options') continue
    if (current.origins?.[key] && priority[current.origins[key]!] > priority[source]) continue
    Object.assign(next, { [key]: values[key] })
    next.origins[key] = source
  }
  return next
}

export function selectCompound(current: Compound, name: string) {
  const canonical = canonicalCompoundName(name)
  if (compoundNameError(canonical)) return current
  // A different identity starts a fresh setup; never carry another medication's dose.
  const same = normalizeCompoundName(canonicalCompoundName(current.name)) === normalizeCompoundName(canonical)
  return withSingleUnit({ ...(same ? current : newCompound()), name: canonical, manualName: false })
}

function withSingleUnit(compound: Compound): Compound {
  const units = resolveCompound(compound.name)?.units
  return !compound.dose_unit && !compound.origins?.dose_unit && units?.length === 1 ? { ...compound, dose_unit: units[0] } : compound
}

export function selectInventory(current: Compound, item: InventoryItem) {
  const facts = inventoryProtocolFields(item)
  const values: Partial<Compound> = { name: canonicalCompoundName(facts.name) }
  if (facts.vial_strength) { values.vial_strength = facts.vial_strength; values.vial_unit = facts.vial_unit }
  if (item.form === 'pre-mixed vial' || item.form === 'cartridge') { values.preparation = 'ready'; values.isPreMixed = true }
  if (item.form === 'lyophilized vial') { values.preparation = 'mixing'; values.isPreMixed = false }
  if (facts.reconstitution_date) { values.reconstitution_date = facts.reconstitution_date; values.mixDateSet = true }
  return applyDefaults(selectCompound(current, item.item_name), values, 'inventory')
}

export function requireIdentifier(value: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new Error('This link contains an invalid identifier. Return to the protocol library and try again.')
  return value
}

/** URL facts are applied once at initialization, never again over user edits. */
export function createQuickStart(params = new URLSearchParams(), inventory?: InventoryItem, today = localCalendarDate()): QuickStartDraft {
  const matchingInventory = inventory && (!params.get('name') || normalizeCompoundName(canonicalCompoundName(params.get('name')!)) === normalizeCompoundName(canonicalCompoundName(inventory.item_name)))
  let compound = matchingInventory ? selectInventory(newCompound(), inventory!) : newCompound()
  const values: Partial<Compound> = {}
  const fields = { name: 'name', dose: 'dose', dose_unit: 'dose_unit', vial: 'vial_strength', vial_unit: 'vial_unit', water: 'bac_water_ml', syringe_scale: 'syringe_scale', route: 'route', concentration_value: 'concentration_value', concentration_unit: 'concentration_unit', reconstitution_date: 'reconstitution_date' } as const
  for (const [parameter, field] of Object.entries(fields)) if (params.has(parameter)) Object.assign(values, { [field]: params.get(parameter) || '' })
  if (values.name) values.name = canonicalCompoundName(values.name)
  if (params.has('water') || params.has('vial')) { values.preparation = 'mixing'; values.isPreMixed = false }
  if (params.has('concentration_value')) { values.preparation = 'ready'; values.isPreMixed = true }
  compound = applyDefaults(compound, values, 'handoff')
  const timing = params.get('timing')
  const startDate = timing === 'planned' ? '' : params.has('start_date') ? params.get('start_date')! : params.has('date') ? params.get('date')! : today
  return { startDate, compounds: [withSingleUnit(compound)] }
}

export function quickStartDates(startDate: string, today = localCalendarDate()) {
  return protocolSaveDates({ mode: 'create', planned: !startDate, startDate, today })
}

export type QuickStartIssue = { index: number; field: keyof Compound | 'startDate'; message: string }
const positive = (value: string) => value.trim() !== '' && Number.isFinite(Number(value)) && Number(value) > 0

/** Creation-only completeness policy. Historical editing still uses the shared permissive adapter. */
export function quickStartIssue({ compounds, startDate }: QuickStartDraft): QuickStartIssue | null {
  return quickStartIssues({ compounds, startDate })[0] ?? null
}

export function quickStartIssues({ compounds, startDate }: QuickStartDraft): QuickStartIssue[] {
  const issues: QuickStartIssue[] = []
  if (!compounds.length) issues.push({ index: 0, field: 'name', message: 'Choose a compound to continue' })
  for (const [index, c] of compounds.entries()) {
    const issue = (field: QuickStartIssue['field'], message: string) => { issues.push({ index, field, message }) }
    const nameError = compoundNameError(c.name)
    if (nameError) issue('name', nameError)
    if (c.route === 'Oral' && ['syringe', 'volume'].includes(c.input_mode)) {
      issue('input_mode', 'For an oral entry, record a medication dose')
    } else if (c.input_mode === 'medication') {
      if (!positive(c.dose)) issue('dose', 'Enter a dose greater than zero')
      if (!['mg', 'mcg', 'IU'].includes(c.dose_unit)) issue('dose_unit', 'Choose a unit to continue')
    } else if (c.input_mode === 'syringe') {
      if (!positive(c.syringe_markings)) issue('syringe_markings', 'Enter the syringe marking you draw to')
      if (!['100', '40'].includes(c.syringe_scale)) issue('syringe_scale', 'Choose the scale printed on your syringe')
    } else if (c.input_mode === 'volume') {
      if (!positive(c.injection_volume)) issue('injection_volume', 'Enter an injection volume greater than zero in mL')
    } else issue('input_mode', 'Choose how your dose is measured to continue')
    try { interpretEntry(entryFromForm(c)) } catch { issue('input_mode', 'Check your entered dose and preparation amounts. Use finite, non-negative numbers.') }
    if (!['SubQ', 'IM', 'Oral', 'Other'].includes(c.route)) issue('route', 'Choose how you take it')
    if (c.frequency_mode === 'rolling') {
      if (!/^[1-7]$/.test(c.cycle_days)) issue('cycle_days', 'Choose an interval from 1 to 7 days')
    } else {
      const count = c.frequencyChoice === 'weekly' ? 1 : c.frequencyChoice === '2x' ? 2 : c.frequencyChoice === '3x' ? 3 : c.frequencyChoice === 'daily' ? 7 : null
      if (!c.days_of_week.length) issue('days_of_week', 'Choose a frequency and the days you use it')
      else if (new Set(c.days_of_week).size !== c.days_of_week.length || c.days_of_week.some(day => !Number.isInteger(day) || day < 0 || day > 6)) issue('days_of_week', 'Choose valid days')
      else if (count && c.days_of_week.length !== count) issue('days_of_week', `Choose ${count} ${count === 1 ? 'day' : 'days'}`)
    }
    if ((c.durationSet || c.duration_weeks) && (!positive(c.duration_weeks) || !Number.isSafeInteger(Number(c.duration_weeks)))) issue('duration_weeks', 'Enter the number of weeks you will run this protocol')
    if (c.reconstitution_date && !isCalendarDate(c.reconstitution_date)) issue('reconstitution_date', 'Choose a valid mixing date')
    if (c.vials_in_stock && (!Number.isSafeInteger(Number(c.vials_in_stock)) || Number(c.vials_in_stock) < 0)) issue('vials_in_stock', 'Enter a whole number of vials, zero or more')
  }
  if (startDate && !isCalendarDate(startDate)) issues.push({ index: 0, field: 'startDate', message: 'Choose a valid start date' })
  return issues
}

type SavedPhase = { start_week: number; end_week?: number | null; frequency?: string; days_of_week?: number[]; time_of_day?: string; route?: string; dosing_entry?: DosingEntry | null; dose?: number | null; dose_unit?: string | null; dose_semantics_version?: number | null }
export type PreviousProtocol = { start_date?: string | null; created_at?: string; compounds?: { name: string; phases?: SavedPhase[] }[] }
export type PreviousSetup = { name: string; lastUsed: string; values: Partial<Compound> }
export function recentSetups(protocols: PreviousProtocol[]): PreviousSetup[] {
  const result: PreviousSetup[] = [], seen = new Set<string>()
  for (const protocol of [...protocols].sort((a, b) => (b.created_at || b.start_date || '').localeCompare(a.created_at || a.start_date || ''))) for (const compound of protocol.compounds || []) {
    const name = canonicalCompoundName(compound.name), key = normalizeCompoundName(name)
    if (seen.has(key)) continue
    seen.add(key)
    const phase = [...(compound.phases || [])].sort((a, b) => b.start_week - a.start_week)[0]
    if (!phase) { result.push({ name, lastUsed: protocol.start_date || '', values: {} }); continue }
    const entry = entryFormState(phase), rolling = phase.frequency?.match(/^every([1-7])days$/)
    // Previous setup is offered, never applied automatically. Stock and mixing dates
    // describe a particular supply, so they are deliberately excluded.
    const values: Partial<Compound> = { ...entry, days_of_week: phase.frequency === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : phase.days_of_week || [],
      frequency_mode: rolling ? 'rolling' : 'weekly', cycle_days: rolling?.[1] || '', time_of_day: phase.time_of_day ? phase.time_of_day[0].toUpperCase() + phase.time_of_day.slice(1) : '', route: phase.route || '' }
    result.push({ name, lastUsed: protocol.start_date || protocol.created_at?.slice(0, 10) || '', values })
  }
  return result
}

export function acceptPreviousSetup(current: Compound, setup: PreviousSetup) {
  if (normalizeCompoundName(canonicalCompoundName(current.name)) !== normalizeCompoundName(setup.name)) return current
  const values = { ...setup.values }
  // A dose and its unit/meaning travel together. Never combine an old dose with
  // a newly entered unit or turn an explicit medication dose into syringe markings.
  const dosing = ['dose', 'dose_unit', 'input_mode', 'injection_volume', 'syringe_markings', 'syringe_scale', 'reviewed', 'legacy_value'] as const
  const preparation = ['isPreMixed', 'vial_strength', 'vial_unit', 'bac_water_ml', 'concentration_value', 'concentration_unit', 'vial_label'] as const
  const schedule = ['frequency_mode', 'cycle_days', 'days_of_week', 'time_of_day'] as const
  for (const group of [dosing, preparation, schedule]) if (group.some(key => current.origins?.[key] && current.origins[key] !== 'previous')) for (const key of group) delete values[key]
  return applyDefaults(current, values, 'previous')
}

export function setPreparation(current: Compound, value: 'ready' | 'mixing' | 'unknown'): Compound {
  return { ...current, preparation: value, isPreMixed: value === 'ready', origins: { ...current.origins, preparation: 'session', isPreMixed: 'session' } }
}

export function setFrequency(current: Compound, choice: NonNullable<Compound['frequencyChoice']>): Compound {
  return { ...current, frequencyChoice: choice, frequency_mode: 'weekly', days_of_week: choice === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : [], cycle_days: '',
    origins: { ...current.origins, frequency_mode: 'session', days_of_week: 'session', cycle_days: 'session' } }
}

export function toggleQuickWeekday(current: Compound, day: number): Compound {
  const limit = current.frequencyChoice === 'weekly' ? 1 : current.frequencyChoice === '2x' ? 2 : current.frequencyChoice === '3x' ? 3 : 7
  const days = current.days_of_week.includes(day) ? current.days_of_week.filter(value => value !== day) : [...current.days_of_week, day].slice(-limit)
  return { ...current, days_of_week: days, origins: { ...current.origins, days_of_week: 'session' } }
}

export function setupSummary(c: Compound) {
  let dose = 'Dose not confirmed'
  try { dose = dosingDisplay({ dosing_entry: entryFromForm(c) }).primary } catch { /* Inline validation on save. */ }
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const frequency = c.frequency_mode === 'rolling' && c.cycle_days ? `Every ${c.cycle_days} days` : c.days_of_week.length === 7 ? 'Daily' : c.days_of_week.length ? `${c.days_of_week.length === 1 ? 'Weekly' : `${c.days_of_week.length}x/week`} on ${c.days_of_week.map(day => days[day]).join(', ')}` : 'Schedule not selected'
  return `${dose} · ${frequency} · ${c.route || 'Route not selected'}`
}
