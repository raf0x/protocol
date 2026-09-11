export type WeightUnit = 'lbs' | 'kg'

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value
  if (from === 'lbs' && to === 'kg') return value * 0.453592
  if (from === 'kg' && to === 'lbs') return value * 2.20462
  return value
}

export function formatWeight(value: number, unit: WeightUnit): string {
  const decimals = unit === 'kg' ? 1 : 0
  return value.toFixed(decimals)
}

export function getWeightLabel(unit: WeightUnit): string {
  return unit === 'lbs' ? 'lbs' : 'kg'
}
