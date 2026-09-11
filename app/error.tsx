'use client'

import { useEffect } from 'react'
import { reportClientError } from '../lib/clientMonitoring'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientError(error) }, [error])
  return (
    <main style={{minHeight:'100dvh',background:'var(--app-bg)',color:'var(--app-text)',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'max(24px, env(safe-area-inset-top, 0px)) 24px max(24px, env(safe-area-inset-bottom, 0px))',fontFamily:'Inter,sans-serif'}}>
      <div style={{textAlign:'center',maxWidth:'400px'}}>
        <div style={{fontSize:'48px',marginBottom:'16px'}}>?</div>
        <h1 style={{fontSize:'22px',fontWeight:'800',marginBottom:'8px',color:'white'}}>Something went wrong</h1>
        <p style={{fontSize:'14px',color:'var(--app-secondary)',marginBottom:'28px',lineHeight:'1.6'}}>The app could not finish that request. No success was recorded.</p>
        <button onClick={reset} style={{minHeight:'44px',background:'var(--app-accent)',color:'var(--app-bg)',border:'none',borderRadius:'var(--app-radius-button)',padding:'12px 28px',fontSize:'15px',fontWeight:'800',cursor:'pointer'}}>Try again</button>
      </div>
    </main>
  )
}
