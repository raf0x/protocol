import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { operationalErrorType, sanitizeOperationalRoute, sanitizeOperationalType } from './monitoringCore'

export { operationalErrorType, sanitizeOperationalRoute } from './monitoringCore'

export type MonitorSource = 'client' | 'server' | 'api' | 'ai' | 'report' | 'push' | 'account'

export function buildOperationalEvent(input: { route: string; error?: unknown; errorType?: string; source: MonitorSource; status?: number }) {
  const release = process.env.VERCEL_GIT_COMMIT_SHA || process.env.VERCEL_DEPLOYMENT_ID || null
  return {
    route: sanitizeOperationalRoute(input.route),
    error_type: sanitizeOperationalType(input.errorType || operationalErrorType(input.error)),
    source: input.source,
    http_status: Number.isInteger(input.status) && input.status! >= 100 && input.status! <= 599 ? input.status : null,
    release: release ? sanitizeOperationalType(release).slice(0, 100) : null,
    request_id: crypto.randomUUID(),
  }
}

export async function captureOperationalError(input: { route: string; error?: unknown; errorType?: string; source: MonitorSource; status?: number }) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return false
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await client.from('app_error_events').insert(buildOperationalEvent(input))
    return !error
  } catch {
    return false
  }
}
