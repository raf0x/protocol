import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '../supabase'
import { importableRows, type InventoryPreview, type SavedInventoryItem } from './model'

export async function loadInventory(client: SupabaseClient = createClient()): Promise<SavedInventoryItem[]> {
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new Error('Sign in to view inventory.')
  const items: SavedInventoryItem[] = []
  for (let offset = 0; ; offset += 500) {
    const result = await client.from('inventory_items').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).order('id').range(offset, offset + 499)
    if (result.error) throw new Error('Inventory could not be loaded. Try again.')
    items.push(...result.data as SavedInventoryItem[])
    if (result.data.length < 500) return items
  }
}

export async function confirmInventoryImport(preview: InventoryPreview, requestId: string, confirmed: boolean, client: SupabaseClient = createClient()) {
  if (!confirmed) throw new Error('Review and confirm the import first.')
  const rows = importableRows(preview)
  if (!rows.length) throw new Error('There are no valid new rows to import.')
  const { data, error } = await client.rpc('import_inventory_v1', { p_request_id: requestId, p_rows: rows, p_confirmed: true })
  if (error) throw new Error('Import could not be completed. Your import can be retried safely.')
  return data as { inserted: number; duplicates: number }
}

export async function deleteInventoryItem(id: string, client: SupabaseClient = createClient()) {
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Sign in to delete inventory.')
  const { data, error } = await client.from('inventory_items').delete().eq('id', id).eq('user_id', user.id).select('id')
  if (error || !data?.length) throw new Error('This item could not be deleted. Refresh inventory and try again.')
}
