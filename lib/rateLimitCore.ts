import type { SupabaseClient } from '@supabase/supabase-js'

export type RateLimitBucket = 'health-analyst' | 'health-report-ai' | 'health-report-deterministic' | 'push-subscribe'
export type RemoteRateLimitResult = { allowed: boolean; retryAfter: number } | null

export async function checkRemoteRateLimit(client: Pick<SupabaseClient, 'rpc'>, bucket: RateLimitBucket): Promise<RemoteRateLimitResult> {
  const { data, error } = await client.rpc('check_app_rate_limit_v1', { p_bucket: bucket })
  const row = Array.isArray(data) ? data[0] : data
  if (error || !row || typeof row.allowed !== 'boolean') return null
  return { allowed: row.allowed, retryAfter: Math.max(0, Number(row.retry_after_seconds) || 0) }
}
