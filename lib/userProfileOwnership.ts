export const USER_PROFILE_OWNER_KEYS = ['id', 'user_id'] as const

export type UserProfileOwnerKey = typeof USER_PROFILE_OWNER_KEYS[number]

type OwnershipAttempt<T> = {
  data: T | null
  error: unknown
}

type OwnershipResult<T> = OwnershipAttempt<T> & {
  ownerKey: UserProfileOwnerKey | null
}

/**
 * Supports deployments where a profile is owned by either `id` or `user_id`.
 * A missing column, RLS error, or empty result on one key must not prevent the
 * other established ownership shape from being tried.
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
