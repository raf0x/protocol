import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../supabase'
import { prepareLabDraft, type LabDraft, type LabPanel, type LabResult } from './labs'

export class LabsAuthError extends Error {}

async function readBatches<T>(query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await query(from, from + 499)
    if (error) throw new Error('Lab results are unavailable. Check your connection or ask the app owner to verify the Labs migration.')
    rows.push(...(data ?? []))
    if (!data || data.length < 500) return rows
  }
}

/** Two batched owner-scoped queries avoid both N+1 and nested-result caps. */
export async function readLabPanels(client: SupabaseClient, userId: string): Promise<LabPanel[]> {
  if (!userId) throw new LabsAuthError('Sign in to view labs')
  const [panels, results] = await Promise.all([
    readBatches<Omit<LabPanel, 'results'>>((from, to) => client.from('lab_panels').select('*').eq('user_id', userId).order('test_date', { ascending: false }).order('id').range(from, to)),
    readBatches<LabResult>((from, to) => client.from('lab_results').select('*').eq('user_id', userId).order('id').range(from, to)),
  ])
  const byPanel = new Map<string, LabResult[]>()
  for (const result of results) {
    const group = byPanel.get(result.lab_panel_id) ?? []
    group.push(result); byPanel.set(result.lab_panel_id, group)
  }
  return panels.map(panel => ({ ...panel, results: (byPanel.get(panel.id) ?? []).sort((a, b) => a.biomarker_name.localeCompare(b.biomarker_name) || a.id.localeCompare(b.id)) }))
}

export async function loadLabs() {
  const client = createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (!user) throw new LabsAuthError('Sign in to view labs')
  if (error) throw new Error('Unable to verify your session. Please try again.')
  return readLabPanels(client, user.id)
}

export async function saveLabPanel(draft: LabDraft, client: SupabaseClient = createClient()) {
  const payload = prepareLabDraft(draft)
  const { data: { user }, error: authError } = await client.auth.getUser()
  if (!user || authError) throw new LabsAuthError('Please sign in again before saving.')
  // Ownership is assigned from auth.uid() inside the transaction, never from form input.
  const { data, error } = await client.rpc('save_lab_panel_v1', { p_panel: payload.panel, p_results: payload.results })
  if (error || typeof data !== 'string') throw new Error('We could not confirm the save. Your entries are still here. Check Recent Panels before retrying if your connection was interrupted.')
  return data
}
