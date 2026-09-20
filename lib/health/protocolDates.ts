// Date-only values are compared as calendar strings, never parsed as UTC instants.
export function localCalendarDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}

type Dates = { planned: boolean; startDate: string; today: string } & (
  { mode: 'create' } | { mode: 'edit'; useDifferentDate: boolean; effectiveDate: string }
)
export function protocolSaveDates(input: Dates) {
  if (input.planned) return { startDate: null, effectiveDate: null }
  if (!isCalendarDate(input.startDate)) throw new Error('Choose a valid start date.')
  if (input.mode === 'create') {
    if (input.startDate > input.today) throw new Error('Start date cannot be in the future.')
    return { startDate: input.startDate, effectiveDate: input.startDate }
  }
  // Hidden state is ignored. Clearing the optional override means effective today.
  const override = input.useDifferentDate ? input.effectiveDate.trim() || null : null
  const effective = override ?? input.today
  if (!isCalendarDate(effective)) throw new Error('Choose a valid effective date.')
  if (effective < input.startDate) throw new Error('Effective date cannot be before the protocol start date.')
  if (effective > input.today) throw new Error('Effective date cannot be in the future.')
  // NULL preserves "no override" through the RPC; SQL resolves local today.
  return { startDate: input.startDate, effectiveDate: override }
}
