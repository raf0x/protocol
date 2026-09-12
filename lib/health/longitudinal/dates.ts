import { validDate } from '../dosingEntry'

export function day(value: string | null | undefined): string | null {
  const key = value?.slice(0, 10)
  return key && validDate(key) && !key.startsWith('0000') ? key : null
}
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000)
export function addDays(date: string, count: number): string {
  return new Date(Date.parse(date) + count * 86400000).toISOString().slice(0, 10)
}
export function weekDate(start: string | null, week: number | null): string | null {
  return day(start) && week != null && Number.isInteger(week) && week > 0 && week <= 5200 ? addDays(day(start)!, (week - 1) * 7) : null
}
export const numberLabel = (value: number) => Number(value.toPrecision(6)).toString()
