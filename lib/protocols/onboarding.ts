/** Eligibility always uses an unfiltered ownership result; failed reads are not empty accounts. */
export function onboardingEligible(userId: string | null, owned: readonly { id: string }[] | null) {
  return Boolean(userId && owned && owned.length === 0)
}

const seen = new Set<string>()
const key = (userId: string) => `mpp:first-protocol:${userId}`
export function onboardingSeen(userId: string) {
  if (seen.has(userId)) return true
  try { return sessionStorage.getItem(key(userId)) === '1' } catch { return false }
}
export function markOnboardingSeen(userId: string) {
  seen.add(userId)
  try { sessionStorage.setItem(key(userId), '1') } catch { /* In-memory fallback for restricted storage. */ }
}
