export const INVENTORY_HEADERS = ['row_type', 'item_name', 'form', 'vial_strength', 'strength_unit', 'quantity', 'acquisition_date', 'expiration_date', 'lot_number', 'reconstitution_status', 'reconstitution_date', 'notes'] as const
export const FORMS = ['lyophilized vial', 'pre-mixed vial', 'cartridge', 'other'] as const
export const UNITS = ['mg', 'mcg', 'IU'] as const
export const RECONSTITUTION = ['not reconstituted', 'reconstituted', 'not applicable', 'unknown'] as const
export const MAX_ROWS = 500
export const MAX_FILE_BYTES = 2_000_000
export const TEMPLATE_URL = '/templates/mypepprotocol-inventory.xlsx'
export type InventoryItem = {
  item_name: string; form: string; vial_strength: number | null; strength_unit: string | null; quantity: number
  acquisition_date: string | null; expiration_date: string | null; lot_number: string | null
  reconstitution_status: string; reconstitution_date: string | null; notes: string | null
}
export type SavedInventoryItem = InventoryItem & { id: string; user_id: string; created_at: string }
export type InputRow = { rowNumber: number; values: Record<string, unknown>; errors?: string[] }
export type PreviewRow = { rowNumber: number; item: InventoryItem; errors: string[]; warnings: string[]; duplicate: boolean }
export type InventoryPreview = { rows: PreviewRow[]; examples: number }
const value = (v: unknown) => v == null ? '' : String(v).trim()
const dateOK = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && s >= '1900-01-01' && s <= '9999-12-31' && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s

// Exact normalized contents only. Case, units and lot identifiers remain meaningful.
// No name-only match, quantity addition, unit conversion, or protocol stock lookup.
export function inventoryIdentity(item: InventoryItem) {
  return JSON.stringify(INVENTORY_HEADERS.filter(key => key !== 'row_type').map(key => item[key as keyof InventoryItem]))
}

export function previewInventory(input: InputRow[], existing: InventoryItem[], today: string): InventoryPreview {
  if (input.length > MAX_ROWS + 1) throw new Error(`Import at most ${MAX_ROWS} item rows at a time.`)
  const seen = new Set(existing.map(inventoryIdentity)), rows: PreviewRow[] = []
  let examples = 0
  for (const row of input) {
    const v = row.values
    if (value(v.row_type) === 'EXAMPLE') { examples++; continue }
    if (Object.values(v).every(cell => !value(cell)) && !row.errors?.length) continue
    const errors = [...(row.errors ?? [])], warnings: string[] = []
    if (value(v.row_type)) errors.push('Row type must be blank for your items (EXAMPLE rows are excluded).')
    const name = value(v.item_name), form = value(v.form) || 'other', unit = value(v.strength_unit) || null
    const quantity = Number(value(v.quantity)), strengthText = value(v.vial_strength), strength = strengthText ? Number(strengthText) : null
    if (!name || name.length > 200) errors.push('Item name is required and must be at most 200 characters.')
    if (!FORMS.includes(form as typeof FORMS[number])) errors.push(`Form must be: ${FORMS.join(', ')}.`)
    if (!/^\d+$/.test(value(v.quantity)) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1_000_000) errors.push('Quantity must be a positive whole number, at most 1000000.')
    if (strength !== null && (!/^\d+(\.\d+)?$/.test(strengthText) || !Number.isFinite(strength) || strength <= 0 || strength > 1_000_000)) errors.push('Vial strength must be a positive number, at most 1000000.')
    if (unit && !UNITS.includes(unit as typeof UNITS[number])) errors.push('Strength unit must be mg, mcg, or IU. Syringe units and mL are not strength units.')
    if ((strength !== null) !== (unit !== null)) errors.push('Provide both Vial strength and Strength unit, or leave both blank.')
    const dates = { acquisition_date: value(v.acquisition_date) || null, expiration_date: value(v.expiration_date) || null, reconstitution_date: value(v.reconstitution_date) || null }
    const dateLabels = { acquisition_date: 'Acquisition date', expiration_date: 'Expiration date', reconstitution_date: 'Reconstitution date' }
    for (const [field, date] of Object.entries(dates)) if (date && !dateOK(date)) errors.push(`${dateLabels[field as keyof typeof dateLabels]} must be a real date in YYYY-MM-DD format (1900 or later).`)
    if (dates.acquisition_date && dates.expiration_date && dates.expiration_date < dates.acquisition_date) errors.push('Expiration date cannot be before Acquisition date.')
    const status = value(v.reconstitution_status) || 'unknown'
    if (!RECONSTITUTION.includes(status as typeof RECONSTITUTION[number])) errors.push(`Reconstitution status must be: ${RECONSTITUTION.join(', ')}.`)
    if (status === 'reconstituted' && !dates.reconstitution_date) errors.push('Reconstitution date is required for a reconstituted item.')
    if (status !== 'reconstituted' && dates.reconstitution_date) errors.push('Set Reconstitution status to reconstituted when supplying a Reconstitution date.')
    if (dates.acquisition_date && dates.reconstitution_date && dates.reconstitution_date < dates.acquisition_date) errors.push('Reconstitution date cannot be before Acquisition date.')
    const lot = value(v.lot_number) || null, notes = value(v.notes) || null
    if (lot && lot.length > 100) errors.push('Lot / batch number must be at most 100 characters.')
    if (notes && notes.length > 2000) errors.push('Notes must be at most 2000 characters.')
    if (!value(v.form)) warnings.push('Form not provided; saved as other.')
    if (!value(v.reconstitution_status)) warnings.push('Reconstitution status not provided; saved as unknown.')
    if (dates.expiration_date && dateOK(dates.expiration_date) && dates.expiration_date < today) warnings.push('The recorded expiration date has passed.')
    if (dates.reconstitution_date && dates.reconstitution_date > today) warnings.push('Reconstitution date is in the future; verify it before importing.')
    const item: InventoryItem = { item_name: name, form, vial_strength: strength, strength_unit: unit, quantity, ...dates, lot_number: lot, reconstitution_status: status, notes }
    const key = inventoryIdentity(item), duplicate = !errors.length && seen.has(key)
    if (!errors.length) seen.add(key)
    rows.push({ rowNumber: row.rowNumber, item, errors, warnings, duplicate })
  }
  if (rows.length > MAX_ROWS) throw new Error(`Import at most ${MAX_ROWS} item rows at a time.`)
  return { rows, examples }
}

export function importableRows(preview: InventoryPreview) { return preview.rows.filter(row => !row.errors.length && !row.duplicate).map(row => row.item) }
