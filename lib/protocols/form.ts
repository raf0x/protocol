import { entryFromForm, type EntryMode } from '../health/dosingEntry'
import { phaseEndWeek } from '../health/phaseLifecycle'
import { isCalendarDate } from '../health/protocolDates'
export type DefaultSource = 'previous' | 'session' | 'inventory' | 'handoff'

export type Compound = {
  origins?: Partial<Record<keyof Compound, DefaultSource>>
  preparation?: 'ready' | 'mixing' | 'unknown'
  frequencyChoice?: '' | 'daily' | 'weekly' | '2x' | '3x' | 'custom'
  manualName?: boolean
  durationSet?: boolean
  mixDateSet?: boolean
  id?: string
  phase_id?: string
  phase_start_week: string
  concentration_value: string
  concentration_unit: string
  input_mode: EntryMode
  legacy_value?: string
  injection_volume: string
  vial_label: string
  syringe_markings: string
  syringe_scale: string
  route: string
  reviewed: boolean
  phase_options?: { id: string; name: string; start_week: number; end_week: number | null }[]
  name: string
  isPreMixed: boolean
  vial_strength: string
  vial_unit: string
  bac_water_ml: string
  reconstitution_date: string
  dose: string
  dose_unit: string
  duration_weeks: string
  frequency_mode: 'weekly' | 'rolling'
  days_of_week: number[]
  cycle_days: string
  time_of_day: string
  vials_in_stock: string
  notes: string
}

export function newCompound(): Compound {
  return {
    injection_volume:'',vial_label:'',input_mode: 'medication', syringe_markings: '', name: '', phase_start_week: '1', concentration_value: '', concentration_unit: '', syringe_scale: '', route: '', reviewed: true,
    isPreMixed: false,
    vial_strength: '',
    vial_unit: '',
    bac_water_ml: '',
    reconstitution_date: '',
    dose: '',
    dose_unit: '',
    duration_weeks: '',
    frequency_mode: 'weekly',
    days_of_week: [],
    cycle_days: '',
    time_of_day: '',
    vials_in_stock: '',
    notes: '',
  }
}

export type QuickStartDraft = { startDate: string; compounds: Compound[] }

export function updateCompoundDraft<K extends keyof Compound>(compound: Compound, field: K, value: Compound[K]): Compound {
  const next = { ...compound, [field]: value, origins: { ...compound.origins, [field]: 'session' as const } }
  if (field === 'input_mode') {
    if (value === 'syringe' && !next.syringe_markings) next.syringe_markings = next.legacy_value || ''
    if (value === 'volume' && !next.injection_volume) next.injection_volume = next.legacy_value || ''
  }
  if (['dose', 'dose_unit', 'input_mode', 'syringe_markings', 'syringe_scale', 'vial_strength', 'vial_unit', 'bac_water_ml', 'concentration_value', 'concentration_unit', 'injection_volume', 'vial_label'].includes(field)) next.reviewed = false
  return next
}

export function compoundFrequency(c: Compound) {
  return c.frequency_mode === 'rolling' ? (c.cycle_days ? `every${c.cycle_days}days` : '') : c.days_of_week.length === 7 ? 'daily' : c.days_of_week.length ? `${c.days_of_week.length}x/week` : ''
}

/** The sole compound draft -> canonical RPC payload adapter, shared with editing. */
export function protocolCompoundPayload(compounds: Compound[]) {
  if (!compounds.length || compounds.some(c => !c.name.trim() || c.name.trim().length > 100)) throw new Error('Every compound needs a name of 100 characters or fewer.')
  return compounds.map(c => {
    const entry = entryFromForm(c)
    if (c.reconstitution_date && !isCalendarDate(c.reconstitution_date)) throw new Error('Enter a valid calendar date.')
    if (c.vials_in_stock && (!Number.isSafeInteger(Number(c.vials_in_stock)) || Number(c.vials_in_stock) < 0)) throw new Error('Vials in stock must be a non-negative whole number.')
    const frequency = compoundFrequency(c)
    if (frequency && !/^(daily|[1-7]x\/week|every[1-7]days)$/.test(frequency)) throw new Error('Choose a valid frequency (1–7 days).')
    if (c.days_of_week.some(day => !Number.isInteger(day) || day < 0 || day > 6) || new Set(c.days_of_week).size !== c.days_of_week.length) throw new Error('Choose valid weekdays.')
    const start = Number(c.phase_start_week)
    return { id: c.id || null, name: c.name.trim(),
      vial_strength: c.isPreMixed || !c.vial_strength ? null : Number(c.vial_strength), vial_unit: c.isPreMixed ? null : c.vial_unit,
      bac_water_ml: c.isPreMixed || !c.bac_water_ml ? null : Number(c.bac_water_ml), reconstitution_date: c.isPreMixed ? null : c.reconstitution_date || null,
      notes: c.notes.trim(), vials_in_stock: c.vials_in_stock ? Number(c.vials_in_stock) : null,
      phase: { id: c.phase_id || null, dosing_entry: entry, start_week: start, end_week: phaseEndWeek(start, c.duration_weeks),
        frequency, days_of_week: c.frequency_mode === 'weekly' ? c.days_of_week : [], day_of_week: c.frequency_mode === 'weekly' ? c.days_of_week[0] : null,
        time_of_day: c.time_of_day.toLowerCase(), route: c.route || null },
    }
  })
}

