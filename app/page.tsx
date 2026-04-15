'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

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

  if (checking) return <main style={{minHeight:'100vh',background:'#0a0a0f'}} />

  return (
    <main style={{minHeight:'100vh',background:'#0a0a0f',color:'white',fontFamily:'Inter,sans-serif',overflowX:'hidden'}}>

      {/* Nav */}
      <nav style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid #1e1e2e',position:'sticky',top:0,background:'rgba(10,10,15,0.9)',backdropFilter:'blur(12px)',zIndex:50}}>
        <span style={{fontSize:'20px',fontWeight:'800',color:'#39ff14',letterSpacing:'2px'}}>PROTOCOL</span>
        <a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'700',padding:'8px 20px',borderRadius:'6px',fontSize:'14px'}}>Sign in</a>
      </nav>

      {/* Hero */}
      <section style={{padding:'80px 24px 60px',maxWidth:'640px',margin:'0 auto',textAlign:'center',position:'relative',overflow:'hidden'}}>

        {/* Left syringe */}
        <div style={{position:'absolute',left:'-10px',top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',opacity:0.5}}>
          <span style={{fontSize:'36px',transform:'rotate(135deg)',display:'block'}}>💉</span>
          <span style={{fontSize:'11px',color:'#39ff14',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed'}}>BPC-157</span>
        </div>

        {/* Right syringe */}
        <div style={{position:'absolute',right:'-10px',top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',opacity:0.5}}>
          <span style={{fontSize:'36px',transform:'rotate(135deg)',display:'block'}}>💉</span>
          <span style={{fontSize:'11px',color:'#39ff14',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed'}}>GLP-1</span>
        </div>

        {/* Background rings */}
        <div style={{position:'absolute',inset:0,display:'flex',justifyContent:'center',alignItems:'center',pointerEvents:'none',zIndex:0}}>
          <svg width='600' height='400' viewBox='0 0 600 400' style={{opacity:0.18,transform:'translateY(40px)'}}>
            <g transform='translate(120, 120)'>
              <circle cx='0' cy='0' r='55' fill='none' stroke='#1e1e2e' strokeWidth='7'/>
              <circle cx='0' cy='0' r='55' fill='none' stroke='#6c63ff' strokeWidth='7' strokeDasharray='345' strokeDashoffset='69' strokeLinecap='round' transform='rotate(-90)'/>
              <text x='0' y='0' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='16' fontWeight='800'>4.6</text>
              <text x='0' y='18' textAnchor='middle' dominantBaseline='middle' fill='#6c63ff' fontSize='9' fontWeight='600'>MOOD</text>
            </g>
            <g transform='translate(260, 80)'>
              <circle cx='0' cy='0' r='45' fill='none' stroke='#1e1e2e' strokeWidth='6'/>
              <circle cx='0' cy='0' r='45' fill='none' stroke='#f59e0b' strokeWidth='6' strokeDasharray='283' strokeDashoffset='71' strokeLinecap='round' transform='rotate(-90)'/>
              <text x='0' y='0' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='13' fontWeight='800'>3.8</text>
              <text x='0' y='15' textAnchor='middle' dominantBaseline='middle' fill='#f59e0b' fontSize='8' fontWeight='600'>ENERGY</text>
            </g>
            <g transform='translate(420, 130)'>
              <circle cx='0' cy='0' r='50' fill='none' stroke='#1e1e2e' strokeWidth='6'/>
              <circle cx='0' cy='0' r='50' fill='none' stroke='#8b5cf6' strokeWidth='6' strokeDasharray='314' strokeDashoffset='88' strokeLinecap='round' transform='rotate(-90)'/>
              <text x='0' y='0' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='14' fontWeight='800'>7.5h</text>
              <text x='0' y='16' textAnchor='middle' dominantBaseline='middle' fill='#8b5cf6' fontSize='8' fontWeight='600'>SLEEP</text>
            </g>
            <g transform='translate(200, 280)'>
              <circle cx='0' cy='0' r='42' fill='none' stroke='#1e1e2e' strokeWidth='6'/>
              <circle cx='0' cy='0' r='42' fill='none' stroke='#39ff14' strokeWidth='6' strokeDasharray='264' strokeDashoffset='38' strokeLinecap='round' transform='rotate(-90)'/>
              <text x='0' y='0' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='13' fontWeight='800'>6/7</text>
              <text x='0' y='14' textAnchor='middle' dominantBaseline='middle' fill='#39ff14' fontSize='8' fontWeight='600'>STREAK</text>
            </g>
            <g transform='translate(380, 290)'>
              <circle cx='0' cy='0' r='28' fill='none' stroke='#1e1e2e' strokeWidth='5'/>
              <circle cx='0' cy='0' r='28' fill='none' stroke='#6c63ff' strokeWidth='5' strokeDasharray='176' strokeDashoffset='53' strokeLinecap='round' transform='rotate(-90)'/>
              <text x='0' y='0' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='10' fontWeight='800'>4.2</text>
              <text x='0' y='12' textAnchor='middle' dominantBaseline='middle' fill='#6c63ff' fontSize='7' fontWeight='600'>AVG</text>
            </g>
          </svg>
        </div>

        {/* Hero content */}
        <div style={{position:'relative',zIndex:1}}>
          <div style={{display:'inline-block',background:'rgba(108,99,255,0.2)',border:'1px solid rgba(108,99,255,0.5)',borderRadius:'24px',padding:'10px 24px',fontSize:'15px',color:'#a78bfa',fontWeight:'800',marginBottom:'28px',letterSpacing:'2px'}}>EARLY ACCESS</div>
          <h1 style={{fontSize:'clamp(36px,8vw,64px)',fontWeight:'900',lineHeight:'1.1',marginBottom:'28px',letterSpacing:'-1px'}}>Track your protocol.<br/><span style={{color:'#39ff14'}}>Own your data.</span></h1>
          <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap'}}>
            <a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'800',padding:'16px 36px',borderRadius:'8px',fontSize:'16px',letterSpacing:'0.5px'}}>Get early access</a>
            <a href='/calculator' style={{background:'transparent',color:'#8b8ba7',textDecoration:'none',fontWeight:'600',padding:'16px 24px',borderRadius:'8px',fontSize:'16px',border:'1px solid #1e1e2e'}}>Try calculator →</a>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{padding:'40px 24px 80px',maxWidth:'720px',margin:'0 auto'}}>
        <p style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'24px',textAlign:'center'}}>WHAT YOU GET</p>
        <div style={{display:'grid',gap:'12px'}}>
          <div style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',padding:'24px',display:'flex',gap:'16px',alignItems:'flex-start'}}>
            <span style={{fontSize:'28px'}}>📓</span>
            <div><h3 style={{fontSize:'18px',fontWeight:'700',marginBottom:'4px',color:'#39ff14'}}>Smart Journal</h3><p style={{color:'#8b8ba7',fontSize:'14px',margin:0}}>Daily logs. Trend charts. Streak tracking.</p></div>
          </div>
          <div style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',padding:'24px',display:'flex',gap:'16px',alignItems:'flex-start'}}>
            <span style={{fontSize:'28px'}}>⚗️</span>
            <div><h3 style={{fontSize:'18px',fontWeight:'700',marginBottom:'4px',color:'#39ff14'}}>Protocol Builder</h3><p style={{color:'#8b8ba7',fontSize:'14px',margin:0}}>Compounds, doses, schedules. All in one place.</p></div>
          </div>
          <div style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',padding:'24px',display:'flex',gap:'16px',alignItems:'flex-start'}}>
            <span style={{fontSize:'28px'}}>👥</span>
            <div><h3 style={{fontSize:'18px',fontWeight:'700',marginBottom:'4px',color:'#39ff14'}}>Private Community</h3><p style={{color:'#8b8ba7',fontSize:'14px',margin:0}}>Anonymous cohorts. Real experiences. No noise.</p></div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section style={{padding:'48px 24px',background:'rgba(108,99,255,0.05)',borderTop:'1px solid #1e1e2e',borderBottom:'1px solid #1e1e2e',textAlign:'center'}}>
        <h2 style={{fontSize:'22px',fontWeight:'800',marginBottom:'24px'}}>Your data stays yours. Always.</h2>
        <div style={{display:'flex',gap:'20px',justifyContent:'center',flexWrap:'wrap'}}>
          {['No ads','No data selling','End-to-end private','You own it'].map(item => (
            <div key={item} style={{display:'flex',alignItems:'center',gap:'6px',color:'#8b8ba7',fontSize:'14px'}}>
              <span style={{color:'#39ff14',fontWeight:'700'}}>✓</span> {item}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{padding:'80px 24px',textAlign:'center',maxWidth:'480px',margin:'0 auto'}}>
        <h2 style={{fontSize:'28px',fontWeight:'900',marginBottom:'12px'}}>Ready to start?</h2>
        <p style={{color:'#8b8ba7',marginBottom:'28px',fontSize:'15px'}}>Free during early access. No credit card required.</p>
        <a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'800',padding:'16px 48px',borderRadius:'8px',fontSize:'18px',display:'inline-block'}}>Get started free</a>
      </section>

      {/* Footer */}
      <footer style={{borderTop:'1px solid #1e1e2e',padding:'24px',textAlign:'center'}}>
        <p style={{color:'#3d3d5c',fontSize:'13px'}}>© 2026 Protocol · <a href='/learn' style={{color:'#3d3d5c',textDecoration:'none'}}>Harm Reduction</a> · <a href='/calculator' style={{color:'#3d3d5c',textDecoration:'none'}}>Calculator</a></p>
        <p style={{color:'#3d3d5c',fontSize:'11px',marginTop:'8px'}}>Not medical advice. For personal harm reduction tracking only.</p>
      </footer>

    </main>
  )
}