'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'
import { safeAuthReturnPath } from '../../../lib/authRedirect'
import { postAuthDestination } from '../../../lib/authPostAuth'
import { EMAIL_OTP_LENGTH, EMAIL_RESEND_SECONDS, normalizeEmail, normalizeOtp, validOtp, isAuthRateLimit, emailAuthError } from '../../../lib/emailOtp'
import styles from './login.module.css'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [pending, setPending] = useState<'send' | 'verify' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [sessionChecking, setSessionChecking] = useState(true)
  const [resendSeconds, setResendSeconds] = useState(0)
  const [verifySeconds, setVerifySeconds] = useState(0)
  const resendAt = useRef(0)
  const verifyAt = useRef(0)
  const busy = useRef(false)
  const completed = useRef(false)
  const emailInput = useRef<HTMLInputElement>(null)
  const codeInput = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    // Deadlines survive background-tab timer throttling and changing the email.
    const timer = window.setInterval(() => {
      setResendSeconds(Math.max(0, Math.ceil((resendAt.current - Date.now()) / 1000)))
      setVerifySeconds(Math.max(0, Math.ceil((verifyAt.current - Date.now()) / 1000)))
    }, 250)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let live = true
    const params = new URLSearchParams(window.location.search)
    const next = safeAuthReturnPath(params.get('next'))
    if (params.get('error') === 'link') setError('This sign-in link could not be verified. Request a code to continue.')
    const fallback = window.setTimeout(() => {
      live = false // A late session check must not interrupt a new email request.
      setSessionChecking(false)
    }, 4000)
    const client = createClient()
    client.auth.getUser().then(async ({ data: { user } }) => {
      if (!live) return
      window.clearTimeout(fallback)
      if (user) {
        const returnPath = await postAuthDestination(client, user.id, next)
        if (!live || completed.current) return
        completed.current = true
        router.replace(returnPath)
        router.refresh()
      } else setSessionChecking(false)
    }).catch(() => { if (live) setSessionChecking(false) }).finally(() => window.clearTimeout(fallback))
    return () => { live = false; window.clearTimeout(fallback) }
  }, [router])

  useEffect(() => {
    if (!sessionChecking) (step === 'email' ? emailInput : codeInput).current?.focus()
  }, [step, sessionChecking])

  function pauseRequests(action: 'send' | 'verify') {
    const deadline = Date.now() + EMAIL_RESEND_SECONDS * 1000
    if (action === 'send') { resendAt.current = deadline; setResendSeconds(EMAIL_RESEND_SECONDS) }
    else { verifyAt.current = deadline; setVerifySeconds(EMAIL_RESEND_SECONDS) }
  }

  async function sendCode() {
    if (busy.current || completed.current || Date.now() < resendAt.current) return
    const address = normalizeEmail(email)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Please enter a valid email address.')
      emailInput.current?.focus()
      return
    }
    busy.current = true
    setPending('send'); setError(''); setNotice('')
    try {
      const { error: requestError } = await createClient().auth.signInWithOtp({ email: address, options: { shouldCreateUser: true } })
      if (requestError) throw requestError
      pauseRequests('send')
      setEmail(address); setCode('')
      if (step === 'code') setNotice('A new code was requested. Use the latest email.')
      setStep('code')
      codeInput.current?.focus()
    } catch (requestError) {
      if (isAuthRateLimit(requestError)) pauseRequests('send')
      setError(emailAuthError(requestError, 'send'))
    } finally {
      busy.current = false
      setPending(null)
    }
  }

  async function verifyCode() {
    if (busy.current || completed.current || Date.now() < verifyAt.current) return
    const token = normalizeOtp(code)
    if (!validOtp(token)) {
      setError(`Enter the ${EMAIL_OTP_LENGTH}-digit code from your email.`)
      codeInput.current?.focus()
      return
    }
    busy.current = true
    setPending('verify'); setError(''); setNotice('')
    try {
      const client = createClient()
      const { data, error: verificationError } = await client.auth.verifyOtp({ email, token, type: 'email' })
      if (verificationError) throw verificationError
      if (!data.session?.access_token || !data.user?.id) throw new Error('Session unavailable')
      // The SDK has persisted the session through the existing SSR cookie storage.
      // Consume this UI flow once, before awaiting routing; never submit this token again.
      completed.current = true
      setCode('')
      const next = safeAuthReturnPath(new URLSearchParams(window.location.search).get('next'))
      const returnPath = await postAuthDestination(client, data.user.id, next)
      router.replace(returnPath)
      router.refresh()
    } catch (verificationError) {
      if (isAuthRateLimit(verificationError)) pauseRequests('verify')
      setError(emailAuthError(verificationError, 'verify'))
      codeInput.current?.focus()
    } finally {
      busy.current = false
      if (!completed.current) setPending(null)
    }
  }

  function changeEmail() {
    if (busy.current || completed.current) return
    setStep('email'); setCode(''); setError(''); setNotice('')
    // Keep provider cooldowns; changing the email must not bypass the timer.
  }

  if (sessionChecking) return <main className={styles.screen} role="status" aria-live="polite">Checking your session…</main>

  const codeStep = step === 'code'
  return (
    <main className={styles.screen}>
      <div className={styles.panel}>
        <h1 className={styles.heading}>{codeStep ? 'Check your email' : 'MyPepProtocol'}</h1>
        <p className={styles.description}>{codeStep ? <>Enter the code sent to <strong>{email}</strong>.</> : 'Sign in with your email.'}</p>
        <form noValidate aria-busy={!!pending} onSubmit={event => { event.preventDefault(); if (codeStep) void verifyCode(); else void sendCode() }}>
          {codeStep ? (
            <>
              <label className={styles.label} htmlFor="login-code">{EMAIL_OTP_LENGTH}-digit code</label>
              <input ref={codeInput} id="login-code" name="code" className={`${styles.input} ${styles.code}`} type="text" inputMode="numeric" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false}
                value={code} onChange={event => { setCode(normalizeOtp(event.target.value)); setError('') }} readOnly={!!pending}
                aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} />
            </>
          ) : (
            <>
              <label className={styles.label} htmlFor="login-email">Email address</label>
              <input ref={emailInput} id="login-email" name="email" className={styles.input} type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false}
                value={email} onChange={event => { setEmail(event.target.value); setError('') }} readOnly={!!pending} placeholder="you@example.com"
                aria-invalid={!!error} aria-describedby={error ? 'login-error' : undefined} />
            </>
          )}
          {error && <p id="login-error" className={styles.error} role="alert">{error}</p>}
          <button className={styles.primary} type="submit" disabled={!!pending || (codeStep ? verifySeconds > 0 : resendSeconds > 0)}>
            {pending === 'verify' ? 'Verifying…' : pending === 'send' && !codeStep ? 'Sending…' : codeStep ? 'Verify code' : 'Email me a code'}
          </button>
          {codeStep && <>
            {verifySeconds > 0 && <p className={styles.timer}>Try verifying again in {verifySeconds}s.</p>}
            <button className={styles.secondary} type="button" onClick={() => void sendCode()} disabled={!!pending || resendSeconds > 0} aria-describedby={resendSeconds > 0 ? 'resend-timer' : undefined}>{pending === 'send' ? 'Sending…' : 'Resend code'}</button>
            <button className={styles.secondary} type="button" onClick={changeEmail} disabled={!!pending}>Use a different email</button>
          </>}
          {resendSeconds > 0 && <p id="resend-timer" className={styles.timer}>{codeStep ? 'Resend available' : 'Try again'} in {resendSeconds}s.</p>}
          <p className={styles.notice} role="status">{notice}</p>
        </form>
        <p className={styles.footer}>{codeStep ? 'No email? Check your spam folder.' : 'For personal harm reduction tracking. Not medical advice.'}</p>
      </div>
    </main>
  )
}
