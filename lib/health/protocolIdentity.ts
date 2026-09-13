/** Treatment episodes are database identities, never names, dates or phases. */
export type TreatmentIdentity = Readonly<{ protocolId: string; compoundId: string | null }>
export type TreatmentScope = 'protocol' | 'compound'
export type TreatmentCompoundIndex = ReadonlyMap<string, ReadonlySet<string>>
const isId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

/** Reject malformed identity; do not coerce, trim, or repair an ID. */
export function treatmentIdentity(protocolId: unknown, compoundId: unknown = null): TreatmentIdentity | null {
  if (!isId(protocolId) || (compoundId != null && !isId(compoundId))) return null
  return { protocolId, compoundId: compoundId ?? null }
}

/** Versioned, collision-free tuple. Pass through URLSearchParams when used in a URL. */
export function treatmentIdentityKey(identity: TreatmentIdentity): string {
  return `t1:${JSON.stringify([identity.protocolId, identity.compoundId])}`
}
export function parseTreatmentIdentityKey(key: string): TreatmentIdentity | null {
  if (!key.startsWith('t1:')) return null
  try {
    const tuple: unknown = JSON.parse(key.slice(3))
    if (!Array.isArray(tuple) || tuple.length !== 2) return null
    const identity = treatmentIdentity(tuple[0], tuple[1])
    return identity && treatmentIdentityKey(identity) === key ? identity : null
  } catch { return null }
}
export function sameTreatmentIdentity(a: TreatmentIdentity, b: TreatmentIdentity): boolean {
  return a.protocolId === b.protocolId && a.compoundId === b.compoundId
}
export function treatmentScope(identity: TreatmentIdentity): TreatmentScope {
  return identity.compoundId === null ? 'protocol' : 'compound'
}

/** Build from the full supplied collection, before filtering or pagination. */
export function treatmentCompoundIndex(identities: readonly TreatmentIdentity[]): TreatmentCompoundIndex {
  const index = new Map<string, Set<string>>()
  for (const identity of identities) {
    if (identity.compoundId === null) continue
    const compounds = index.get(identity.protocolId) ?? new Set<string>()
    compounds.add(identity.compoundId)
    index.set(identity.protocolId, compounds)
  }
  return index
}

/** Contextual association only; the original event identity is never mutated. */
export function contextualTreatmentIdentity(identity: TreatmentIdentity, index: TreatmentCompoundIndex): TreatmentIdentity {
  const compounds = index.get(identity.protocolId)
  if (identity.compoundId !== null || compounds?.size !== 1) return identity
  return { protocolId: identity.protocolId, compoundId: compounds.values().next().value! }
}

/** A protocol selection covers the episode. A compound selection covers that
 * exact compound plus protocol-level context only under the sole-compound rule. */
export function matchesTreatmentIdentity(candidate: TreatmentIdentity, selected: TreatmentIdentity, index: TreatmentCompoundIndex): boolean {
  if (candidate.protocolId !== selected.protocolId) return false
  return selected.compoundId === null || sameTreatmentIdentity(contextualTreatmentIdentity(candidate, index), selected)
}

/** Shared identity grouping, with no display-name or UI policy. */
export function groupTreatments<T>(items: readonly T[], identityOf: (item: T) => TreatmentIdentity | null) {
  const entries = items.flatMap(item => { const identity = identityOf(item); return identity ? [{ item, identity }] : [] })
  const index = treatmentCompoundIndex(entries.map(entry => entry.identity))
  const groups = new Map<string, { key: string; identity: TreatmentIdentity; items: T[] }>()
  for (const entry of entries) {
    const identity = contextualTreatmentIdentity(entry.identity, index), key = treatmentIdentityKey(identity)
    const group = groups.get(key) ?? { key, identity, items: [] }
    group.items.push(entry.item)
    groups.set(key, group)
  }
  // ID ordering is for options only, never chronology or event precedence.
  return [...groups.values()].sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
}
