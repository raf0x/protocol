'use client'

import { useState } from 'react'
import { createClient } from '../../../lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError('')
    setLoading(true)

    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address.')
      setLoading(false)
      return
    }

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <main style={{minHeight:'100vh',background:'#030712',color:'white',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px'}}>
        <div style={{maxWidth:'400px',width:'100%',textAlign:'center'}}>
          <div style={{fontSize:'48px',marginBottom:'16px'}}>📬</div>
          <h1 style={{fontSize:'24px',fontWeight:'bold',marginBottom:'12px'}}>Check your email</h1>
          <p style={{color:'#6b7280',lineHeight:'1.6'}}>
            We sent a sign-in link to <strong style={{color:'white'}}>{email}</strong>.
            Tap the link in that email to continue.
          </p>
          <p style={{color:'#4b5563',fontSize:'12px',marginTop:'24px'}}>
            No email? Check your spam folder.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main style={{minHeight:'100vh',background:'#030712',color:'white',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px'}}>
      <div style={{maxWidth:'400px',width:'100%'}}>
        <h1 style={{fontSize:'28px',fontWeight:'bold',marginBottom:'8px'}}>Protocol</h1>
        <p style={{color:'#6b7280',marginBottom:'32px'}}>
          Enter your email to sign in or create an account.
        </p>

        <div style={{marginBottom:'16px'}}>
          <label style={{display:'block',fontSize:'14px',fontWeight:'500',marginBottom:'6px'}}>
            Email address
          </label>
          <input
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            placeholder='you@example.com'
            style={{width:'100%',background:'#1f2937',border:'1px solid #374151',borderRadius:'6px',padding:'10px 12px',color:'white',fontSize:'16px',outline:'none',boxSizing:'border-box'}}
          />
        </div>

        {error && (
          <div style={{background:'#450a0a',border:'1px solid #991b1b',borderRadius:'6px',padding:'10px 12px',fontSize:'14px',color:'#fca5a5',marginBottom:'16px'}}>
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{width:'100%',background:loading?'#1d4ed8':'#2563eb',color:'white',fontWeight:'600',padding:'12px',borderRadius:'6px',border:'none',fontSize:'16px',cursor:loading?'not-allowed':'pointer'}}
        >
          {loading ? 'Sending...' : 'Send sign-in link'}
        </button>

        <p style={{color:'#4b5563',fontSize:'12px',marginTop:'24px',lineHeight:'1.6'}}>
          By signing in you agree to use this tool for personal harm reduction tracking only.
          This app does not provide medical advice.
        </p>
      </div>
    </main>
  )
}
