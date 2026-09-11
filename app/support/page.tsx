'use client'

import { FormEvent, useState } from 'react'
import styles from './support.module.css'

type Status = 'idle' | 'sending' | 'success' | 'error'

export default function SupportPage() {
  const [status, setStatus] = useState<Status>('idle')
  const [message, setMessage] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = event.currentTarget
    const formData = new FormData(form)

    setStatus('sending')
    setMessage('')

    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          subject: formData.get('subject'),
          message: formData.get('message'),
          website: formData.get('website'),
        }),
      })

      const body = await response.json()

      if (!response.ok) {
        throw new Error(body.error || 'Unable to send your request.')
      }

      form.reset()
      setStatus('success')
      setMessage('Your request was sent. We will respond within 24 hours.')
    } catch (error) {
      setStatus('error')
      setMessage(
        error instanceof Error
          ? error.message
          : 'Unable to send your request. Please try again.'
      )
    }
  }

  return (
    <div className="today-surface">
      <main className={styles.page}>
        <section className={styles.card}>
          <header className={styles.header}>
            <span className={styles.eyebrow}>SUPPORT</span>
            <h1>How can we help?</h1>
            <p>
              Send us a message and we’ll respond within 24 hours.
            </p>
          </header>

          <form className={styles.form} onSubmit={handleSubmit}>
            <label>
              <span>Name</span>
              <input
                name="name"
                type="text"
                autoComplete="name"
                maxLength={100}
                required
              />
            </label>

            <label>
              <span>Email</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
              />
            </label>

            <label>
              <span>Subject</span>
              <input
                name="subject"
                type="text"
                maxLength={150}
                required
              />
            </label>

            <label>
              <span>Message</span>
              <textarea
                name="message"
                rows={5}
                maxLength={5000}
                required
              />
            </label>

            <div className={styles.honeypot} aria-hidden="true">
              <label>
                Website
                <input
                  name="website"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                />
              </label>
            </div>

            <button type="submit" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending…' : 'Send request'}
            </button>

            {message && (
              <p
                className={
                  status === 'success' ? styles.success : styles.error
                }
                role="status"
              >
                {message}
              </p>
            )}
          </form>

          <p className={styles.direct}>
            You can also email{' '}
            <a href="mailto:support@mypepprotocol.app">
              support@mypepprotocol.app
            </a>
          </p>
        </section>
      </main>
    </div>
  )
}