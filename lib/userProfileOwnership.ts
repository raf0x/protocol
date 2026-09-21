export const USER_PROFILE_OWNER_KEYS = ['id'] as const

export type UserProfileOwnerKey = typeof USER_PROFILE_OWNER_KEYS[number]

type OwnershipAttempt<T> = {
  data: T | null
  error: unknown
}

type OwnershipResult<T> = OwnershipAttempt<T> & {
  ownerKey: UserProfileOwnerKey | null
}

/**
 * Profiles use the auth user ID as their primary key, as in onboarding and the
 * auth callback. Missing rows or RLS errors do not imply an alternate schema:
 * never probe a nonexistent user_id column after an unsuccessful lookup.
 */
export async function resolveUserProfileOwnership<T>(
  attempt: (ownerKey: UserProfileOwnerKey) => Promise<OwnershipAttempt<T>>,
  hasMatch: (data: T | null) => boolean = data => data !== null,
): Promise<OwnershipResult<T>> {
  let lastError: unknown = null

  for (const ownerKey of USER_PROFILE_OWNER_KEYS) {
    const result = await attempt(ownerKey)
    if (!result.error && hasMatch(result.data)) return { ...result, ownerKey }
    if (result.error) lastError = result.error
  }

  return { data: null, error: lastError, ownerKey: null }
}
