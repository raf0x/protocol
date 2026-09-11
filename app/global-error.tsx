'use client'

import { useEffect } from 'react'
import { reportClientError } from '../lib/clientMonitoring'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { reportClientError(error, '/global-error') }, [error])
  return <html lang="en"><body style={{margin:0,background:'#070b14',color:'#f5f7fb',fontFamily:'Inter,system-ui,sans-serif'}}><main style={{minHeight:'100dvh',display:'grid',placeItems:'center',padding:'24px'}}><div style={{maxWidth:'400px',textAlign:'center'}}><h1 style={{fontSize:'22px'}}>MyPepProtocol needs a fresh start</h1><p style={{color:'#a8b0c3',lineHeight:1.6}}>A display error interrupted the app. Your health records were not changed.</p><button type="button" onClick={reset} style={{minHeight:'44px',padding:'11px 24px',border:0,borderRadius:'12px',background:'#39ff8f',color:'#06100a',fontWeight:800}}>Try again</button></div></main></body></html>
}
