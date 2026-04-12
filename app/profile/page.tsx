'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function ProfilePage() {
  const [email, setEmail] = useState('')
  const [createdAt, setCreatedAt] = useState('')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setEmail(user.email || '')
      const date = new Date(user.created_at)
      setCreatedAt(date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
      setLoading(false)
    }
    loadUser()
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  const g = '#39ff14'
  const dg = '#4dbd4d'
  const mg = '#2d5a2d'
  const cb = '#0d0d0d'
  const bd = '#1a1a1a'

  if (loading) return <main style={{minHeight:'100vh',background:'#000000',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>

  return (
    <main style={{minHeight:'100vh',background:'#000000',color:'white',padding:'24px'}}>
      <div style={{maxWidth:'480px',margin:'0 auto'}}>
        <h1 style={{fontSize:'24px',fontWeight:'bold',marginBottom:'24px',color:g}}>Profile</h1>
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'20px',marginBottom:'16px'}}>
          <div style={{marginBottom:'16px',paddingBottom:'16px',borderBottom:'1px solid '+bd}}>
            <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px',fontWeight:'600'}}>EMAIL</span>
            <span style={{fontSize:'15px'}}>{email}</span>
          </div>
          <div>
            <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px',fontWeight:'600'}}>MEMBER SINCE</span>
            <span style={{fontSize:'15px'}}>{createdAt}</span>
          </div>
        </div>
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'20px',marginBottom:'16px'}}>
          <h2 style={{fontSize:'14px',fontWeight:'600',color:dg,marginBottom:'12px'}}>About Protocol</h2>
          <p style={{fontSize:'13px',color:mg,lineHeight:'1.6',margin:0}}>Protocol is a personal harm reduction tracking tool. It does not provide medical advice, recommend dosing, or facilitate sourcing of any substances. All data is private to your account.</p>
        </div>
        <button onClick={handleSignOut} style={{width:'100%',background:'#1a0000',border:'1px solid #4a0000',color:'#ff6b6b',fontWeight:'700',padding:'14px',borderRadius:'6px',fontSize:'16px',cursor:'pointer'}}>
          Sign out
        </button>
      </div>
    </main>
  )
}