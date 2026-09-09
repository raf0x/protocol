import { createClient } from '../supabase'
import { normalizeTimeline, deriveBaseline, type ProtocolRow, type JournalEntryRow, type ProtocolEventRow } from './timeline'

export class TimelineAuthError extends Error {}

/** Read all history in batches rather than silently accepting Supabase's row cap. */
async function readAll<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = []
  const batchSize = 500
  for (let from = 0; ; from += batchSize) {
    const { data, error } = await query(from, from + batchSize - 1)
    if (error) throw new Error('Unable to load timeline history')
    rows.push(...(data ?? []))
    if (!data || data.length < batchSize) return rows
  }
}

export async function loadTimeline() {
  const supabase = createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (!user) throw new TimelineAuthError('Sign in to view your timeline')
  if (error) throw error
  const [protocolEvents, journalEntries, protocols] = await Promise.all([
    readAll<ProtocolEventRow>((from, to) => supabase.from('protocol_events')
      .select('id, date, event_type, description, protocol_id, compound_id, protocols(id, name, start_date, status, compounds(id, name, phases(id, dose, dose_unit, frequency, start_week, end_week, dose_semantics_version, route))), compounds(id, name, phases(id, dose, dose_unit, frequency, start_week, end_week, dose_semantics_version, route))')
      .eq('user_id', user.id).order('date', { ascending: false }).order('id').range(from, to)
      .returns<ProtocolEventRow[]>()),
    readAll<JournalEntryRow>((from, to) => supabase.from('journal_entries')
      .select('id, date, notes, weight, mood, energy, sleep, hunger')
      .eq('user_id', user.id).order('date', { ascending: false }).order('id').range(from, to)
      .returns<JournalEntryRow[]>()),
    readAll<ProtocolRow>((from, to) => supabase.from('protocols')
      // Whole rows allow optional structured dose/route fields without querying nonexistent columns.
      .select('*, compounds(*, phases(*))')
      .eq('user_id', user.id).order('id').range(from, to).returns<ProtocolRow[]>()),
  ])
  const events = normalizeTimeline(protocolEvents, journalEntries)
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return { events, baseline: deriveBaseline(protocols, journalEntries, events, today) }
}
