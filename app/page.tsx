'use client'

import { useEffect, useState } from 'react'
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
    0% { filter: drop-shadow(0 0 0px #39ff14); }
    50% { filter: drop-shadow(0 0 12px #39ff14); }
    100% { filter: drop-shadow(0 0 4px #39ff14); }
  }
  @keyframes checkFlash {
    0% { color: #39ff14; transform: scale(1); }
    50% { color: #fff; transform: scale(1.4); }
    100% { color: #39ff14; transform: scale(1); }
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
    0%,100% { box-shadow: 0 0 0px rgba(57,255,20,0.4); }
    50% { box-shadow: 0 0 30px rgba(57,255,20,0.6); }
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

  if (checking) return <main style={{minHeight:'100vh',background:'#0a0a0f'}} />

  return (
    <main style={{minHeight:'100vh',background:'#0a0a0f',color:'white',fontFamily:'Inter,sans-serif',overflowX:'hidden'}}>
      <style dangerouslySetInnerHTML={{__html: scrollAnimStyles}} />

      {/* Nav */}
      <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid #1e1e2e',position:'sticky',top:0,background:'rgba(10,10,15,0.9)',backdropFilter:'blur(12px)',zIndex:50}}>
        <span style={{fontSize:'20px',fontWeight:'800',color:'#39ff14',letterSpacing:'2px'}}>PROTOCOL</span>
        <a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'700',padding:'8px 20px',borderRadius:'6px',fontSize:'14px'}}>Sign in</a>
      </nav>

      {/* Hero */}
      <section style={{padding:'80px 24px 60px',maxWidth:'640px',margin:'0 auto',textAlign:'center',position:'relative',overflow:'hidden'}}>

        {/* Left ticker */}
        <div style={{position:'absolute',left:'0px',top:'0',bottom:'0',width:'44px',overflow:'hidden',opacity:0.4,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <style>{'@keyframes tickerDown{0%{transform:translateY(-50%)}100%{transform:translateY(0%)}}'}</style>
          <div style={{animation:'tickerDown 12s linear infinite',display:'flex',flexDirection:'column',gap:'20px',alignItems:'center'}}>
            <span style={{fontSize:'22px',display:'block',marginBottom:'8px',transform:'rotate(180deg)'}}>💉</span>
            {['BPC-157','TB-500','CJC-1295','AOD-9604','GHK-Cu','Ipamorelin','BPC-157','TB-500','CJC-1295','AOD-9604','GHK-Cu','Ipamorelin'].map((name,i) => (
              <span key={i} style={{fontSize:'10px',color:'#39ff14',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed',whiteSpace:'nowrap'}}>{name}</span>
            ))}
          </div>
        </div>

        {/* Right ticker */}
        <div style={{position:'absolute',right:'0px',top:'0',bottom:'0',width:'44px',overflow:'hidden',opacity:0.4,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <style>{'@keyframes tickerDown2{0%{transform:translateY(-50%)}100%{transform:translateY(0%)}}'}</style>
          <div style={{animation:'tickerDown2 12s linear infinite',display:'flex',flexDirection:'column',gap:'20px',alignItems:'center'}}>
            <span style={{fontSize:'22px',display:'block',marginBottom:'8px',transform:'rotate(180deg)'}}>💉</span>
            {['GLP-1','Tirzepatide','Semaglutide','Retatrutide','TRT','HCG','GLP-1','Tirzepatide','Semaglutide','Retatrutide','TRT','HCG'].map((name,i) => (
              <span key={i} style={{fontSize:'10px',color:'#39ff14',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed',whiteSpace:'nowrap'}}>{name}</span>
            ))}
          </div>
        </div>

        {/* Background rings */}
        <div style={{position:'absolute',left:0,right:0,top:'130px',display:'flex',justifyContent:'center',pointerEvents:'none',zIndex:0}}>
          <svg width='500' height='120' viewBox='0 0 500 120' style={{opacity:0.22}} className='ring-animate'>
            <g transform='translate(120, 60)'>
              <circle cx='0' cy='0' r='30' fill='none' stroke='#1e1e2e' strokeWidth='5'/>
              <circle cx='0' cy='0' r='30' fill='none' stroke='#f59e0b' strokeWidth='5' strokeDasharray='188' strokeDashoffset='47' strokeLinecap='round' transform='rotate(-90)'/>
              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='10' fontWeight='800'>3.8</text>
              <text x='0' y='10' textAnchor='middle' dominantBaseline='middle' fill='#f59e0b' fontSize='7' fontWeight='600'>ENERGY</text>
            </g>
            <g transform='translate(250, 60)'>
              <circle cx='0' cy='0' r='34' fill='none' stroke='#1e1e2e' strokeWidth='5'/>
              <circle cx='0' cy='0' r='34' fill='none' stroke='#8b5cf6' strokeWidth='5' strokeDasharray='214' strokeDashoffset='60' strokeLinecap='round' transform='rotate(-90)'/>
              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='11' fontWeight='800'>7.5h</text>
              <text x='0' y='11' textAnchor='middle' dominantBaseline='middle' fill='#8b5cf6' fontSize='7' fontWeight='600'>SLEEP</text>
            </g>
            <g transform='translate(380, 60)'>
              <circle cx='0' cy='0' r='30' fill='none' stroke='#1e1e2e' strokeWidth='5'/>
              <circle cx='0' cy='0' r='30' fill='none' stroke='#39ff14' strokeWidth='5' strokeDasharray='188' strokeDashoffset='27' strokeLinecap='round' transform='rotate(-90)'/>
              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='10' fontWeight='800'>6/7</text>
              <text x='0' y='10' textAnchor='middle' dominantBaseline='middle' fill='#39ff14' fontSize='7' fontWeight='600'>STREAK</text>
            </g>
          </svg>
        </div>

        {/* Hero content */}
        <div style={{position:'relative',zIndex:1,padding:'0 52px'}}>
          <div style={{display:'inline-block',background:'rgba(108,99,255,0.2)',border:'1px solid rgba(108,99,255,0.5)',borderRadius:'24px',padding:'10px 24px',fontSize:'15px',color:'#a78bfa',fontWeight:'800',marginBottom:'80px',letterSpacing:'2px'}}>EARLY ACCESS</div>
          <h1 style={{fontSize:'clamp(36px,8vw,64px)',fontWeight:'900',lineHeight:'1.1',marginBottom:'20px',letterSpacing:'-1px'}}>Track your protocol.<br/><span style={{color:'#39ff14'}}>Own your data.</span></h1>
          <p style={{fontSize:'18px',color:'#8b8ba7',lineHeight:'1.7',marginBottom:'36px',maxWidth:'480px',margin:'0 auto 36px'}}>The private wellness tracker built for people managing peptide and GLP-1 protocols. No ads. No data selling. Just signal.</p>
          <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap'}}>
            <a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'800',padding:'16px 36px',borderRadius:'8px',fontSize:'16px',letterSpacing:'0.5px'}}>Get early access</a>
            <a href='/calculator' style={{background:'transparent',color:'#8b8ba7',textDecoration:'none',fontWeight:'600',padding:'16px 24px',borderRadius:'8px',fontSize:'16px',border:'1px solid #1e1e2e'}}>Try the calculator →</a>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section style={{padding:'60px 24px',maxWidth:'640px',margin:'0 auto',textAlign:'center'}}>
        <p className='scroll-hidden' style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'16px'}}>THE PROBLEM</p>
        <h2 className='scroll-hidden stagger-1' style={{fontSize:'28px',fontWeight:'800',marginBottom:'16px',lineHeight:'1.3'}}>Most health apps weren't built for this.</h2>
        <p className='scroll-hidden stagger-2' style={{fontSize:'16px',color:'#8b8ba7',lineHeight:'1.7'}}>Generic fitness trackers don't understand peptide protocols. Reddit threads disappear. Spreadsheets don't give you insights. You deserve a tool built specifically for how you actually manage your wellness.</p>
      </section>

      {/* Features */}
      <section style={{padding:'40px 24px 80px',maxWidth:'720px',margin:'0 auto'}}>
        <p style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'40px',textAlign:'center'}}>WHAT YOU GET</p>
        <div style={{display:'grid',gap:'16px'}}>
          <div className='scroll-hidden glow-card' style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',padding:'28px'}}>
            <div style={{fontSize:'28px',marginBottom:'12px'}}>📓</div>
            <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'8px',color:'#39ff14'}}>Smart Journal</h3>
            <p style={{color:'#8b8ba7',lineHeight:'1.6',fontSize:'15px'}}>Log your mood, energy, and sleep daily. Watch patterns emerge over time with trend charts, weekly comparisons, and streak tracking. Understand what's actually working.</p>
          </div>
          <div className='scroll-hidden glow-card stagger-1' style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',padding:'28px'}}>
            <div style={{fontSize:'28px',marginBottom:'12px'}}>⚗️</div>
            <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'8px',color:'#39ff14'}}>Protocol Builder</h3>
            <p style={{color:'#8b8ba7',lineHeight:'1.6',fontSize:'15px'}}>Build and manage your protocols with compound tracking, dosing schedules, and frequency settings. The reconstitution calculator handles the math so you don't have to.</p>
          </div>
          <div className='scroll-hidden glow-card stagger-2' style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',padding:'28px'}}>
            <div style={{fontSize:'28px',marginBottom:'12px'}}>👥</div>
            <h3 style={{fontSize:'20px',fontWeight:'700',marginBottom:'8px',color:'#39ff14'}}>Private Community</h3>
            <p style={{color:'#8b8ba7',lineHeight:'1.6',fontSize:'15px'}}>Join cohorts matched to your protocols — GLP-1s, peptides, TRT, and more. Read real experiences from others anonymously. No vendor talk. No noise.</p>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section style={{padding:'60px 24px',background:'rgba(108,99,255,0.05)',borderTop:'1px solid #1e1e2e',borderBottom:'1px solid #1e1e2e',textAlign:'center'}}>
        <h2 className='scroll-hidden' style={{fontSize:'28px',fontWeight:'800',marginBottom:'16px'}}>Privacy isn't a feature.<br/>It's the foundation.</h2>
        <p className='scroll-hidden stagger-1' style={{fontSize:'16px',color:'#8b8ba7',lineHeight:'1.7',maxWidth:'480px',margin:'0 auto 32px'}}>Your protocols, your journal, your data — none of it is ever sold, shared, or used for advertising. Protocol is a tool you own, not a platform that owns you.</p>
        <div style={{display:'flex',gap:'24px',justifyContent:'center',flexWrap:'wrap'}}>
          {['No ads ever','No data selling','End-to-end private','You own your data'].map(item => (
            <div key={item} style={{display:'flex',alignItems:'center',gap:'8px',color:'#8b8ba7',fontSize:'14px'}}>
              <span style={{color:'#39ff14',fontWeight:'700'}}>✓</span> {item}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{padding:'80px 24px',textAlign:'center',maxWidth:'480px',margin:'0 auto'}}>
        <h2 className='scroll-hidden' style={{fontSize:'32px',fontWeight:'900',marginBottom:'16px',lineHeight:'1.2'}}>Start tracking what<br/><span style={{color:'#39ff14'}}>actually matters.</span></h2>
        <p style={{color:'#8b8ba7',marginBottom:'32px',fontSize:'16px'}}>Free during early access. No credit card required.</p>
        <a href='/auth/login' className='cta-pulse scroll-hidden' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'800',padding:'18px 48px',borderRadius:'8px',fontSize:'18px',display:'inline-block'}}>Get started free</a>
      </section>

      {/* Footer */}
      <footer style={{borderTop:'1px solid #1e1e2e',padding:'24px',textAlign:'center'}}>
        <p style={{color:'#3d3d5c',fontSize:'13px'}}>© 2026 Protocol · <a href='/learn' style={{color:'#3d3d5c',textDecoration:'none'}}>Harm Reduction</a> · <a href='/calculator' style={{color:'#3d3d5c',textDecoration:'none'}}>Calculator</a></p>
        <p style={{color:'#3d3d5c',fontSize:'11px',marginTop:'8px'}}>Not medical advice. For personal harm reduction tracking only.</p>
      </footer>

    </main>
  )
}