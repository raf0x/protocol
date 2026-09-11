'use client'

import { useState } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

const steps = [
  {
    title: 'Welcome to Protocol',
    body: 'Protocol is a private harm reduction tracker. Everything you log stays with you — your protocols, your journal, your data.',
    cta: 'Next',
  },
  {
    title: 'Track what you take',
    body: 'Build a protocol — add the compounds you use, your doses, and your schedule. The Pep Calculator helps you mix peptides safely.',
    cta: 'Next',
  },
  {
    title: 'Log how you feel',
    body: 'The daily journal tracks your mood, energy, and sleep. Over time you will see patterns — what is working, what is not.',
    cta: 'Next',
  },
  {
    title: 'Learn and connect',
    body: 'The Learn section has harm reduction guides. Community cohorts let you read experiences from others anonymously — no real names, no vendor talk.',
    cta: 'Next',
  },
  {
    title: 'One important thing',
    body: 'Protocol does not provide medical advice. It is a personal tracking tool. Always consult a qualified healthcare provider before starting any new compound.',
    cta: 'Get started',
  },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const g = '#39ff14'
  const dg = '#8b8ba7'
  const mg = '#3d3d5c'
  const cb = '#12121a'
  const bd = '#1e1e2e'
  const current = steps[step]
  const isLast = step === steps.length - 1

  async function advance() {
    if (!isLast) { setStep(step + 1); return }
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_profiles').upsert({ id: user.id, onboarded: true })
    }
    router.push('/protocol')
  }

  async function skip() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('user_profiles').upsert({ id: user.id, onboarded: true })
    }
    router.push('/protocol')
  }

  return (
    <main style={{minHeight:'100vh',background:'#0a0a0f',color:'white',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'32px 24px'}}>
      <div style={{maxWidth:'400px',width:'100%'}}>
        <div style={{display:'flex',gap:'6px',marginBottom:'40px',justifyContent:'center'}}>
          {steps.map((_, i) => (
            <div key={i} style={{width: i === step ? '24px' : '6px',height:'6px',borderRadius:'3px',background:i<=step?g:bd,transition:'width 0.3s'}} />
          ))}
        </div>
        <h1 style={{fontSize:'28px',fontWeight:'bold',color:g,marginBottom:'16px',lineHeight:'1.2'}}>{current.title}</h1>
        <p style={{color:dg,fontSize:'15px',lineHeight:'1.7',marginBottom:'48px'}}>{current.body}</p>
        <button onClick={advance} disabled={loading} style={{width:'100%',background:g,color:'#000000',fontWeight:'700',padding:'16px',borderRadius:'8px',border:'none',fontSize:'16px',cursor:'pointer',marginBottom:'16px',letterSpacing:'1px'}}>
          {loading ? 'Loading...' : current.cta}
        </button>
        {!isLast && (
          <button onClick={skip} style={{width:'100%',background:'none',border:'none',color:mg,fontSize:'14px',cursor:'pointer'}}>Skip intro</button>
        )}
      </div>
    </main>
  )
}