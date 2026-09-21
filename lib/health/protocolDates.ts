// Date-only values are compared as calendar strings, never parsed as UTC instants.
export function localCalendarDate(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// Server callers use the browser's timezone, never the server's UTC day.
// Older clients and cron have no timezone: use the earliest local day worldwide
// rather than claiming tomorrow's configuration has already started.
export function requestCalendarDate(timeZone: string | null, now = new Date()) {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
      const value = (type: string) => parts.find(part => part.type === type)!.value
      return `${value('year')}-${value('month')}-${value('day')}`
    } catch { /* Unknown timezone: use the conservative fallback below. */ }
  }
  return new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
}

export function protocolLifecycle(protocol: { status: string | null; start_date: string | null }, today: string) {
  if (protocol.status === 'active' && protocol.start_date && protocol.start_date > today) return 'scheduled'
  return protocol.status
}

type Dates = { planned: boolean; startDate: string; today: string } & (
  { mode: 'create' } | { mode: 'edit'; originalStartDate?: string | null; useDifferentDate: boolean; effectiveDate: string }
)
export function protocolSaveDates(input: Dates) {
  if (input.planned) return { startDate: null, effectiveDate: null }
  if (!isCalendarDate(input.startDate)) throw new Error('Choose a valid start date.')
  if (input.mode === 'create') {
    return { startDate: input.startDate, effectiveDate: input.startDate }
  }
  if (input.originalStartDate && input.originalStartDate > input.today) return { startDate: input.startDate, effectiveDate: input.startDate }
  // Hidden state is ignored. Clearing the optional override means effective today.
  const override = input.useDifferentDate ? input.effectiveDate.trim() || null : null
  const effective = override ?? input.today
  if (!isCalendarDate(effective)) throw new Error('Choose a valid effective date.')
  if (effective < input.startDate) throw new Error('Effective date cannot be before the protocol start date.')
  if (effective > input.today) throw new Error('Effective date cannot be in the future.')
  // NULL preserves "no override" through the RPC; SQL resolves local today.
  return { startDate: input.startDate, effectiveDate: override }
}
