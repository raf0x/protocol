import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadHealthSourceData } from '../analyst/context'
import { buildLongitudinal } from './engine'

/** Reuse batched owner-scoped reads. No per-intervention queries, writes, cache,
 * provider call, free-text interpretation, or stored health snapshots. */
export async function loadLongitudinal(client: SupabaseClient, userId: string, asOf: string) {
  if (!userId) throw new Error('Sign in to view health history.')
  return buildLongitudinal(await loadHealthSourceData(client, userId), asOf)
}
