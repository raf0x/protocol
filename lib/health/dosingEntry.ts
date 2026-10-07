// User entries are authoritative; calculated equivalents are advisory, never guesses.
export type EntryMode = 'medication' | 'syringe' | 'volume' | 'unknown'
export type DosingEntry = {
  is_premixed?: boolean; preparation?: 'ready' | 'mixing' | 'unknown'; version: 2; mode: EntryMode; review_status: 'unverified' | 'confirmed'
  dose: string; dose_unit: string; syringe_markings: string; syringe_scale: string
  injection_volume: string; vial_strength: string; vial_unit: string; bac_water_ml: string
  concentration_value: string; concentration_unit: string; vial_label: string
}

const medicationUnits = ['mg', 'mcg', 'IU'] as const
const concentrationUnits = ['mg/mL', 'mcg/mL', 'IU/mL'] as const
const supportedSyringeScales = ['100', '40'] as const
const numericFields = ['dose', 'syringe_markings', 'syringe_scale', 'injection_volume', 'vial_strength', 'bac_water_ml', 'concentration_value'] as const

export function validateEntry(entry: DosingEntry, options: { allowUnsupportedSyringeScale?: boolean } = {}) {
  if (entry.version !== 2 || !['medication', 'syringe', 'volume', 'unknown'].includes(entry.mode)) throw new Error('Invalid dosing entry mode.')
  if (!['confirmed', 'unverified'].includes(entry.review_status)) throw new Error('Invalid dosing review status.')
  for (const key of numericFields) {
    const value = entry[key]
    if (typeof value !== 'string') throw new Error(`${key}: enter a number or leave blank.`)
    if (!value.trim()) continue
    const number = Number(value)
    if (!Number.isFinite(number) || number < 0 || (key === 'syringe_scale' && number === 0)) throw new Error(`${key}: enter a valid non-negative number${key === 'syringe_scale' ? ' with a positive scale' : ''}.`)
  }
  if (entry.syringe_scale.trim() && !supportedSyringeScales.includes(entry.syringe_scale.trim() as typeof supportedSyringeScales[number]) && !options.allowUnsupportedSyringeScale) {
    throw new Error('syringe_scale: choose U-100 or U-40.')
  }
}

export function entryFromForm(form: Record<string, unknown>): DosingEntry {
  const str = (key: string) => typeof form[key] === 'string' ? form[key] as string : ''
  const premixed = typeof form.isPreMixed === 'boolean' ? form.isPreMixed : typeof form.is_premixed === 'boolean' ? form.is_premixed : undefined
  const preparation = ['ready', 'mixing', 'unknown'].includes(str('preparation')) ? str('preparation') as DosingEntry['preparation'] : premixed === true ? 'ready' : premixed === false ? 'mixing' : undefined
  // Editable drafts use `reviewed` as the sole current confirmation state. A
  // hydrated historical review_status may describe the prior save, but it must
  // not override an explicit uncheck or an edit that invalidated confirmation.
  const reviewed = typeof form.reviewed === 'boolean' ? form.reviewed : form.review_status === 'confirmed'
  const entry: DosingEntry = {
    ...(premixed === undefined ? {} : { is_premixed: premixed }),
    ...(preparation === undefined ? {} : { preparation }),
    version: 2,
    mode: (str('input_mode') || str('mode') || 'unknown') as EntryMode,
    review_status: reviewed ? 'confirmed' : 'unverified',
    dose: str('dose'), dose_unit: str('dose_unit'), syringe_markings: str('syringe_markings'), syringe_scale: str('syringe_scale'),
    injection_volume: str('injection_volume'), vial_strength: str('vial_strength'), vial_unit: str('vial_unit'), bac_water_ml: str('bac_water_ml'),
    concentration_value: str('concentration_value'), concentration_unit: str('concentration_unit'), vial_label: str('vial_label'),
  }
  // Historical unsupported scales remain round-trippable, but new unsupported values are invalid.
  validateEntry(entry, { allowUnsupportedSyringeScale: form.preserveSyringeScale === true && form.preservedSyringeScale === entry.syringe_scale })
  return entry
}

const numeric = (value: string) => value.trim() ? Number(value) : null
const closeEnough = (a: number, b: number) => Math.abs(a - b) <= Math.max(1e-12, Math.max(Math.abs(a), Math.abs(b)) * 1e-9)

export function interpretEntry(entry: DosingEntry) {
  // Stored historical entries may contain an unsupported scale. Preserve it, warn, and decline calculation.
  validateEntry(entry, { allowUnsupportedSyringeScale: true })
  const warnings: string[] = []
  const warn = (message: string) => { if (!warnings.includes(message)) warnings.push(message) }
  const finiteResult = (value: number) => {
    if (Number.isFinite(value)) return value
    warn('A derived value was too large to calculate reliably. Your entered values are preserved.')
    return null
  }

  const cv = numeric(entry.concentration_value), vial = numeric(entry.vial_strength), water = numeric(entry.bac_water_ml)
  const hasLabel = cv !== null || Boolean(entry.concentration_unit)
  const hasMix = vial !== null || water !== null || Boolean(entry.vial_unit)
  const labelComplete = cv !== null && cv > 0 && concentrationUnits.includes(entry.concentration_unit as typeof concentrationUnits[number])
  const mixedValue = vial !== null && vial > 0 && water !== null && water > 0 && medicationUnits.includes(entry.vial_unit as typeof medicationUnits[number]) ? finiteResult(vial / water) : null
  const labelled = labelComplete ? { value: cv!, unit: entry.concentration_unit.slice(0, -3) } : null
  const mixed = mixedValue !== null ? { value: mixedValue, unit: entry.vial_unit } : null
  let concentration: { value: number; unit: string } | null = null
  let semanticsUnverified = false
  let hasConflict = false

  const preparation = entry.preparation ?? (entry.is_premixed === true ? 'ready' : entry.is_premixed === false ? 'mixing' : undefined)
  if (preparation === 'ready') {
    concentration = labelled
    if (hasMix) warn('Saved mixing details conflict with the selected ready-to-use preparation. They are preserved but not used for calculation.')
    if (!labelled) warn('Add the complete labelled concentration to calculate equivalents.')
  } else if (preparation === 'mixing') {
    concentration = mixed
    if (hasLabel) warn('Saved labelled concentration conflicts with the selected mixing preparation. It is preserved but not used for calculation.')
    if (!mixed) warn('Add vial strength and reconstitution volume to calculate equivalents.')
  } else if (preparation === 'unknown') {
    warn('Preparation is unconfirmed. Saved preparation facts are preserved but not used for calculation.')
    semanticsUnverified = true
  } else if (hasLabel && hasMix) {
    warn('Choose which preparation information applies before calculating; both saved preparations are preserved.')
    semanticsUnverified = true
  } else if (hasLabel) {
    concentration = labelled
    if (!labelled) warn('Add the complete labelled concentration to calculate equivalents.')
  } else if (hasMix) {
    concentration = mixed
    if (!mixed) warn('Add vial strength and reconstitution volume to calculate equivalents.')
  } else {
    warn('Add vial strength and reconstitution volume, or labelled concentration, to calculate equivalents.')
  }

  let medication: { value: number; unit: string } | null = null
  let calculationVolume: number | null = null
  let calculationBlocked = false
  const scale = numeric(entry.syringe_scale)
  const scaleSupported = scale === 100 || scale === 40
  if (scale !== null && !scaleSupported) {
    warn(`Unsupported syringe scale U-${entry.syringe_scale}; calculation is unavailable until the scale is confirmed as U-100 or U-40.`)
    semanticsUnverified = true
  }

  const enteredDose = numeric(entry.dose)
  if (entry.mode === 'medication' && enteredDose !== null && medicationUnits.includes(entry.dose_unit as typeof medicationUnits[number])) {
    medication = { value: enteredDose, unit: entry.dose_unit }
  }

  const enteredVolume = numeric(entry.injection_volume)
  const enteredMarkings = numeric(entry.syringe_markings)
  const markingsVolume = enteredMarkings !== null && scaleSupported ? finiteResult(enteredMarkings / scale!) : null
  let volume = enteredVolume ?? markingsVolume
  let markings = enteredMarkings
  if (enteredMarkings !== null && scale === null) warn('Add your syringe scale to calculate liquid volume.')
  if (enteredVolume !== null && markingsVolume !== null && !closeEnough(enteredVolume, markingsVolume)) {
    warn('Entered syringe markings and injection volume conflict. Both are preserved; confirm the administration details.')
    semanticsUnverified = true
    hasConflict = true
  }

  if (entry.mode === 'volume') calculationVolume = enteredVolume
  if (entry.mode === 'syringe') {
    calculationVolume = markingsVolume
  }
  if (entry.mode === 'unknown') {
    calculationVolume = enteredVolume ?? markingsVolume
    calculationBlocked = enteredVolume !== null && markingsVolume !== null && !closeEnough(enteredVolume, markingsVolume)
    warn('Unverified dose semantics')
  }

  if (calculationBlocked) calculationVolume = null
  if (medication && concentration) {
    if ((medication.unit === 'IU') !== (concentration.unit === 'IU')) {
      warn('Medication and concentration units differ. Both entries are saved; no IU-to-mass conversion was made.')
    } else {
      const converted = medication.value * (medication.unit === concentration.unit ? 1 : medication.unit === 'mg' ? 1000 : .001)
      const derived = finiteResult(converted / concentration.value)
      if (derived !== null) {
        if (enteredVolume !== null && !closeEnough(enteredVolume, derived)) {
          warn('Entered medication dose and injection volume disagree. Both are preserved; confirm the administration details.')
          semanticsUnverified = true
          hasConflict = true
        }
        if (markingsVolume !== null && !closeEnough(markingsVolume, derived)) {
          warn('Entered medication dose and syringe markings disagree. Both are preserved; confirm the administration details.')
          semanticsUnverified = true
          hasConflict = true
        }
        if (volume === null) volume = derived
        calculationVolume = derived
      }
    }
  }

  const candidateValue = calculationVolume !== null && concentration ? finiteResult(calculationVolume * concentration.value) : null
  const candidate = candidateValue === null || !concentration ? null : { value: candidateValue, unit: concentration.unit }
  if (!medication && candidate && (entry.mode !== 'unknown' || entry.review_status === 'confirmed')) medication = candidate
  if (volume !== null && scaleSupported && markings === null) markings = finiteResult(volume * scale!)
  if (!medication) warn('Medication dose not calculated.')

  const unverified = semanticsUnverified || (entry.mode === 'unknown' && entry.review_status !== 'confirmed')
  return { medication, volume, markings, scale, concentration, candidate, warnings, hasConflict, status: unverified ? 'unverified' : warnings.length ? 'incomplete' : 'calculated' }
}

type PhaseEntry = {
  dosing_entry?: DosingEntry | null; dose?: number | string | null; dose_unit?: string | null; dose_semantics_version?: number | null
  syringe_scale?: number | null; injection_volume_ml?: number | null; syringe_units?: number | null
}

export function entryFormState(phase?: PhaseEntry, preparation: Record<string, unknown> = {}) {
  const e = phase?.dosing_entry
  if (e) {
    const { review_status: historicalReviewStatus, mode, ...raw } = e
    return {
    ...raw, isPreMixed: e.preparation ? e.preparation === 'ready' : e.is_premixed === true, preparation: e.preparation ?? (e.is_premixed === true ? 'ready' : e.is_premixed === false ? 'mixing' : undefined), input_mode: mode, reviewed: historicalReviewStatus === 'confirmed',
    legacy_value: e.mode === 'unknown' ? e.dose : '', preserveSyringeScale: true, preservedSyringeScale: e.syringe_scale,
  }
  }
  const text = (value: unknown) => value === null || value === undefined ? '' : String(value)
  const fallback = (key: string) => text(preparation[key])
  const fallbackPreparation = ['ready', 'mixing', 'unknown'].includes(text(preparation.preparation)) ? text(preparation.preparation) as DosingEntry['preparation'] : undefined
  return {
    isPreMixed: preparation.isPreMixed === true, preparation: fallbackPreparation,
    input_mode: phase && phase.dose_semantics_version !== 1 ? 'unknown' as const : 'medication' as const,
    dose: text(phase?.dose), dose_unit: text(phase?.dose_unit),
    syringe_markings: text(phase?.syringe_units), syringe_scale: text(phase?.syringe_scale), injection_volume: text(phase?.injection_volume_ml),
    vial_strength: fallback('vial_strength'), vial_unit: fallback('vial_unit'), bac_water_ml: fallback('bac_water_ml'),
    concentration_value: fallback('concentration_value'), concentration_unit: fallback('concentration_unit'), vial_label: fallback('vial_label'),
    reviewed: phase?.dose_semantics_version === 1, legacy_value: text(phase?.dose), preserveSyringeScale: Boolean(phase), preservedSyringeScale: text(phase?.syringe_scale),
  }
}

type ProtocolNumberKind = 'dose' | 'syringe' | 'volume' | 'percent' | 'count' | 'fractionalCount'
const protocolDecimals = [0, 1, 2].map(maximumFractionDigits => new Intl.NumberFormat('en-US', { useGrouping: false, maximumFractionDigits }))
/** Display only: callers retain the original value for calculations and persistence. */
export function formatProtocolNumber(value: unknown, kind: ProtocolNumberKind = 'dose'): string | null {
  if ((typeof value !== 'number' && typeof value !== 'string') || (typeof value === 'string' && !value.trim())) return null
  const number = Number(value)
  if (!Number.isFinite(number)) return null
  const digits = kind === 'count' ? 0 : kind === 'dose' ? 2 : kind === 'volume' && Math.abs(number) < 1 ? 2 : 1
  let text = protocolDecimals[digits].format(number)
  if (number !== 0 && Number(text) === 0) {
    const needed = Math.min(8, Math.max(digits, Math.ceil(-Math.log10(Math.abs(number))) + 1))
    text = new Intl.NumberFormat('en-US', { useGrouping: false, maximumFractionDigits: needed }).format(number)
    if (Number(text) === 0) text = number.toExponential(2)
  }
  return text === '-0' ? '0' : text
}
export function formatProtocolAmount(value: unknown, unit: string | null | undefined, kind: ProtocolNumberKind = 'dose'): string | null {
  const text = formatProtocolNumber(value, kind), label = unit?.trim()
  return text !== null && label && !/^(?:undefined|null|NaN|--|—)$/i.test(label) ? `${text} ${label}` : null
}
export function formatProtocolPercent(value: unknown): string | null {
  const text = formatProtocolNumber(value, 'percent')
  return text === null ? null : `${text}%`
}

export function dosingDisplay(phase?: PhaseEntry | null) {
  if (!phase) return { primary: 'Dose not entered', secondary: 'No current phase', medication: null }
  if (phase.dosing_entry) {
    try {
      const result = interpretEntry(phase.dosing_entry)
      const details = [
        formatProtocolAmount(result.markings, result.scale ? `U-${result.scale} units` : 'syringe units', 'syringe'),
        formatProtocolAmount(result.volume, 'mL', 'volume'),
      ].filter((value): value is string => Boolean(value))
      const medication = result.medication ? formatProtocolAmount(result.medication.value, result.medication.unit) : null
      const unresolved = result.status === 'unverified' ? 'Unverified dose semantics' : null
      const primary = medication ? [medication, unresolved].filter(Boolean).join(' · ') : [...details, 'Medication dose not calculated.', unresolved].filter(Boolean).join(' · ')
      return { primary, secondary: result.warnings.join(' '), medication: result.medication }
    } catch {
      return { primary: 'Unverified dose semantics · Medication dose not calculated.', secondary: 'Check the saved dosing values.', medication: null }
    }
  }
  const amount = formatProtocolAmount(phase.dose, phase.dose_unit)
  if (phase.dose_semantics_version === 1) return amount
    ? { primary: amount, secondary: '', medication: { value: Number(phase.dose), unit: phase.dose_unit || '' } }
    : { primary: 'Dose not entered', secondary: '', medication: null }
  const admin = administrationDisplay(phase)
  const details = [admin.syringe, admin.volume].filter(Boolean)
  return { primary: [...details, 'Medication dose not calculated.', 'Unverified dose semantics'].join(' · '), secondary: `Stored value: ${amount ?? 'Not recorded'}`, medication: null }
}

export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}

export function quickEntryPayload(body: Record<string, unknown>) {
  if (typeof body.name !== 'string' || !body.name.trim() || body.name.length > 100) throw new Error('Enter a compound name.')
  const field = (key: string) => body[key] == null ? '' : String(body[key])
  const requestedMode = field('input_mode') || field('mode')
  const mode = (requestedMode || 'medication') as EntryMode
  const explicitScale = field('syringe_scale')
  const entry = entryFromForm({
    input_mode: mode,
    dose: field('dose'), dose_unit: field('dose_unit'),
    syringe_markings: field('syringe_markings'), syringe_scale: mode === 'syringe' && !explicitScale ? '100' : explicitScale,
    injection_volume: field('injection_volume'), vial_label: field('vial_label'),
    vial_strength: field('vial_strength') || field('vial'), vial_unit: field('vial_unit'), bac_water_ml: field('bac_water_ml') || field('water'),
    concentration_value: field('concentration_value'), concentration_unit: field('concentration_unit'),
    preparation: field('preparation'),
    isPreMixed: typeof body.isPreMixed === 'boolean' ? body.isPreMixed : body.is_premixed,
    // API review_status is historical metadata only. Current confirmation must
    // be an explicit reviewed=true from this request.
    reviewed: body.reviewed === true,
  })
  const frequency = body.frequency ?? ''
  if (typeof frequency !== 'string' || (frequency && !/^(daily|[1-7]x\/week|every[1-7]days)$/.test(frequency))) throw new Error('Invalid frequency.')
  if (typeof body.date !== 'string' || !validDate(body.date)) throw new Error('Invalid date.')
  return { name: body.name.trim(), date: body.date, compounds: [{ name: body.name.trim(), phase: { name: 'Phase 1', dosing_entry: entry, start_week: 1, end_week: null, frequency } }] }
}

export function administrationForPhase(phase?: PhaseEntry | null) {
  if (phase?.dosing_entry) {
    try { const result = interpretEntry(phase.dosing_entry); return { volume: result.volume, markings: result.markings } }
    catch { return { volume: null, markings: null } }
  }
  return { volume: phase?.injection_volume_ml ?? null, markings: phase?.syringe_units ?? null }
}

/** Separate labeled measurements; a syringe draw needs its recorded scale for conversion, not for preservation. */
export function administrationDisplay(phase?: PhaseEntry | null) {
  const administration = administrationForPhase(phase)
  const rawScale = phase?.dosing_entry ? phase.dosing_entry.syringe_scale : phase?.syringe_scale
  const scale = Number(rawScale)
  const scaleLabel = Number.isFinite(scale) && scale > 0 ? `U-${rawScale} units` : 'syringe units'
  return {
    volume: formatProtocolAmount(administration.volume, 'mL', 'volume'),
    syringe: formatProtocolAmount(administration.markings, scaleLabel, 'syringe'),
  }
}
