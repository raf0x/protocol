import Link from 'next/link'

const sectionStyle = { marginBottom: '32px' }
const headingStyle = { fontSize: '20px', fontWeight: 700, marginBottom: '12px' }
const copyStyle = { color: 'var(--color-dim)', lineHeight: 1.7, marginBottom: '12px' }
const listStyle = { color: 'var(--color-dim)', lineHeight: 1.7, paddingLeft: '20px' }

export default function PrivacyPolicy() {
  return <main style={{minHeight:'100dvh',background:'var(--color-bg)',color:'var(--color-text)',padding:'max(40px, env(safe-area-inset-top, 0px)) 24px max(40px, env(safe-area-inset-bottom, 0px))'}}>
    <div style={{maxWidth:'720px',margin:'0 auto'}}>
      <h1 style={{fontSize:'32px',fontWeight:900,marginBottom:'8px'}}>Privacy Policy</h1>
      <p style={{color:'var(--color-muted)',fontSize:'14px',marginBottom:'32px'}}>Last updated: September 11, 2026</p>

      <section style={sectionStyle}><h2 style={headingStyle}>Overview</h2><p style={copyStyle}>MyPepProtocol is a private protocol and longitudinal health tracking tool. This policy describes the information the current app processes to provide its features. We do not sell personal data or use advertising trackers.</p></section>

      <section style={sectionStyle}><h2 style={headingStyle}>Information processed</h2><ul style={listStyle}>
        <li>Account details, including email address, account identifier, and authentication timestamps.</li>
        <li>Protocol records, compounds, dosing and administration details, schedules, phases, inventory, notes, and recorded protocol events.</li>
        <li>Journal and wellness entries you provide, such as weight, sleep, energy, mood, hunger, and notes.</li>
        <li>Lab panels and results you enter or import, including dates, values, units, reference ranges, providers, filenames, and import provenance.</li>
        <li>Push subscription endpoint and reminder hour when you enable browser notifications.</li>
        <li>Network and diagnostic metadata that hosting and service providers necessarily process to deliver and protect the service.</li>
        <li>Privacy-scrubbed operational events limited to route, error type, status, release, timestamp, and a random request identifier. These exclude health values, notes, payloads, account identifiers, and error messages or stacks.</li>
      </ul></section>

      <section style={sectionStyle}><h2 style={headingStyle}>AI-assisted features</h2><p style={copyStyle}>AI Health Analyst and optional report summaries run only when you request them and after you explicitly allow AI processing. The app sends a minimized selection of relevant recorded health evidence and your question or report context to OpenAI to generate the requested output. AI output can be incomplete or inaccurate and is not medical advice or a substitute for professional medical care. The app does not save generated analyst answers or report summaries to its database. You can revoke AI processing permission in Profile; factual non-AI reports and other Health features remain available.</p></section>

      <section style={sectionStyle}><h2 style={headingStyle}>Reports and imports</h2><p style={copyStyle}>Doctor-ready reports are assembled in your browser and exported through the browser print dialog. The app does not upload or store the generated PDF. CSV and PDF lab files are parsed for the import workflow; review imported values before saving them to your account.</p></section>

      <section style={sectionStyle}><h2 style={headingStyle}>How information is used</h2><ul style={listStyle}>
        <li>Authenticate you and keep your records scoped to your account.</li>
        <li>Provide tracking, calculations, charts, timelines, reminders, reports, and user-requested AI analysis.</li>
        <li>Operate, secure, troubleshoot, and improve app reliability.</li>
      </ul></section>

      <section style={sectionStyle}><h2 style={headingStyle}>Service providers</h2><p style={copyStyle}>The app relies on service providers for specific operational purposes:</p><ul style={listStyle}>
        <li><strong>Supabase</strong> for database storage, authentication, owner-scoped rate-limit counters, and privacy-scrubbed operational events.</li>
        <li><strong>Vercel</strong> for web hosting and content delivery.</li>
        <li><strong>Resend</strong> for transactional authentication email delivery.</li>
        <li><strong>OpenAI</strong> when you request an AI-assisted analysis or report summary.</li>
        <li>Your browser push service when you enable notifications.</li>
      </ul><p style={copyStyle}>Provider access is limited to information needed to perform the requested function. Provider handling is also governed by the provider’s applicable terms and privacy practices.</p></section>

      <section style={sectionStyle}><h2 style={headingStyle}>Storage and security</h2><p style={copyStyle}>Data is transmitted over HTTPS and stored with the app’s configured Supabase project. Access controls scope application queries to the authenticated account. No system can guarantee absolute security, so production access, logs, backups, and provider settings must also be maintained appropriately.</p></section>

      <section style={sectionStyle}><h2 style={headingStyle}>Your choices and requests</h2><ul style={listStyle}>
        <li>You can view and correct many records directly in the app.</li>
        <li>You can disable push reminders from Profile and browser settings.</li>
        <li>You can grant or revoke third-party AI processing permission from Profile.</li>
        <li>You can permanently delete your account and its active application records from Profile. This removes protocols, health records, Labs data, reminders, and profile settings.</li>
        <li>You can request access, export, or correction by contacting us.</li>
      </ul><p style={copyStyle}>Records are retained while your account is active and as needed to operate the service. Operational backups and provider retention may follow their configured lifecycle and applicable requirements.</p></section>

      <section style={sectionStyle}><h2 style={headingStyle}>Age and medical notice</h2><p style={copyStyle}>MyPepProtocol is intended for adults. It is a tracking and informational tool, not a medical device or substitute for professional diagnosis, treatment, or emergency care.</p></section>

      <section style={sectionStyle}><h2 style={headingStyle}>Contact</h2><p style={copyStyle}>For privacy questions or data requests, email <a href="mailto:privacy@mypepprotocol.app" style={{color:'var(--color-green)'}}>privacy@mypepprotocol.app</a>.</p></section>

      <div style={{borderTop:'1px solid var(--color-border)',paddingTop:'24px',marginTop:'40px'}}><Link href="/" style={{color:'var(--color-green)',textDecoration:'none',fontSize:'14px'}}>← Back to MyPepProtocol</Link></div>
    </div>
  </main>
}
