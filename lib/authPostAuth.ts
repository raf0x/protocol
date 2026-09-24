import type { SupabaseClient } from '@supabase/supabase-js'
import { safeAuthReturnPath } from './authRedirect'
import { onboardingEligible } from './protocols/onboarding'

/** Shared by numeric OTP, existing sessions, and sign-in email callbacks. */
export async function postAuthDestination(client: SupabaseClient, userId: string, next?: string | null) {
  const returnPath = safeAuthReturnPath(next)
  try {
    // All lifecycle states count. A failed/aborted read must never mean "new account".
    const { data, error } = await client.from('protocols').select('id').eq('user_id', userId).limit(1)
      .abortSignal(AbortSignal.timeout(5000))
    if (!error && onboardingEligible(userId, data)) return '/onboarding'
  } catch { /* Continue to the normal destination; Today can retry its existing ownership check. */ }
  return returnPath
}
