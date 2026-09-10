import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../supabase'

export type ProtocolTransition = 'pause' | 'resume' | 'complete'

function message(error: unknown, fallback: string) {
  return error && typeof error === 'object' && 'message' in error && typeof error.message === 'string'
    ? error.message : fallback
}

export async function saveProtocolWithEvents(input: {
  protocolId: string | null
  name: string
  startDate: string
  compounds: unknown[]
  continuedFromId?: string | null
  removedCompoundIds?: string[]
  effectiveDate: string
}, client: SupabaseClient = createClient()) {
  const { data, error } = await client.rpc('save_protocol_with_events_v1', {
    p_protocol_id: input.protocolId,
    p_name: input.name,
    p_start_date: input.startDate,
    p_compounds: input.compounds,
    p_continued_from_id: input.continuedFromId ?? null,
    p_removed_compound_ids: input.removedCompoundIds ?? [],
    p_effective_date: input.effectiveDate,
  })
  if (error) throw new Error(message(error, 'Unable to save protocol.'))
  return data as string
}

export async function changeProtocolDose(input: {
  protocolId: string
  compoundId: string
  dosingEntry: unknown
  effectiveDate: string
}, client: SupabaseClient = createClient()) {
  const { data, error } = await client.rpc('change_protocol_dose_v1', {
    p_protocol_id: input.protocolId,
    p_compound_id: input.compoundId,
    p_dosing_entry: input.dosingEntry,
    p_effective_date: input.effectiveDate,
  })
  if (error) throw new Error(message(error, 'Unable to save the dose change.'))
  return data as string
}

export async function transitionProtocol(input: {
  protocolId: string
  action: ProtocolTransition
  effectiveDate: string
}, client: SupabaseClient = createClient()) {
  const { error } = await client.rpc('transition_protocol_v1', {
    p_protocol_id: input.protocolId,
    p_action: input.action,
    p_effective_date: input.effectiveDate,
  })
  if (error) throw new Error(message(error, 'Unable to update the protocol.'))
}

export async function continueLatestPhase(input: {
  protocolId: string
  compoundId: string
  phaseId: string
}, client: SupabaseClient = createClient()) {
  const { error } = await client.rpc('continue_latest_phase', {
    p_protocol_id: input.protocolId,
    p_compound_id: input.compoundId,
    p_phase_id: input.phaseId,
  })
  if (error) throw new Error(message(error, 'Unable to continue the phase.'))
}
