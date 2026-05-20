export default function PrivacyPolicy() {
  return (
    <main style={{minHeight:'100vh',background:'var(--color-bg)',color:'var(--color-text)',padding:'40px 24px'}}>
      <div style={{maxWidth:'720px',margin:'0 auto'}}>
        <h1 style={{fontSize:'32px',fontWeight:'900',marginBottom:'8px'}}>Privacy Policy</h1>
        <p style={{color:'#8b8ba7',fontSize:'14px',marginBottom:'32px'}}>Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>

        <section style={{marginBottom:'32px'}}>
          <h2 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px'}}>Overview</h2>
          <p style={{color:'#8b8ba7',lineHeight:'1.7',marginBottom:'12px'}}>
            Protocol is a personal wellness tracking tool. We collect only the data necessary to provide you with a functional tracking experience. Your data is yours — we do not sell, share, or use it for advertising.
          </p>
        </section>

        <section style={{marginBottom:'32px'}}>
          <h2 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px'}}>Information We Collect</h2>
          
          <h3 style={{fontSize:'16px',fontWeight:'700',marginTop:'16px',marginBottom:'8px'}}>Account Information</h3>
          <ul style={{color:'#8b8ba7',lineHeight:'1.7',paddingLeft:'20px'}}>
            <li>Email address (for authentication)</li>
            <li>Account ID (automatically generated)</li>
            <li>Sign-up date and last login timestamp</li>
          </ul>

          <h3 style={{fontSize:'16px',fontWeight:'700',marginTop:'16px',marginBottom:'8px'}}>Health & Wellness Data</h3>
          <ul style={{color:'#8b8ba7',lineHeight:'1.7',paddingLeft:'20px'}}>
            <li>Weight measurements</li>
            <li>Mood ratings (1-10 scale)</li>
            <li>Energy levels (1-10 scale)</li>
            <li>Sleep duration (hours)</li>
            <li>Hunger levels (1-10 scale)</li>
            <li>Freeform notes you choose to enter</li>
          </ul>

          <h3 style={{fontSize:'16px',fontWeight:'700',marginTop:'16px',marginBottom:'8px'}}>Protocol Data</h3>
          <ul style={{color:'#8b8ba7',lineHeight:'1.7',paddingLeft:'20px'}}>
            <li>Compound names you enter</li>
            <li>Dosage information you specify</li>
            <li>Frequency and schedules you set</li>
            <li>Start dates and protocol notes</li>
          </ul>

          <p style={{color:'#8b8ba7',lineHeight:'1.7',marginTop:'12px'}}>
            <strong>We do not collect:</strong> Location data, browsing history, device fingerprints, IP addresses, or any tracking identifiers. We do not use analytics or third-party tracking scripts.
          </p>
        </section>

        <section style={{marginBottom:'32px'}}>
          <h2 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px'}}>How We Use Your Information</h2>
          <ul style={{color:'#8b8ba7',lineHeight:'1.7',paddingLeft:'20px'}}>
            <li>To provide you with protocol tracking and journaling functionality</li>
            <li>To display your data back to you in charts and summaries</li>
            <li>To send you authentication emails when you log in</li>
            <li>To maintain and improve the app's functionality</li>
          </ul>
          <p style={{color:'#8b8ba7',lineHeight:'1.7',marginTop:'12px'}}>
            <strong>We never:</strong> Sell your data, share it with advertisers, use it for marketing, or train AI models on your personal health information.
          </p>
        </section>

        <section style={{marginBottom:'32px'}}>
          <h2 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px'}}>Data Storage & Security</h2>
          <p style={{color:'#8b8ba7',lineHeight:'1.7',marginBottom:'12px'}}>
            Your data is stored on secure servers provided by Supabase (AWS US region). Data is encrypted in transit (HTTPS) and at rest using industry-standard encryption. Only you can access your data.
          </p>
        </section>

        <section style={{marginBottom:'32px'}}>
          <h2 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px'}}>Third-Party Services</h2>
          <p style={{color:'#8b8ba7',lineHeight:'1.7',marginBottom:'12px'}}>We use the following third-party services to operate Protocol:</p>
          <ul style={{color:'#8b8ba7',lineHeight:'1.7',paddingLeft:'20px'}}>
            <li><strong>Supabase</strong> — Database and authentication (hosted on AWS in the United States)</li>
            <li><strong>Vercel</strong> — Web hosting and content delivery</li>
            <li><strong>Resend</strong> — Transactional email delivery for authentication</li>
          </ul>
          <p style={{color:'#8b8ba7',lineHeight:'1.7',marginTop:'12px'}}>
            These services have access only to the data necessary to provide their specific function. We do not use analytics, advertising, or tracking services.
          </p>
        </section>

        <section style={{marginBottom:'32px'}}>
          <h2 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px'}}>Your Rights</h2>
          <ul style={{color:'#8b8ba7',lineHeight:'1.7',paddingLeft:'20px'}}>
            <li><strong>Access:</strong> You can view all your data within the app at any time</li>
            <li><strong>Export:</strong> Contact us to request a complete export of your data</li>
            <li><strong>Delete:</strong> You can delete your account and all associated data from your profile settings</li>
            <li><strong>Correct:</strong> You can edit or update any information in the app directly</li>
          </ul>
        </section>

        <section style={{marginBottom:'32px'}}>
          <h2 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px'}}>Data Retention</h2>
          <p style={{color:'#8b8ba7',lineHeight:'1.7',marginBottom:'12px'}}>
            When you delete your account, all your personal data is permanently removed from our systems within 30 days. Backups are overwritten within 90 days.
          </p>
        </section>

        <section style={{marginBottom:'32px'}}>
          <h2 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px'}}>Children's Privacy</h2>
          <p style={{color:'#8b8ba7',lineHeight:'1.7',marginBottom:'12px'}}>
            Protocol is intended for adults 18 years and older. We do not knowingly collect information from anyone under 18. If you believe a minor has created an account, contact us immediately.
          </p>
        </section>

        <section style={{marginBottom:'32px'}}>
          <h2 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px'}}>Changes to This Policy</h2>
          <p style={{color:'#8b8ba7',lineHeight:'1.7',marginBottom:'12px'}}>
            We may update this privacy policy as Protocol evolves. When we make changes, we will update the "Last updated" date at the top of this page. Continued use of the app after changes constitutes acceptance of the updated policy.
          </p>
        </section>

        <section style={{marginBottom:'32px'}}>
          <h2 style={{fontSize:'20px',fontWeight:'700',marginBottom:'12px'}}>Contact</h2>
          <p style={{color:'#8b8ba7',lineHeight:'1.7',marginBottom:'12px'}}>
            Questions about this privacy policy or your data? Contact us at: <a href='mailto:privacy@mypepprotocol.app' style={{color:'var(--color-green)',textDecoration:'none'}}>privacy@mypepprotocol.app</a>
          </p>
        </section>

        <div style={{borderTop:'1px solid var(--color-border)',paddingTop:'24px',marginTop:'40px'}}>
          <a href='/' style={{color:'var(--color-green)',textDecoration:'none',fontSize:'14px'}}>← Back to Protocol</a>
        </div>
      </div>
    </main>
  )
}
