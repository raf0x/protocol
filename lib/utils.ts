// ============================================
// PROTOCOL UTILITIES
// Shared logic used across multiple pages.
// ============================================

export function isDueToday(frequency: string, protocolStart: string, dayOfWeek: number | null, checkDateStr?: string, daysOfWeek?: number[]): boolean {
  if (!protocolStart) return false
  const start = new Date(protocolStart + 'T00:00:00')
  const today = checkDateStr ? new Date(checkDateStr + 'T00:00:00') : new Date(); today.setHours(0,0,0,0)
  const daysDiff = Math.floor((today.getTime() - start.getTime()) / 86400000)
  const todayDay = today.getDay()
  if (daysDiff < 0) return false
  // If days_of_week array is provided, use it directly
  if (daysOfWeek && daysOfWeek.length > 0) return daysOfWeek.includes(todayDay)
  if (frequency === 'daily') return true
  if (frequency === 'eod') return daysDiff % 2 === 0
  if (frequency === 'every3days') return daysDiff % 3 === 0
  if (frequency === 'every4days') return daysDiff % 4 === 0
  if (frequency === 'every5days') return daysDiff % 5 === 0
  if (frequency === '1x/week') return dayOfWeek !== null ? todayDay === dayOfWeek : daysDiff % 7 === 0
  if (frequency === '2x/week') { const d = dayOfWeek ?? 0; return todayDay === d || todayDay === (d+3)%7 }
  // For Nx/week without days_of_week set, return false � user needs to set their schedule
  // This prevents wrong days showing up from hardcoded assumptions
  if (frequency === '3x/week') return false
  if (frequency === '4x/week') return false
  if (frequency === '5x/week') return todayDay >= 1 && todayDay <= 5 // weekdays is safe assumption
  if (frequency === '6x/week') return todayDay !== 0 // every day except sunday is safe
  return false
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDateLong(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getDaysIn(startDate: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(startDate + 'T00:00:00').getTime()) / 86400000))
}

export function getCurrentWeek(startDate: string): number {
  return Math.max(1, Math.floor(getDaysIn(startDate) / 7) + 1)
}

export function eventColor(type: string): string {
  const colors: Record<string, string> = {
    started: 'var(--color-green)',
    dose_change: '#f59e0b',
    compound_added: '#06b6d4',
    compound_removed: '#ff6b6b',
  }
  return colors[type] || '#6c63ff'
}
