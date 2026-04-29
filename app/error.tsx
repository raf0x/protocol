'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => { console.error('App error:', error) }, [error])
  return (
    <main style={{minHeight:'100vh',background:'#0c0c14',color:'white',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'24px',fontFamily:'Inter,sans-serif'}}>
      <div style={{textAlign:'center',maxWidth:'400px'}}>
        <div style={{fontSize:'48px',marginBottom:'16px'}}>?</div>
        <h1 style={{fontSize:'22px',fontWeight:'800',marginBottom:'8px',color:'white'}}>Something went wrong</h1>
        <p style={{fontSize:'14px',color:'#8b8ba7',marginBottom:'28px',lineHeight:'1.6'}}>An unexpected error occurred. Your data is safe.</p>
        <button onClick={reset} style={{background:'#39ff14',color:'#000',border:'none',borderRadius:'8px',padding:'12px 28px',fontSize:'15px',fontWeight:'800',cursor:'pointer'}}>Try again</button>
      </div>
    </main>
  )
}