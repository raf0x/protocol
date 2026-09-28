import { createClient } from '../supabase'
import { readTimelineEntries, TimelineAuthError } from './loadTimeline'
import { normalizeTimeline } from './timeline'
import type { CommandCenterSource } from './commandCenter'

/** Match Health's client loading boundary; no new endpoint, cache, or writes. */
export async function loadCommandCenter(): Promise<CommandCenterSource> {
  const client = createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (!user || error) throw new TimelineAuthError('Sign in to view Health')
  const [history, profile] = await Promise.all([
    readTimelineEntries(client, user.id),
    client.from('user_profiles').select('weight_unit').eq('id', user.id).maybeSingle(),
  ])
  if (profile.error) throw new Error('Health overview is temporarily unavailable.')
  return {
    journal: history.journalEntries,
    events: normalizeTimeline(history.protocolEvents, []),
    weightUnit: profile.data?.weight_unit === 'kg' ? 'kg' : 'lbs',
  }
}
