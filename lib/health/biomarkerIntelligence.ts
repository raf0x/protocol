import type { BiomarkerHistory, LabObservation, LabPanel, LabResult, LabStatus } from './labs'

export const biomarkerCategories = ['Hormones', 'Metabolic', 'Lipids', 'CBC / Blood', 'Liver', 'Kidney', 'Thyroid', 'Inflammation', 'Nutrients', 'Growth Factors', 'Other'] as const
export type BiomarkerCategory = typeof biomarkerCategories[number]

type MarkerDefinition = { key: string; category: BiomarkerCategory; aliases: string[] }

export function normalizeBiomarkerName(name: string) {
  return name.normalize('NFKD').toLowerCase().replace(/[β]/g, 'beta').replace(/[α]/g, 'alpha')
    .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

const definitions: MarkerDefinition[] = [
  { key: 'testosterone-total', category: 'Hormones', aliases: ['total testosterone', 'testosterone total', 'testosterone, total'] },
  { key: 'testosterone-free', category: 'Hormones', aliases: ['free testosterone', 'testosterone free', 'testosterone, free'] },
  { key: 'estradiol', category: 'Hormones', aliases: ['estradiol', 'e2'] },
  { key: 'estradiol-sensitive', category: 'Hormones', aliases: ['sensitive estradiol', 'estradiol sensitive', 'estradiol, sensitive', 'estradiol ultrasensitive'] },
  { key: 'dht', category: 'Hormones', aliases: ['dht', 'dihydrotestosterone'] },
  { key: 'shbg', category: 'Hormones', aliases: ['shbg', 'sex hormone binding globulin'] },
  { key: 'lh', category: 'Hormones', aliases: ['lh', 'luteinizing hormone'] },
  { key: 'fsh', category: 'Hormones', aliases: ['fsh', 'follicle stimulating hormone'] },
  { key: 'prolactin', category: 'Hormones', aliases: ['prolactin'] },
  { key: 'cortisol', category: 'Hormones', aliases: ['cortisol'] },
  { key: 'glucose', category: 'Metabolic', aliases: ['glucose', 'fasting glucose', 'glucose fasting'] },
  { key: 'insulin', category: 'Metabolic', aliases: ['insulin', 'fasting insulin', 'insulin fasting'] },
  { key: 'hba1c', category: 'Metabolic', aliases: ['hba1c', 'hemoglobin a1c', 'a1c'] },
  { key: 'cholesterol-total', category: 'Lipids', aliases: ['total cholesterol', 'cholesterol total'] },
  { key: 'ldl-c', category: 'Lipids', aliases: ['ldl c', 'ldl cholesterol', 'calculated ldl'] },
  { key: 'ldl-p', category: 'Lipids', aliases: ['ldl p', 'ldl particle number', 'ldl particles'] },
  { key: 'hdl-c', category: 'Lipids', aliases: ['hdl c', 'hdl cholesterol'] },
  { key: 'triglycerides', category: 'Lipids', aliases: ['triglycerides'] },
  { key: 'apob', category: 'Lipids', aliases: ['apob', 'apo b', 'apolipoprotein b'] },
  { key: 'lpa', category: 'Lipids', aliases: ['lp a', 'lipoprotein a'] },
  { key: 'hematocrit', category: 'CBC / Blood', aliases: ['hematocrit', 'hct'] },
  { key: 'hemoglobin', category: 'CBC / Blood', aliases: ['hemoglobin', 'hgb'] },
  { key: 'rbc', category: 'CBC / Blood', aliases: ['rbc', 'red blood cell count'] },
  { key: 'wbc', category: 'CBC / Blood', aliases: ['wbc', 'white blood cell count'] },
  { key: 'platelets', category: 'CBC / Blood', aliases: ['platelets', 'platelet count'] },
  ...['mcv', 'mch', 'mchc', 'rdw'].map(key => ({ key, category: 'CBC / Blood' as const, aliases: [key] })),
  { key: 'alt', category: 'Liver', aliases: ['alt', 'alanine aminotransferase'] },
  { key: 'ast', category: 'Liver', aliases: ['ast', 'aspartate aminotransferase'] },
  { key: 'alp', category: 'Liver', aliases: ['alp', 'alkaline phosphatase'] },
  { key: 'ggt', category: 'Liver', aliases: ['ggt', 'gamma glutamyl transferase'] },
  { key: 'bilirubin-total', category: 'Liver', aliases: ['bilirubin', 'total bilirubin', 'bilirubin total'] },
  { key: 'creatinine', category: 'Kidney', aliases: ['creatinine'] },
  { key: 'egfr', category: 'Kidney', aliases: ['egfr', 'estimated glomerular filtration rate'] },
  { key: 'bun', category: 'Kidney', aliases: ['bun', 'blood urea nitrogen'] },
  { key: 'cystatin-c', category: 'Kidney', aliases: ['cystatin c'] },
  { key: 'tsh', category: 'Thyroid', aliases: ['tsh', 'thyroid stimulating hormone'] },
  { key: 't3-free', category: 'Thyroid', aliases: ['free t3', 't3 free'] },
  { key: 't4-free', category: 'Thyroid', aliases: ['free t4', 't4 free'] },
  { key: 'crp', category: 'Inflammation', aliases: ['crp', 'c reactive protein'] },
  { key: 'hs-crp', category: 'Inflammation', aliases: ['hs crp', 'high sensitivity crp', 'high sensitivity c reactive protein'] },
  { key: 'esr', category: 'Inflammation', aliases: ['esr', 'erythrocyte sedimentation rate'] },
  { key: 'vitamin-d', category: 'Nutrients', aliases: ['vitamin d', '25 hydroxy vitamin d', 'vitamin d 25 hydroxy'] },
  { key: 'vitamin-b12', category: 'Nutrients', aliases: ['vitamin b12', 'b12'] },
  { key: 'folate', category: 'Nutrients', aliases: ['folate'] },
  { key: 'ferritin', category: 'Nutrients', aliases: ['ferritin'] },
  { key: 'iron', category: 'Nutrients', aliases: ['iron'] },
  { key: 'magnesium', category: 'Nutrients', aliases: ['magnesium'] },
  { key: 'igf-1', category: 'Growth Factors', aliases: ['igf 1', 'insulin like growth factor 1'] },
  { key: 'growth-hormone', category: 'Growth Factors', aliases: ['growth hormone', 'human growth hormone'] },
]

const markerLookup = new Map(definitions.flatMap(definition => definition.aliases.map(alias => [normalizeBiomarkerName(alias), definition] as const)))

export function classifyBiomarker(name: string): { key: string; category: BiomarkerCategory } {
  const normalized = normalizeBiomarkerName(name)
  const definition = markerLookup.get(normalized)
  return definition ? { key: definition.key, category: definition.category } : { key: `raw:${normalized}`, category: 'Other' }
}

export function statusIsFlagged(status: LabStatus) { return status === 'high' || status === 'low' || status === 'abnormal' }

export type BiomarkerComparison = {
  latest: LabObservation; previous: LabObservation; delta: number; percent: number | null; direction: 'up' | 'down' | 'unchanged'
}

/** Compare only one exact-unit series with one numeric result on each date. */
export function compareLatest(observations: LabObservation[]): BiomarkerComparison | null {
  if (observations.length < 2) return null
  const unit = observations[0]?.result.unit.trim()
  if (!unit || observations.some(item => item.result.unit.trim() !== unit)) return null
  const byDate = new Map<string, LabObservation[]>()
  for (const item of observations) {
    const values = byDate.get(item.date) ?? []; values.push(item); byDate.set(item.date, values)
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a))
  if (dates.length < 2) return null
  const latestRows = byDate.get(dates[0])!, previousRows = byDate.get(dates[1])!
  if (latestRows.length !== 1 || previousRows.length !== 1) return null
  const latest = latestRows[0], previous = previousRows[0]
  if (latest.result.value == null || previous.result.value == null || !Number.isFinite(latest.result.value) || !Number.isFinite(previous.result.value)) return null
  const delta = latest.result.value - previous.result.value
  return { latest, previous, delta, percent: previous.result.value === 0 ? null : delta / Math.abs(previous.result.value) * 100, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'unchanged' }
}

export type TrendChart = { points: { x: number; y: number }[]; range: { top: number; bottom: number } | null }
export function trendChart(observations: LabObservation[]): TrendChart {
  if (observations.length < 2 || !observations[0].result.unit.trim() || observations.some(item => item.result.unit.trim() !== observations[0].result.unit.trim() || item.result.value == null || !Number.isFinite(item.result.value))) return { points: [], range: null }
  if (new Set(observations.map(item => item.date)).size !== observations.length) return { points: [], range: null }
  const ordered = [...observations].sort((a, b) => a.date.localeCompare(b.date))
  const dates = ordered.map(item => Date.parse(`${item.date}T12:00:00Z`))
  if (dates.some(date => !Number.isFinite(date))) return { points: [], range: null }
  const sameRange = ordered.every(item => item.result.reference_low != null && item.result.reference_high != null && item.result.reference_low === ordered[0].result.reference_low && item.result.reference_high === ordered[0].result.reference_high)
  const low = sameRange ? ordered[0].result.reference_low! : null, high = sameRange ? ordered[0].result.reference_high! : null
  const values = ordered.map(item => item.result.value!)
  const scaleValues = low == null || high == null ? values : [...values, low, high]
  const min = Math.min(...scaleValues), max = Math.max(...scaleValues)
  const y = (value: number) => max === min ? 60 : 108 - (value - min) / (max - min) * 96
  const span = dates.at(-1)! - dates[0]
  const points = ordered.map((item, index) => ({ x: 12 + (span ? (dates[index] - dates[0]) / span : index / (ordered.length - 1)) * 276, y: y(item.result.value!) }))
  return { points, range: low == null || high == null ? null : { top: y(high), bottom: y(low) } }
}

export function groupPanelResults(results: LabResult[]) {
  const rank: Record<LabStatus, number> = { high: 0, low: 0, abnormal: 0, normal: 1, unknown: 2 }
  const groups = new Map<BiomarkerCategory, LabResult[]>()
  for (const result of results) {
    const category = classifyBiomarker(result.biomarker_name).category
    const group = groups.get(category) ?? []; group.push(result); groups.set(category, group)
  }
  return biomarkerCategories.filter(category => groups.has(category)).map(category => ({ category, results: groups.get(category)!.sort((a, b) => rank[a.status] - rank[b.status] || a.biomarker_name.localeCompare(b.biomarker_name) || a.id.localeCompare(b.id)) }))
}

export function labIntelligence(panels: LabPanel[], histories: BiomarkerHistory[]) {
  const latestPanel = [...panels].sort((a, b) => b.test_date.localeCompare(a.test_date) || a.id.localeCompare(b.id))[0] ?? null
  const flagged = histories.flatMap(history => history.units.map(group => ({ history, observation: group.observations[0] })))
    .filter(item => item.observation && statusIsFlagged(item.observation.result.status))
    .sort((a, b) => b.observation.date.localeCompare(a.observation.date) || a.history.name.localeCompare(b.history.name))
  const categories = biomarkerCategories.map(category => {
    const categoryHistories = histories.filter(history => history.category === category)
    return { category, biomarkerCount: categoryHistories.length, flaggedCount: flagged.filter(item => item.history.category === category).length,
      repeatCount: categoryHistories.filter(history => history.units.some(group => new Set(group.observations.map(item => item.date)).size > 1)).length }
  }).filter(item => item.biomarkerCount)
  const repeatCount = histories.filter(history => history.units.some(group => new Set(group.observations.map(item => item.date)).size > 1)).length
  return { latestPanel, latestFlaggedCount: latestPanel?.results.filter(result => statusIsFlagged(result.status)).length ?? 0, flagged, categories, repeatCount, singleReadingCount: histories.length - repeatCount }
}
