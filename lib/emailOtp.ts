function setting(value: string | undefined, fallback: number, min: number, max: number) {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) throw new Error('Invalid public email OTP configuration')
  return parsed
}

// Deployment must match these public values to the Supabase Dashboard settings.
// Rafael confirmed production length=6 and minimum interval=60s on 2026-09-24.
// Public overrides support environments with different provider settings.
export const EMAIL_OTP_LENGTH = setting(process.env.NEXT_PUBLIC_AUTH_EMAIL_OTP_LENGTH, 6, 6, 10)
export const EMAIL_RESEND_SECONDS = setting(process.env.NEXT_PUBLIC_AUTH_EMAIL_RESEND_SECONDS, 60, 1, 3600)

export const normalizeEmail = (value: string) => value.trim()
export const normalizeOtp = (value: string) => value.replace(/\s/g, '')
export const validOtp = (value: string) => new RegExp(`^[0-9]{${EMAIL_OTP_LENGTH}}$`).test(value)

export function isAuthRateLimit(error: unknown) {
  if (!error || typeof error !== 'object') return false
  return ('status' in error && error.status === 429) || ('code' in error &&
    ['over_email_send_rate_limit', 'over_request_rate_limit'].includes(String(error.code)))
}

export function emailAuthError(error: unknown, action: 'send' | 'verify') {
  if (isAuthRateLimit(error)) return 'Too many attempts. You can try again when the timer ends. If still limited, wait a little longer.'
  if (action === 'send') return 'We couldn’t request a code. Please try again shortly.'
  // Supabase can use otp_expired for both invalid and expired tokens.
  if (error && typeof error === 'object' && 'code' in error && error.code === 'otp_expired') {
    return 'That code is invalid or has expired. Request a new code and try again.'
  }
  return 'We couldn’t verify that code. Check it and try again, or request a new code.'
}
