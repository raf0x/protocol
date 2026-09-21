import type { InventoryItem } from './model'
import { isCalendarDate, localCalendarDate, protocolSaveDates } from '../health/protocolDates'

export type InventoryProtocolTiming = 'today' | 'scheduled' | 'planned'

// Only recorded, compatible facts cross this boundary. Stock remains independent.
export function inventoryProtocolFields(item: InventoryItem) {
  return {
    name: item.item_name,
    vial_strength: item.vial_strength == null ? '' : String(item.vial_strength),
    vial_unit: item.strength_unit ?? '',
    isPreMixed: item.form === 'pre-mixed vial',
    reconstitution_date: item.reconstitution_status === 'reconstituted' ? item.reconstitution_date ?? '' : '',
    dose: '', dose_unit: '', bac_water_ml: '', route: '', duration_weeks: '',
    injection_volume: '', syringe_markings: '', syringe_scale: '', vials_in_stock: '',
    days_of_week: [] as number[], cycle_days: '', time_of_day: '',
  }
}

export function inventoryProtocolDates(timing: InventoryProtocolTiming, date: string, today = localCalendarDate()) {
  if (timing === 'scheduled') {
    if (!isCalendarDate(date)) throw new Error('Choose a valid future start date.')
    if (date <= today) throw new Error('Choose a start date after today.')
  }
  return protocolSaveDates({ mode: 'create', planned: timing === 'planned',
    startDate: timing === 'today' ? today : date, today })
}
