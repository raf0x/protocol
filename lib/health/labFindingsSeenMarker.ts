import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../supabase'
import { resolveUserProfileOwnership } from '../userProfileOwnership'

type SeenMarkerRow = { last_seen_lab_panel_id: string | null }

export async function readLastSeenLabPanelId(client: SupabaseClient, userId: string): Promise<string | null> {
  const result = await resolveUserProfileOwnership<SeenMarkerRow>(async ownerKey => await client.from('user_profiles')
    .select('last_seen_lab_panel_id').eq(ownerKey, userId).limit(1).maybeSingle<SeenMarkerRow>())
  return result.data?.last_seen_lab_panel_id ?? null
}

/** Returns null both when signed out and when no marker is recorded yet --
 * callers must treat "never visited" and "signed out" the same way: silent. */
export async function loadLastSeenLabPanelId(client: SupabaseClient = createClient()): Promise<string | null> {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return null
  return readLastSeenLabPanelId(client, user.id)
}

export async function markLabFindingsSeen(panelId: string, client: SupabaseClient = createClient()): Promise<void> {
  const { data: { user } } = await client.auth.getUser()
  if (!user) return
  await resolveUserProfileOwnership(
    async ownerKey => await client.from('user_profiles').update({ last_seen_lab_panel_id: panelId }).eq(ownerKey, user.id).select('last_seen_lab_panel_id'),
    data => Array.isArray(data) && data.length > 0,
  )
}
