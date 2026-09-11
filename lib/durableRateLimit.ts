import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { rateLimit } from './rateLimit'
import { checkRemoteRateLimit, type RateLimitBucket } from './rateLimitCore'

type RateLimitResult = { allowed: boolean; retryAfter: number; available: boolean }

const localLimits: Record<RateLimitBucket, { limit: number; windowMs: number }> = {
  'health-analyst': { limit: 8, windowMs: 600_000 },
  'health-report-ai': { limit: 6, windowMs: 600_000 },
  'health-report-deterministic': { limit: 30, windowMs: 600_000 },
  'push-subscribe': { limit: 5, windowMs: 60_000 },
}

export async function checkDurableRateLimit(client: SupabaseClient, userId: string, bucket: RateLimitBucket): Promise<RateLimitResult> {
  const remote = await checkRemoteRateLimit(client, bucket)
  if (remote) return { ...remote, available: true }
  if (process.env.NODE_ENV !== 'production') {
    const config = localLimits[bucket]
    return { allowed: rateLimit(`${bucket}:${userId}`, config.limit, config.windowMs), retryAfter: Math.ceil(config.windowMs / 1000), available: false }
  }
  return { allowed: false, retryAfter: 60, available: false }
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return result.allowed ? {} : { 'Retry-After': String(Math.max(1, result.retryAfter)) }
}
