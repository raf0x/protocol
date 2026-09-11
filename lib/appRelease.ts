type ReleaseEnvironment = {
  [key: string]: string | undefined
  VERCEL_GIT_COMMIT_SHA?: string
  VERCEL_DEPLOYMENT_ID?: string
}

/** A short deployment fingerprint for QA. Never exposes arbitrary environment values. */
export function publicReleaseIdentifier(environment: ReleaseEnvironment = process.env): string {
  const source = environment.VERCEL_GIT_COMMIT_SHA || environment.VERCEL_DEPLOYMENT_ID || ''
  const safe = source.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 12)
  return safe || 'local'
}

// App Store V1 reliability decision. See docs/push-v1-decision.md before changing.
export const APP_STORE_V1_PUSH_ENABLED = false
