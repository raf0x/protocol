import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../supabase'
import type { LibraryProtocol } from './protocolPresentation'
import type { OverlayProtocolEvent, ProtocolOverlayData } from './protocolOverlay'

export async function readProtocolOverlay(client: SupabaseClient, userId: string, earliest: string, latest: string): Promise<ProtocolOverlayData> {
  const protocols = await client.from('protocols')
    .select('id,name,start_date,status,completed_date,compounds(id,name,route,phases(id,dosing_entry,dose,dose_unit,dose_semantics_version,frequency,days_of_week,start_week,end_week,route))')
    .eq('user_id', userId).lte('start_date', latest).or(`completed_date.is.null,completed_date.gte.${earliest}`).order('start_date')
  if (protocols.error) throw new Error('Protocol history could not be loaded. Your lab history is unchanged.')
  const rows = (protocols.data ?? []) as LibraryProtocol[], ids = rows.map(protocol => protocol.id)
  if (!ids.length) return { protocols: [], events: [] }
  // Earlier lifecycle events can determine whether a protocol was active at the
  // first lab date, so scope by relevant protocol IDs rather than truncating by it.
  const events = await client.from('protocol_events').select('id,date,event_type,description,protocol_id,compound_id,metadata')
    .eq('user_id', userId).in('protocol_id', ids).lte('date', latest).order('date')
  if (events.error) throw new Error('Protocol history could not be loaded. Your lab history is unchanged.')
  return { protocols: rows, events: (events.data ?? []) as OverlayProtocolEvent[] }
}

export async function loadProtocolOverlay(earliest: string, latest: string, client: SupabaseClient = createClient()) {
  const { data: { user }, error } = await client.auth.getUser()
  if (!user || error) throw new Error('Sign in again to view protocol history.')
  return readProtocolOverlay(client, user.id, earliest, latest)
}
