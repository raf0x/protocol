import Link from 'next/link'

const sectionStyle = { marginBottom: '32px' }

const headingStyle = {
  fontSize: '20px',
  fontWeight: 700,
  marginBottom: '12px',
}

const copyStyle = {
  color: 'var(--color-dim)',
  lineHeight: 1.7,
  marginBottom: '12px',
}

const listStyle = {
  color: 'var(--color-dim)',
  lineHeight: 1.7,
  paddingLeft: '20px',
}

export default function PrivacyPolicy() {
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
          Privacy Policy
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

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Overview</h2>

          <p style={copyStyle}>
            MyPepProtocol is a private protocol and longitudinal health
            tracking tool. This Privacy Policy describes the information the
            current app processes to provide its features.
          </p>

          <p style={copyStyle}>
            We do not sell personal data and do not use advertising trackers.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Information we process</h2>

          <ul style={listStyle}>
            <li>
              Account information, including your email address, account
              identifier, and authentication-related timestamps.
            </li>

            <li>
              Protocol information, including compounds, doses, administration
              details, schedules, phases, routes, inventory, notes, and
              protocol events.
            </li>

            <li>
              Journal and wellness information you choose to enter, such as
              weight, sleep, energy, mood, hunger, and notes.
            </li>

            <li>
              Laboratory information you enter or import, including test dates,
              biomarker names, values, units, reference ranges, providers,
              filenames, and import provenance.
            </li>

            <li>
              Push notification subscription information and reminder settings
              when you enable notifications.
            </li>

            <li>
              Support information you submit through the support form,
              including your name, email address, subject, and message.
            </li>

            <li>
              Network and diagnostic information that hosting and service
              providers necessarily process to operate and protect the service.
            </li>

            <li>
              Privacy-scrubbed operational events limited to items such as
              route, error type, status, release, timestamp, and a random
              request identifier. These operational events exclude health
              values, notes, request payloads, account identifiers, and error
              messages or stack traces.
            </li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>AI-assisted features</h2>

          <p style={copyStyle}>
            AI Health Analyst and optional AI-assisted report summaries run
            only when you request them and after you explicitly allow AI
            processing.
          </p>

          <p style={copyStyle}>
            When you use an AI-assisted feature, MyPepProtocol sends a
            minimized selection of relevant recorded health information,
            together with your question or report context, to OpenAI to
            generate the requested output.
          </p>

          <p style={copyStyle}>
            AI output may be incomplete or inaccurate and is not medical
            advice or a substitute for professional medical care.
          </p>

          <p style={copyStyle}>
            MyPepProtocol does not save generated Health Analyst answers or
            AI-generated report summaries to its application database. You may
            revoke AI processing permission from Profile. Non-AI Health
            features and factual reports remain available.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Reports and imports</h2>

          <p style={copyStyle}>
            Doctor-ready reports are assembled for your use and exported
            through the browser print workflow. MyPepProtocol does not upload
            or store the generated PDF as a separate report file.
          </p>

          <p style={copyStyle}>
            CSV and PDF laboratory files may be processed as part of the lab
            import workflow. You should review imported values before saving
            them to your account.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Support communications</h2>

          <p style={copyStyle}>
            When you submit the MyPepProtocol support form, the information you
            provide is used to receive, route, and respond to your support
            request.
          </p>

          <p style={copyStyle}>
            Support email delivery is handled through SendGrid. Messages sent
            to the MyPepProtocol support address may also be forwarded through
            ImprovMX to the support inbox used to respond to your request.
          </p>

          <p style={copyStyle}>
            Please avoid including passwords, authentication credentials, or
            unnecessary sensitive information in support messages.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>How information is used</h2>

          <ul style={listStyle}>
            <li>
              Authenticate you and keep application records scoped to your
              account.
            </li>

            <li>
              Provide protocol tracking, calculations, charts, timelines,
              reminders, reports, lab features, and user-requested AI analysis.
            </li>

            <li>
              Receive and respond to support and privacy requests.
            </li>

            <li>
              Operate, secure, troubleshoot, and improve the reliability of the
              service.
            </li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Service providers</h2>

          <p style={copyStyle}>
            MyPepProtocol relies on service providers for specific operational
            purposes:
          </p>

          <ul style={listStyle}>
            <li>
              <strong>Supabase</strong> for database storage, authentication,
              owner-scoped application data, rate-limit counters, and
              privacy-scrubbed operational events.
            </li>

            <li>
              <strong>Vercel</strong> for application hosting and content
              delivery.
            </li>

            <li>
              <strong>Resend</strong> for transactional authentication email
              delivery where configured.
            </li>

            <li>
              <strong>SendGrid</strong> for support-request and support
              confirmation email delivery.
            </li>

            <li>
              <strong>ImprovMX</strong> for forwarding messages sent to the
              MyPepProtocol support email address.
            </li>

            <li>
              <strong>OpenAI</strong> when you explicitly request an
              AI-assisted analysis or report summary.
            </li>

            <li>
              Your browser or platform push service when you enable
              notifications.
            </li>
          </ul>

          <p style={copyStyle}>
            Provider access is limited to information needed to perform the
            relevant function. Provider handling is also governed by each
            provider&apos;s applicable terms and privacy practices.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Storage and security</h2>

          <p style={copyStyle}>
            Data is transmitted over HTTPS and application data is stored using
            the configured Supabase infrastructure. Access controls are used to
            scope application queries to the authenticated account.
          </p>

          <p style={copyStyle}>
            No online system can guarantee absolute security. Production
            access, infrastructure, logs, backups, third-party providers, and
            account credentials must also be protected and maintained
            appropriately.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Your choices and requests</h2>

          <ul style={listStyle}>
            <li>
              You can view and correct many records directly within the app.
            </li>

            <li>
              You can disable push reminders through MyPepProtocol and your
              browser or device settings.
            </li>

            <li>
              You can grant or revoke third-party AI processing permission from
              Profile.
            </li>

            <li>
              You can permanently delete your account through the account
              deletion feature in Profile.
            </li>

            <li>
              Account deletion removes active application records associated
              with your account, including protocols, health records, lab data,
              reminders, and profile settings, subject to operational backups,
              provider retention periods, security requirements, and
              applicable law.
            </li>

            <li>
              You may contact us to request access, correction, or assistance
              regarding your information.
            </li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Retention</h2>

          <p style={copyStyle}>
            Application records are retained while your account is active and
            as reasonably necessary to provide the service.
          </p>

          <p style={copyStyle}>
            Operational backups, security records, support communications, and
            third-party provider records may be retained according to their
            configured lifecycle, operational requirements, and applicable
            law.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Age and medical notice</h2>

          <p style={copyStyle}>
            MyPepProtocol is intended for adults. It is a tracking and
            informational tool, not a medical device, healthcare provider, or
            substitute for professional diagnosis, treatment, prescribing, or
            emergency care.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Changes to this policy</h2>

          <p style={copyStyle}>
            This Privacy Policy may be updated as MyPepProtocol changes. The
            “Last updated” date on this page identifies the current version.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={headingStyle}>Contact</h2>

          <p style={copyStyle}>
            For privacy questions or data requests, contact{' '}
            <a
              href="mailto:privacy@mypepprotocol.app"
              style={{ color: 'var(--color-green)' }}
            >
              privacy@mypepprotocol.app
            </a>
            .
          </p>

          <p style={copyStyle}>
            For general support, visit the{' '}
            <Link
              href="/support"
              style={{
                color: 'var(--color-green)',
                textDecoration: 'none',
              }}
            >
              Support page
            </Link>
            .
          </p>
        </section>

        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: '24px',
            marginTop: '40px',
          }}
        >
          <Link
            href="/terms"
            style={{
              color: 'var(--color-green)',
              textDecoration: 'none',
              fontSize: '14px',
              marginRight: '24px',
            }}
          >
            Terms of Use
          </Link>

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