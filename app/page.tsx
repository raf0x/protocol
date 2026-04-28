'use client'

import { useEffect, useState } from 'react'
import PeptideHoneycomb from '../components/PeptideHoneycomb'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

const scrollAnimStyles = `
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(40px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes ringPulse {
    0% { filter: drop-shadow(0 0 0px var(--color-green)); }
    50% { filter: drop-shadow(0 0 12px var(--color-green)); }
    100% { filter: drop-shadow(0 0 4px var(--color-green)); }
  }
  @keyframes checkFlash {
    0% { color: var(--color-green); transform: scale(1); }
    50% { color: #fff; transform: scale(1.4); }
    100% { color: var(--color-green); transform: scale(1); }
  }
  @keyframes glowBorder {
    from { box-shadow: 0 0 0px rgba(108,99,255,0); border-color: #1e1e2e; }
    to { box-shadow: 0 0 20px rgba(108,99,255,0.3); border-color: rgba(108,99,255,0.5); }
  }
  @keyframes badgeShimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes ctaPulse {
    0%,100% { box-shadow: 0 0 0px var(--color-green-40); }
    50% { box-shadow: 0 0 30px var(--color-green-60); }
  }
  @keyframes syringeFill {
    0%     { clip-path: inset(0 100% 0 0); }
    55%    { clip-path: inset(0 0% 0 0); }
    80%    { clip-path: inset(0 0% 0 0); }
    100%   { clip-path: inset(0 100% 0 0); }
  }

  .scroll-hidden { opacity: 0; transform: translateY(40px); transition: opacity 0.7s ease, transform 0.7s ease, box-shadow 0.7s ease, border-color 0.7s ease; }
  .scroll-visible { opacity: 1; transform: translateY(0); }
  .scroll-visible.glow-card { box-shadow: 0 0 24px rgba(108,99,255,0.25); border-color: rgba(108,99,255,0.4) !important; }
  .stagger-1 { transition-delay: 0.1s; }
  .stagger-2 { transition-delay: 0.25s; }
  .stagger-3 { transition-delay: 0.4s; }
  .stagger-4 { transition-delay: 0.55s; }
  .ring-animate { animation: ringPulse 2s ease-in-out 0.5s 2; }
  .badge-shimmer {
    background: linear-gradient(90deg, rgba(108,99,255,0.2) 0%, rgba(167,139,250,0.5) 50%, rgba(108,99,255,0.2) 100%);
    background-size: 200% auto;
    animation: badgeShimmer 3s linear infinite;
  }
  .cta-pulse { animation: ctaPulse 2s ease-in-out infinite; }
`;

export default function Home() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function checkUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.push('/protocol')
      else setChecking(false)
    }
    checkUser()
  }, [])

  useEffect(() => {
    if (checking) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('scroll-visible')
          if (entry.target.classList.contains('glow-card')) {
            entry.target.classList.add('glow-card')
          }
        }
      })
    }, { threshold: 0.15 })
    document.querySelectorAll('.scroll-hidden').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [checking])

  if (checking) return <main style={{minHeight:'100vh',background:'var(--color-bg)'}} />

  return (
    <main style={{minHeight:'100vh',background:'var(--color-bg)',color:'var(--color-text)',fontFamily:'Inter,sans-serif',overflowX:'hidden'}}>
      <style dangerouslySetInnerHTML={{__html: scrollAnimStyles}} />

      {/* Nav */}
      <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid var(--color-border)',position:'sticky',top:0,background:'var(--color-nav-blur)',backdropFilter:'blur(12px)',zIndex:50}}>
        <span style={{fontSize:'20px',fontWeight:'800',color:'var(--color-green)',letterSpacing:'2px'}}>PROTOCOL</span>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <a href='/auth/login' style={{background:'var(--color-green)',color:'#000000',textDecoration:'none',fontWeight:'700',padding:'8px 20px',borderRadius:'6px',fontSize:'14px',whiteSpace:'nowrap'}}>Sign in</a>
        </div>
      </nav>

      {/* Hero */}
      <section style={{padding:'60px 24px 40px',maxWidth:'640px',margin:'0 auto',textAlign:'center',position:'relative',overflow:'hidden'}}>

        {/* Left ticker */}
        <div style={{position:'absolute',left:'0px',top:'0',bottom:'0',width:'44px',overflow:'hidden',opacity:0.4,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <style>{'@keyframes tickerDown{0%{transform:translateY(-50%)}100%{transform:translateY(0%)}}'}</style>
          <div style={{animation:'tickerDown 12s linear infinite',display:'flex',flexDirection:'column',gap:'20px',alignItems:'center'}}>
            <span style={{fontSize:'22px',display:'block',marginBottom:'8px',transform:'rotate(180deg)'}}>💉</span>
            {['BPC-157','TB-500','CJC-1295','AOD-9604','GHK-Cu','Ipamorelin','BPC-157','TB-500','CJC-1295','AOD-9604','GHK-Cu','Ipamorelin'].map((name,i) => (
              <span key={i} style={{fontSize:'10px',color:'var(--color-green)',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed',whiteSpace:'nowrap'}}>{name}</span>
            ))}
          </div>
        </div>

        {/* Right ticker */}
        <div style={{position:'absolute',right:'0px',top:'0',bottom:'0',width:'44px',overflow:'hidden',opacity:0.4,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <style>{'@keyframes tickerDown2{0%{transform:translateY(-50%)}100%{transform:translateY(0%)}}'}</style>
          <div style={{animation:'tickerDown2 12s linear infinite',display:'flex',flexDirection:'column',gap:'20px',alignItems:'center'}}>
            <span style={{fontSize:'22px',display:'block',marginBottom:'8px',transform:'rotate(180deg)'}}>💉</span>
            {['GLP-1','Tirzepatide','Semaglutide','Retatrutide','TRT','HCG','GLP-1','Tirzepatide','Semaglutide','Retatrutide','TRT','HCG'].map((name,i) => (
              <span key={i} style={{fontSize:'10px',color:'var(--color-green)',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed',whiteSpace:'nowrap'}}>{name}</span>
            ))}
          </div>
        </div>

        {/* Hero content */}
        <div style={{position:'relative',zIndex:1,padding:'0 52px'}}>
          <div style={{display:'inline-block',background:'rgba(108,99,255,0.2)',border:'1px solid rgba(108,99,255,0.5)',borderRadius:'24px',padding:'10px 24px',fontSize:'15px',color:'#a78bfa',fontWeight:'800',marginBottom:'28px',letterSpacing:'2px'}}>EARLY ACCESS</div>
          <div style={{marginBottom:'28px'}}>
            <div style={{display:'flex',justifyContent:'center'}}>
              <div style={{position:'relative',display:'inline-block'}}>
                <h1 style={{fontSize:'clamp(52px,14vw,96px)',fontWeight:'900',lineHeight:'1',letterSpacing:'-3px',WebkitTextStroke:'2px var(--color-green)',color:'transparent',margin:0,display:'block',userSelect:'none',whiteSpace:'nowrap'}}>Protocol</h1>
                <h1 aria-hidden='true' style={{fontSize:'clamp(52px,14vw,96px)',fontWeight:'900',lineHeight:'1',letterSpacing:'-3px',color:'var(--color-green)',position:'absolute',top:0,left:0,margin:0,display:'block',animation:'syringeFill 4s ease-in-out infinite',clipPath:'inset(0 100% 0 0)',textShadow:'0 0 40px var(--color-green-60)',whiteSpace:'nowrap'}}>Protocol</h1>
              </div>
            </div>
          </div>
          <p style={{fontSize:'clamp(16px,4vw,22px)',fontWeight:'700',color:'var(--color-text)',marginBottom:'10px',lineHeight:'1.3'}}>Stop guessing your protocol.</p>
          <p style={{fontSize:'clamp(16px,4vw,22px)',fontWeight:'700',color:'var(--color-green)',marginBottom:'20px',lineHeight:'1.3'}}>Start knowing what works.</p>
          <p style={{fontSize:'18px',color:'#8b8ba7',lineHeight:'1.7',marginBottom:'36px',maxWidth:'480px',margin:'0 auto 36px'}}>Track → Analyze → Optimize. The private protocol tracker for peptide and GLP-1 users. Not just logging — real insights.</p>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'12px'}}>
          <a href='/demo' style={{background:'var(--color-green)',color:'var(--color-green-text)',textDecoration:'none',fontWeight:'800',padding:'16px 48px',borderRadius:'8px',fontSize:'18px',letterSpacing:'0.5px',textAlign:'center',width:'100%',maxWidth:'320px',boxSizing:'border-box',display:'block'}}>See it in action →</a>
          <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap'}}>
            <a href='/auth/login' style={{background:'var(--color-text)',color:'var(--color-bg)',textDecoration:'none',fontWeight:'800',padding:'12px 24px',borderRadius:'8px',fontSize:'14px'}}>Get early access</a>
            <a href='/calculator' style={{background:'transparent',color:'#8b8ba7',textDecoration:'none',fontWeight:'600',padding:'12px 24px',borderRadius:'8px',fontSize:'14px',border:'1px solid #1e1e2e'}}>Try the calculator →</a>
          </div>
        </div>
        </div>
      </section>

      {/* Product screenshot */}
      <section style={{padding:'20px 24px 60px',maxWidth:'480px',margin:'0 auto',textAlign:'center'}}>
        <p className='scroll-hidden' style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'20px'}}>SEE YOUR PROGRESS</p>
        <div className='scroll-hidden stagger-1' style={{borderRadius:'24px',overflow:'hidden',border:'1px solid var(--color-border)',boxShadow:'0 20px 60px rgba(108,99,255,0.15)',background:'var(--color-card)'}}>
          <img src='/journal-screenshot3.png' alt='Protocol Journal showing weight tracking, mood/energy/sleep charts, and weekly stats' style={{width:'100%',display:'block'}} />
        </div>
        <p className='scroll-hidden stagger-2' style={{fontSize:'14px',color:'#8b8ba7',marginTop:'16px',lineHeight:'1.6'}}>Real data. Real trends. Real insights.</p>
      </section>

      {/* Problem */}
      <section style={{padding:'60px 24px',maxWidth:'640px',margin:'0 auto',textAlign:'center'}}>
        <p className='scroll-hidden' style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'16px'}}>THE PROBLEM</p>
        <h2 className='scroll-hidden stagger-1' style={{fontSize:'28px',fontWeight:'800',marginBottom:'16px',lineHeight:'1.3'}}>Most health apps weren't built for this.</h2>
        <p className='scroll-hidden stagger-2' style={{fontSize:'16px',color:'#8b8ba7',lineHeight:'1.7'}}>Generic fitness trackers don't understand peptide protocols. Reddit threads disappear. Spreadsheets don't give you insights. You deserve a tool built specifically for how you actually manage your wellness.</p>
      </section>

      {/* Features */}
      <section style={{padding:'40px 24px 80px',maxWidth:'720px',margin:'0 auto'}}>
        <p id='features' style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'40px',textAlign:'center',scrollMarginTop:'80px'}}>WHAT YOU GET</p>
        <div style={{display:'grid',gap:'16px'}}>
          <div className='scroll-hidden glow-card' style={{background:'var(--color-card)',border:'1px solid var(--color-border)',borderRadius:'12px',padding:'28px'}}>
            <div style={{fontSize:'28px',marginBottom:'12px'}}>📓</div>
            <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'8px',color:'var(--color-green)'}}>Smart Journal</h3>
            <p style={{color:'#8b8ba7',lineHeight:'1.6',fontSize:'15px'}}>Mood, energy, sleep, hunger, weight — logged in seconds. Real-time insights tell you what's working and what's not.</p>
          </div>
          <div className='scroll-hidden glow-card stagger-1' style={{background:'var(--color-card)',border:'1px solid var(--color-border)',borderRadius:'12px',padding:'28px'}}>
            <div style={{fontSize:'28px',marginBottom:'12px'}}>⚗️</div>
            <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'8px',color:'var(--color-green)'}}>Protocol Dashboard</h3>
            <p style={{color:'#8b8ba7',lineHeight:'1.6',fontSize:'15px'}}>Your daily command center. Active compounds, injection checklist, insights, and progress — all in one scroll.</p>
          </div>
          <div className='scroll-hidden glow-card stagger-2' style={{background:'var(--color-card)',border:'1px solid var(--color-border)',borderRadius:'12px',padding:'28px'}}>
            <div style={{fontSize:'28px',marginBottom:'12px'}}>👥</div>
            <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'8px',color:'var(--color-green)'}}>Private Community</h3>
            <p style={{color:'#8b8ba7',lineHeight:'1.6',fontSize:'15px'}}>Anonymous cohorts for GLP-1, peptides, and TRT users. Real experiences from real people. No vendors, no noise, no exposure.</p>
          </div>
        </div>
      </section>

      {/* Peptide Honeycomb */}
      <section style={{padding:'40px 0 60px',overflowX:'hidden'}}>
        <p className='scroll-hidden' style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'8px',textAlign:'center'}}>THE PEPTIDE UNIVERSE</p>
        <h2 className='scroll-hidden stagger-1' style={{fontSize:'22px',fontWeight:'800',marginBottom:'6px',textAlign:'center',color:'white'}}>Track any compound in your stack</h2>
        <p className='scroll-hidden stagger-2' style={{fontSize:'14px',color:'#8b8ba7',marginBottom:'28px',textAlign:'center',padding:'0 24px'}}>Protocol supports every major peptide and GLP-1. Your data stays private.</p>
        <div className='scroll-hidden stagger-3'>
          <PeptideHoneycomb />
        </div>
      </section>

      {/* Old Way vs Protocol */}
      <section className='scroll-hidden' style={{padding:'40px 24px 60px',maxWidth:'640px',margin:'0 auto'}}>
        <p style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'24px',textAlign:'center'}}>WHY PROTOCOL</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0',borderRadius:'12px',overflow:'hidden',border:'1px solid var(--color-border)'}}>
          <div style={{background:'var(--color-card)',padding:'20px'}}>
            <p style={{fontSize:'13px',fontWeight:'700',color:'#ff6b6b',marginBottom:'14px'}}>The Old Way</p>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {['Guessing if it works','Forgetting doses','Spreadsheet chaos','No trends or insights','Scattered Reddit threads'].map(item => (
                <div key={item} style={{display:'flex',gap:'8px',alignItems:'center',fontSize:'12px',color:'#8b8ba7'}}>
                  <span style={{color:'#ff6b6b'}}>✕</span> {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{background:'rgba(57,255,20,0.03)',padding:'20px',borderLeft:'1px solid var(--color-border)'}}>
            <p style={{fontSize:'13px',fontWeight:'700',color:'var(--color-green)',marginBottom:'14px'}}>With Protocol</p>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {['See what actually works','Injection reminders','Phase-based tracking','Real-time insights','Private community'].map(item => (
                <div key={item} style={{display:'flex',gap:'8px',alignItems:'center',fontSize:'12px',color:'#8b8ba7'}}>
                  <span style={{color:'var(--color-green)'}}>✓</span> {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section style={{padding:'60px 24px',background:'rgba(108,99,255,0.05)',borderTop:'1px solid var(--color-border)',borderBottom:'1px solid var(--color-border)',textAlign:'center'}}>
        <h2 className='scroll-hidden' style={{fontSize:'28px',fontWeight:'800',marginBottom:'16px'}}>Privacy isn't a feature.<br/>It's the foundation.</h2>
        <p className='scroll-hidden stagger-1' style={{fontSize:'16px',color:'#8b8ba7',lineHeight:'1.7',maxWidth:'480px',margin:'0 auto 32px'}}>Your protocols, your journal, your data — none of it is ever sold, shared, or used for advertising. Protocol is a tool you own, not a platform that owns you.</p>
        <div style={{display:'flex',gap:'24px',justifyContent:'center',flexWrap:'wrap'}}>
          {['No ads ever','No data selling','End-to-end private','You own your data'].map(item => (
            <div key={item} style={{display:'flex',alignItems:'center',gap:'8px',color:'#8b8ba7',fontSize:'14px'}}>
              <span style={{color:'var(--color-green)',fontWeight:'700'}}>✓</span> {item}
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section style={{padding:'60px 24px',maxWidth:'640px',margin:'0 auto'}}>
        <p id='faq' className='scroll-hidden' style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'24px',textAlign:'center',scrollMarginTop:'80px'}}>QUESTIONS</p>
        {[
          { q: 'Is this medical advice?', a: 'No. Protocol is a personal tracking tool. It does not recommend doses, suggest compounds, or provide medical guidance. Always consult a qualified healthcare provider.' },
          { q: 'Is my data private?', a: 'Yes. Your protocols, journal entries, and health data are visible only to you. We never sell, share, or use your data for advertising. Period.' },
          { q: 'What can I track?', a: 'Compounds with dose phases, injection schedules, mood, energy, sleep, hunger, weight, and discomfort. The app shows insights and trends over time.' },
          { q: 'Does it work on iPhone?', a: 'Yes. Protocol is a Progressive Web App — add it to your home screen from Safari and it works like a native app. No App Store needed.' },
          { q: 'Is it free?', a: 'Free during early access. No credit card required.' },
        ].map((item, i) => (
          <div key={i} className={'scroll-hidden stagger-' + Math.min(i + 1, 4)} style={{borderBottom:'1px solid var(--color-border)',padding:'16px 0'}}>
            <h3 style={{fontSize:'15px',fontWeight:'700',color:'var(--color-text)',marginBottom:'8px'}}>{item.q}</h3>
            <p style={{fontSize:'14px',color:'#8b8ba7',lineHeight:'1.6',margin:0}}>{item.a}</p>
          </div>
        ))}
      </section>

      {/* Final CTA */}
      <section style={{padding:'80px 24px',textAlign:'center',maxWidth:'480px',margin:'0 auto'}}>
        <h2 className='scroll-hidden' style={{fontSize:'32px',fontWeight:'900',marginBottom:'16px',lineHeight:'1.2'}}>Start tracking what<br/><span style={{color:'var(--color-green)'}}>actually matters.</span></h2>
        <p style={{color:'#8b8ba7',marginBottom:'32px',fontSize:'16px'}}>Free during early access. No credit card required.</p>
        <a href='/auth/login' className='cta-pulse scroll-hidden' style={{background:'var(--color-green)',color:'#000000',textDecoration:'none',fontWeight:'800',padding:'18px 48px',borderRadius:'8px',fontSize:'18px',display:'inline-block'}}>Get started free</a>
      </section>

      {/* Footer */}
      <footer style={{borderTop:'1px solid var(--color-border)',padding:'24px',textAlign:'center'}}>
        <p style={{color:'#3d3d5c',fontSize:'13px'}}>© 2026 Protocol · <a href='/learn' style={{color:'#3d3d5c',textDecoration:'none'}}>Harm Reduction</a> · <a href='/calculator' style={{color:'#3d3d5c',textDecoration:'none'}}>Calculator</a></p>
        <p style={{color:'#3d3d5c',fontSize:'11px',marginTop:'8px'}}>Not medical advice. For personal harm reduction tracking only.</p>
      </footer>

    </main>
  )
}