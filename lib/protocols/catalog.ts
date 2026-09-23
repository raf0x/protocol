export const compoundCategories = ['Peptides', 'GLP-1 medications', 'Hormones and TRT', 'Anabolics', 'Other medications'] as const
export type CompoundCategory = typeof compoundCategories[number]
export type CatalogCompound = { id: string; name: string; category: CompoundCategory; aliases: readonly string[]; units: readonly string[]; shortName?: string }
const item = (id: string, name: string, category: CompoundCategory, aliases: string[] = [], units = ['mg', 'mcg'], shortName?: string): CatalogCompound => ({ id, name, category, aliases, units, ...(shortName ? { shortName } : {}) })

// Identity and unit vocabulary only: this catalog contains no treatment defaults.
export const compoundCatalog: readonly CatalogCompound[] = [
  ...['BPC-157', 'TB-500', 'CJC-1295', 'Ipamorelin', 'CJC-1295 / Ipamorelin', 'GHK-Cu', 'KPV', 'GHK-Cu / KPV', 'SS-31', 'MOTS-c', 'Tesamorelin', 'Sermorelin'].map(name => item(name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, 'Peptides', name === 'CJC-1295 / Ipamorelin' ? ['CJC IPA', 'CJC Ipamorelin'] : [])),
  item('thymosin-alpha-1', 'Thymosin Alpha-1', 'Peptides', ['Thymosin alpha 1', 'Thymosin α1', 'TA-1', 'TA1']),
  // A small-molecule NNMT inhibitor, classified separately from peptides.
  // https://pmc.ncbi.nlm.nih.gov/articles/PMC5826726/
  item('5-amino-1mq', '5-Amino-1MQ', 'Other medications', ['5 amino 1mq', '5-amino-1mq', '5 Amino 1MQ', '5Amino1MQ']),
  item('tirzepatide', 'Tirzepatide', 'GLP-1 medications', ['Mounjaro', 'Zepbound']),
  item('semaglutide', 'Semaglutide', 'GLP-1 medications', ['Ozempic', 'Wegovy']),
  item('retatrutide', 'Retatrutide', 'GLP-1 medications'),
  item('liraglutide', 'Liraglutide', 'GLP-1 medications'),
  item('testosterone-cypionate', 'Testosterone cypionate', 'Hormones and TRT', ['Test C']),
  item('testosterone-enanthate', 'Testosterone enanthate', 'Hormones and TRT', ['Test E']),
  item('testosterone-propionate', 'Testosterone propionate', 'Hormones and TRT', ['Test P']),
  item('hcg', 'Human chorionic gonadotropin', 'Hormones and TRT', ['HCG'], ['IU'], 'HCG'),
  item('enclomiphene', 'Enclomiphene', 'Hormones and TRT'),
  item('anastrozole', 'Anastrozole', 'Hormones and TRT'),
  item('nandrolone-decanoate', 'Nandrolone decanoate', 'Anabolics', ['Deca']),
  item('oxandrolone', 'Oxandrolone', 'Anabolics', ['Anavar']),
  item('stanozolol', 'Stanozolol', 'Anabolics'),
  item('methenolone-enanthate', 'Methenolone enanthate', 'Anabolics', ['Primo', 'Methenolone']),
  item('boldenone-undecylenate', 'Boldenone undecylenate', 'Anabolics'),
  item('trenbolone-acetate', 'Trenbolone acetate', 'Anabolics'),
]

export function cleanCompoundName(value: string) { return value.normalize('NFC').trim().replace(/\s+/gu, ' ') }
export function normalizeCompoundName(value: string) {
  return value.normalize('NFKD').toLowerCase().replace(/α/g, 'alpha').replace(/\p{M}/gu, '').replace(/[^\p{L}\p{N}]/gu, '')
}
export function compoundNameError(value: string): string | null {
  const name = cleanCompoundName(value)
  if (!name) return 'Enter a compound name'
  if (name.length > 100) return 'Use 100 characters or fewer for the compound name'
  if (!/[\p{L}\p{N}]/u.test(name) || /[\p{Cc}\p{Cf}<>]/u.test(name)) return 'Enter a readable compound name'
  return null
}
export function resolveCompound(value: string) {
  const key = normalizeCompoundName(value)
  return key ? compoundCatalog.find(item => [item.name, ...item.aliases].some(name => normalizeCompoundName(name) === key)) : undefined
}
export function canonicalCompoundName(value: string) { return resolveCompound(value)?.name ?? cleanCompoundName(value) }
export function searchCompounds(query: string, category?: CompoundCategory) {
  const key = normalizeCompoundName(query)
  if (query.trim() && !key) return []
  const exact = resolveCompound(query)
  return compoundCatalog.filter(item => (!category || item.category === category) && [item.name, ...item.aliases].some(name => normalizeCompoundName(name).includes(key)))
    .sort((a, b) => Number(b === exact) - Number(a === exact))
}

/** Custom entry depends on exact identity, never on the number of partial matches. */
export function compoundSearch(query: string) {
  const name = cleanCompoundName(query), exact = resolveCompound(name)
  const error = name && !exact ? compoundNameError(name) : null
  return { matches: searchCompounds(name), exact, customName: name && !exact && !error ? name : null, error }
}

export const quickPickCategories = ['Peptides', 'Other'] as const
export type QuickPickCategory = typeof quickPickCategories[number]
export function compoundBrowseCategory(compound: CatalogCompound): QuickPickCategory {
  return compound.category === 'Peptides' || compound.category === 'GLP-1 medications' ? 'Peptides' : 'Other'
}
const quickPickIds: Record<QuickPickCategory, readonly string[]> = {
  Peptides: ['tirzepatide', 'semaglutide', 'retatrutide', 'bpc-157', 'ghk-cu'],
  Other: ['testosterone-cypionate', 'hcg', 'testosterone-enanthate', 'nandrolone-decanoate', 'oxandrolone'],
}
export function compoundQuickPicks(category: QuickPickCategory) {
  return quickPickIds[category].map(id => compoundCatalog.find(item => item.id === id)!)
}
