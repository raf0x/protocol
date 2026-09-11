import Link from 'next/link'

export default function TermsPage() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        background: 'var(--color-bg)',
        color: 'var(--color-text)',
        padding:
          'max(40px, env(safe-area-inset-top, 0px)) 24px max(40px, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div style={{ maxWidth: '720px', margin: '0 auto' }}>
        <h1
          style={{
            fontSize: '32px',
            fontWeight: 900,
            marginBottom: '8px',
          }}
        >
          Terms of Use
        </h1>

        <p
          style={{
            color: 'var(--color-muted)',
            fontSize: '14px',
            marginBottom: '32px',
          }}
        >
          Last updated: September 11, 2026
        </p>

        <Section title="Acceptance of these terms">
          <p>
            By accessing or using MyPepProtocol, you agree to these Terms of
            Use. If you do not agree to these terms, do not use the service.
          </p>
        </Section>

        <Section title="What MyPepProtocol is">
          <p>
            MyPepProtocol is a personal protocol, health tracking, and
            informational software tool. It helps users organize and review
            information they choose to record, including protocol details,
            wellness entries, lab results, timelines, reports, and related
            health information.
          </p>
          <p>
            MyPepProtocol is not a healthcare provider, pharmacy, laboratory,
            medical practice, or emergency service.
          </p>
        </Section>

        <Section title="Medical disclaimer">
          <p>
            MyPepProtocol does not provide medical diagnosis, treatment,
            prescribing, or individualized medical advice. Information shown
            by the service, including calculations, summaries, reports,
            timelines, and AI-assisted output, is provided for informational
            and organizational purposes only.
          </p>
          <p>
            Do not use MyPepProtocol as a substitute for professional medical
            judgment. Decisions involving medications, peptides, hormones,
            dosages, administration, laboratory testing, or other medical care
            should be made with an appropriately qualified healthcare
            professional.
          </p>
          <p>
            If you believe you may be experiencing a medical emergency, seek
            emergency medical care immediately.
          </p>
        </Section>

        <Section title="Your responsibility for health decisions">
          <p>
            You are responsible for reviewing the accuracy of information you
            enter into MyPepProtocol and for verifying any information produced
            or displayed by the service before relying on it.
          </p>
          <p>
            MyPepProtocol may contain incomplete, incorrect, outdated, or
            misunderstood information, particularly when data is entered,
            imported, calculated, summarized, or interpreted automatically.
          </p>
        </Section>

        <Section title="AI-assisted features">
          <p>
            Certain features may use artificial intelligence to summarize or
            analyze information you provide. AI-generated output may be
            inaccurate, incomplete, or inappropriate for your circumstances.
          </p>
          <p>
            AI output is not medical advice and should not be treated as a
            diagnosis, prescription, treatment recommendation, or substitute
            for professional medical care.
          </p>
        </Section>

        <Section title="Accounts">
          <p>
            You are responsible for maintaining the confidentiality of your
            account credentials and for activity that occurs through your
            account.
          </p>
        </Section>

        <Section title="Acceptable use">
          <ul style={{ paddingLeft: '20px' }}>
            <li>
              Use MyPepProtocol only for lawful and legitimate purposes.
            </li>
            <li>
              Do not attempt to gain unauthorized access to accounts, systems,
              databases, or infrastructure.
            </li>
            <li>
              Do not interfere with or disrupt the operation or security of the
              service.
            </li>
            <li>
              Do not misuse, scrape, or reverse engineer the service in
              violation of applicable law.
            </li>
          </ul>
        </Section>

        <Section title="Your data">
          <p>
            You retain responsibility for the information you submit to
            MyPepProtocol. You grant MyPepProtocol permission to process that
            information as reasonably necessary to provide the features you
            request.
          </p>
          <p>
            Information handling is further described in the{' '}
            <Link
              href="/privacy"
              style={{
                color: 'var(--color-green)',
                textDecoration: 'none',
              }}
            >
              Privacy Policy
            </Link>
            .
          </p>
        </Section>

        <Section title="Account deletion">
          <p>
            You may delete your account using the account deletion feature
            provided in MyPepProtocol. Deletion removes active application
            records associated with your account, subject to operational
            backups, provider retention periods, security requirements, and
            applicable law.
          </p>
        </Section>

        <Section title="Availability and changes">
          <p>
            MyPepProtocol may change, add, remove, suspend, or discontinue
            features at any time. We do not guarantee that the service will
            always be available, uninterrupted, error-free, or compatible with
            every device or platform.
          </p>
        </Section>

        <Section title="Third-party services">
          <p>
            MyPepProtocol relies on third-party service providers for certain
            functions, including hosting, authentication, database services,
            email delivery, and optional AI-assisted features.
          </p>
        </Section>

        <Section title="Disclaimer of warranties">
          <p>
            MyPepProtocol is provided on an “as is” and “as available” basis
            without warranties of any kind, to the maximum extent permitted by
            law.
          </p>
        </Section>

        <Section title="Limitation of liability">
          <p>
            To the maximum extent permitted by applicable law, MyPepProtocol
            and its operators will not be liable for indirect, incidental,
            consequential, special, exemplary, or punitive damages arising
            from or related to your use of, inability to use, or reliance on
            the service.
          </p>
        </Section>

        <Section title="Changes to these terms">
          <p>
            These Terms of Use may be updated as MyPepProtocol changes. The
            “Last updated” date on this page identifies the current version.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these Terms of Use may be sent to{' '}
            <a
              href="mailto:support@mypepprotocol.app"
              style={{ color: 'var(--color-green)' }}
            >
              support@mypepprotocol.app
            </a>
            .
          </p>
        </Section>

        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: '24px',
            marginTop: '40px',
          }}
        >
          <Link
            href="/"
            style={{
              color: 'var(--color-green)',
              textDecoration: 'none',
              fontSize: '14px',
            }}
          >
            ← Back to MyPepProtocol
          </Link>
        </div>
      </div>
    </main>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section style={{ marginBottom: '32px' }}>
      <h2
        style={{
          fontSize: '20px',
          fontWeight: 700,
          marginBottom: '12px',
        }}
      >
        {title}
      </h2>

      <div
        style={{
          color: 'var(--color-dim)',
          lineHeight: 1.7,
        }}
      >
        {children}
      </div>
    </section>
  )
}