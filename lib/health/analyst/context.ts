import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { readLabPanels } from '../loadLabs'
import type { JournalEntryRow } from '../timeline'
import type { LibraryProtocol } from '../protocolPresentation'
import type { OverlayProtocolEvent } from '../protocolOverlay'
import { buildAnalystContext } from './evidence'

const protocolSelect = 'id,name,start_date,status,completed_date,compounds(id,name,route,vial_strength,vial_unit,bac_water_ml,ml_per_dose,concentration_value,concentration_unit,phases(id,dosing_entry,dose,dose_unit,dose_semantics_version,injection_volume_ml,syringe_units,syringe_scale,frequency,days_of_week,day_of_week,time_of_day,start_week,end_week,route))'

export async function loadHealthAnalystContext(client: SupabaseClient, userId: string, question: string, today: string) {
  if (!userId) throw new Error('Sign in to use the health analyst.')
  const [panels, protocolsResult, eventsResult, journalResult] = await Promise.all([
    readLabPanels(client, userId),
    client.from('protocols').select(protocolSelect).eq('user_id', userId).order('start_date', { ascending: false }).limit(100),
    client.from('protocol_events').select('id,date,event_type,description,protocol_id,compound_id,metadata').eq('user_id', userId).order('date', { ascending: false }).limit(200),
    client.from('journal_entries').select('id,date,notes,weight,mood,energy,sleep,hunger').eq('user_id', userId).order('date', { ascending: false }).limit(180),
  ])
  if (protocolsResult.error || eventsResult.error || journalResult.error) throw new Error('Your health history could not be loaded for analysis.')
  return buildAnalystContext({ panels, protocols: (protocolsResult.data ?? []) as unknown as LibraryProtocol[],
    protocolEvents: (eventsResult.data ?? []) as OverlayProtocolEvent[], journal: (journalResult.data ?? []) as JournalEntryRow[] }, question, today)
}
