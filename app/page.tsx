'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'
import styles from './landing.module.css'

const RECORD_TYPES = ['Protocols', 'Labs', 'Symptoms', 'Weight', 'Journal']

const CAPABILITIES = [
  {
    number: '01',
    title: 'Record once',
    body: 'Keep protocols, dose phases, labs, symptoms, weight, and journal notes in one private record.',
  },
  {
    number: '02',
    title: 'Understand what changed',
    body: 'See dated health changes beside the protocol events and treatment episodes recorded around them.',
  },
  {
    number: '03',
    title: 'Review the evidence',
    body: 'Trace summaries back to lab values, timeline events, and stated limitations whenever you need the details.',
  },
]

const INTELLIGENCE_POINTS = [
  {
    title: 'Health Briefing',
    body: 'A concise view of current context, notable changes, and items worth reviewing.',
  },
  {
    title: 'Guided Health Analyst',
    body: 'Ask focused questions about your recorded history, with AI kept separate from deterministic facts.',
  },
  {
    title: 'Doctor Report',
    body: 'Export a clinician-oriented summary with protocol context, longitudinal findings, and limitations.',
  },
]

const FAQS = [
  {
    question: 'Is MyPepProtocol medical advice?',
    answer: 'No. It organizes information you record and describes changes over time. It does not diagnose conditions, prescribe treatment, or establish causation.',
  },
  {
    question: 'What can I track?',
    answer: 'Protocols and phases, medication doses, administration details, labs, symptoms, sleep, energy, mood, hunger, weight, and journal notes.',
  },
  {
    question: 'How does AI use my data?',
    answer: 'AI-assisted analysis runs only when you request it and allow AI processing. The factual timeline and non-AI health features remain available without it.',
  },
  {
    question: 'Is my data used for advertising?',
    answer: 'No. MyPepProtocol does not sell personal data and does not use advertising trackers.',
  },
]

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let live = true
    const fallback = window.setTimeout(() => {
      if (live) setChecking(false)
    }, 4000)

    async function checkUser() {
      try {
        const supabase = createClient()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!live) return
        if (user) router.replace('/protocol')
        else setChecking(false)
      } catch {
        if (live) setChecking(false)
      } finally {
        window.clearTimeout(fallback)
      }
    }

    void checkUser()
    return () => {
      live = false
      window.clearTimeout(fallback)
    }
  }, [router])

  useEffect(() => {
    if (checking) return

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12 },
    )

    document.querySelectorAll('[data-reveal]').forEach(element => observer.observe(element))
    return () => observer.disconnect()
  }, [checking])

  if (checking) {
    return (
      <main
        role="status"
        aria-live="polite"
        aria-label="Checking your session"
        className={styles.sessionCheck}
      />
    )
  }

  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Public navigation">
        <Link href="/" className={styles.brand} aria-label="MyPepProtocol home">
          <span className={styles.brandMark} aria-hidden="true">M</span>
          <span>MyPepProtocol</span>
        </Link>

        <div className={styles.navActions}>
          <a href="#how-it-works" className={styles.navDemo}>How it works</a>
          <Link href="/auth/login" className={styles.navSignIn}>Sign in</Link>
        </div>
      </nav>

      <section className={styles.hero}>
        <div className={styles.heroGlow} aria-hidden="true" />
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>LONGITUDINAL HEALTH INTELLIGENCE</p>
          <h1>Your health data should tell <span>one clear story.</span></h1>
          <p className={styles.heroCopy}>
            Record protocols, labs, symptoms, weight, and notes once. MyPepProtocol organizes what changed,
            when it changed, and the evidence behind it.
          </p>

          <div className={styles.heroActions}>
            <Link href="/auth/login" className={styles.primaryAction}>Get early access <span aria-hidden="true">→</span></Link>
            <a href="#how-it-works" className={styles.secondaryAction}>See how it works</a>
          </div>

          <div className={styles.recordTypes} aria-label="Supported record types">
            {RECORD_TYPES.map(item => <span key={item}>{item}</span>)}
          </div>
        </div>
      </section>

      <section className={styles.productPreview} aria-labelledby="preview-title">
        <div className={styles.previewIntro} data-reveal>
          <p className={styles.sectionLabel}>YOUR RECORD, IN CONTEXT</p>
          <h2 id="preview-title">Start with today. Keep the full history.</h2>
          <p>Daily tracking stays simple while every entry contributes to a structured timeline you can review later.</p>
        </div>

        <div className={styles.previewFrame} data-reveal>
          <div className={styles.previewBar} aria-hidden="true">
            <span /><span /><span /><small>Today</small>
          </div>
          <div className={styles.previewImageWrap}>
            <Image
              src="/protocol.png"
              width={1151}
              height={2265}
              sizes="(max-width: 720px) 88vw, 430px"
              priority
              alt="MyPepProtocol daily dashboard with active protocol rings and health tracking"
              className={styles.previewImage}
            />
          </div>
          <div className={styles.previewNote}>
            <span className={styles.notePulse} aria-hidden="true" />
            <div>
              <strong>One continuous timeline</strong>
              <p>Protocol changes stay connected to the exact treatment episode that produced them.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.workflow} aria-labelledby="workflow-title">
        <div className={styles.sectionHeading} data-reveal>
          <p className={styles.sectionLabel}>LESS WORK. BETTER CONTEXT.</p>
          <h2 id="workflow-title">From scattered records to useful context.</h2>
        </div>

        <div className={styles.capabilityGrid}>
          {CAPABILITIES.map(item => (
            <article key={item.number} className={styles.capabilityCard} data-reveal>
              <span className={styles.cardNumber}>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.contextSection} aria-labelledby="context-title">
        <div className={styles.contextPanel} data-reveal>
          <div className={styles.contextCopy}>
            <p className={styles.sectionLabel}>CONTEXT WITHOUT OVERCLAIMING</p>
            <h2 id="context-title">See what changed around your treatment history.</h2>
            <p>
              MyPepProtocol preserves treatment episodes, compounds, phases, and dates so your history stays
              accurate. It describes timing and association without turning personal observations into causal claims.
            </p>
          </div>

          <div className={styles.timelineSample} aria-label="Example longitudinal timeline">
            <div className={styles.timelineLine} aria-hidden="true" />
            <div className={styles.timelineEvent}>
              <span className={styles.timelineDot} aria-hidden="true" />
              <small>WEEK 1</small><strong>Protocol started</strong><p>Exact treatment identity preserved</p>
            </div>
            <div className={styles.timelineEvent}>
              <span className={styles.timelineDot} aria-hidden="true" />
              <small>WEEK 7</small><strong>Lab panel recorded</strong><p>Source values remain reviewable</p>
            </div>
            <div className={styles.timelineEvent}>
              <span className={styles.timelineDot} aria-hidden="true" />
              <small>WEEK 18</small><strong>New episode recorded</strong><p>Never merged by display name</p>
            </div>
          </div>
        </div>
      </section>

      <section className={styles.intelligence} aria-labelledby="intelligence-title">
        <div className={styles.sectionHeading} data-reveal>
          <p className={styles.sectionLabel}>WHEN YOU NEED THE ANSWER</p>
          <h2 id="intelligence-title">Conclusion first. Evidence close behind.</h2>
          <p>Get the useful summary without losing the underlying facts, provenance, or uncertainty.</p>
        </div>

        <div className={styles.intelligenceList}>
          {INTELLIGENCE_POINTS.map((item, index) => (
            <article key={item.title} className={styles.intelligenceItem} data-reveal>
              <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <div><h3>{item.title}</h3><p>{item.body}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.trust} aria-labelledby="trust-title">
        <div className={styles.trustContent} data-reveal>
          <p className={styles.sectionLabel}>PRIVATE BY DESIGN</p>
          <h2 id="trust-title">Your record is not an advertising product.</h2>
          <p>
            MyPepProtocol does not sell personal data or use advertising trackers. AI-assisted features run only
            when you request them and allow AI processing.
          </p>
          <Link href="/privacy">Read the Privacy Policy →</Link>
        </div>

        <div className={styles.trustFacts} data-reveal>
          {['No personal data sales', 'No advertising trackers', 'AI processing is opt-in', 'Non-AI features remain available'].map(fact => (
            <div key={fact}><span aria-hidden="true">✓</span>{fact}</div>
          ))}
        </div>
      </section>

      <section className={styles.faq} aria-labelledby="faq-title">
        <div className={styles.sectionHeading} data-reveal>
          <p className={styles.sectionLabel}>QUESTIONS</p>
          <h2 id="faq-title">Clear by design.</h2>
        </div>

        <div className={styles.faqList}>
          {FAQS.map(item => (
            <article key={item.question} data-reveal><h3>{item.question}</h3><p>{item.answer}</p></article>
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <div data-reveal>
          <p className={styles.sectionLabel}>YOUR HISTORY, MADE USEFUL</p>
          <h2>Record once. Understand what changed.</h2>
          <p>Start building a health record that stays connected, explainable, and ready to review.</p>
          <div className={styles.heroActions}>
            <Link href="/auth/login" className={styles.primaryAction}>Get started free <span aria-hidden="true">→</span></Link>
          </div>
          <small>Free during early access. No credit card required.</small>
        </div>
      </section>

      <footer className={styles.footer}>
        <Link href="/" className={styles.footerBrand}>MyPepProtocol</Link>
        <div>
          <Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/support">Support</Link><Link href="/calculator">Calculator</Link>
        </div>
        <p>© 2026 MyPepProtocol. Not medical advice.</p>
      </footer>
    </main>
  )
}
