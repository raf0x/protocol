'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    async function checkUser() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) router.push('/protocol')
    }
    checkUser()
  }, [])

  return (
    <main style={{minHeight:'100vh',background:'#000000',color:'white',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px'}}>
      <h1 style={{fontSize:'40px',fontWeight:'bold',marginBottom:'8px',color:'#39ff14',letterSpacing:'2px'}}>Protocol</h1>
      <p style={{color:'#4dbd4d',marginBottom:'40px',textAlign:'center',fontSize:'14px'}}>Your personal wellness protocol tracker.</p>
      <a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'700',padding:'14px 40px',borderRadius:'8px',fontSize:'16px',letterSpacing:'1px'}}>
        Get started
      </a>
      <a href='/calculator' style={{marginTop:'20px',color:'#2d5a2d',fontSize:'13px',textDecoration:'none'}}>
        Use reconstitution calculator without signing in
      </a>
    </main>
  )
}