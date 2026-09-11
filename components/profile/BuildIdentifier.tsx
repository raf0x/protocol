'use client'

import { useEffect, useState } from 'react'

export default function BuildIdentifier() {
  const [release, setRelease] = useState('…')
  useEffect(() => {
    const value = document.body.dataset.appRelease || 'local'
    queueMicrotask(() => setRelease(value))
  }, [])
  return <p style={{fontSize:'11px',color:'var(--color-muted)',margin:'12px 0 0'}}>Build <code style={{fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace'}}>{release}</code></p>
}
