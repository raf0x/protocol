'use client'

import { useEffect, useState } from 'react'

export default function InstallHint() {
  const [state, setState] = useState<'checking' | 'installed' | 'ios' | 'other'>('checking')
  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
    const next = standalone ? 'installed' : /iPad|iPhone|iPod/.test(navigator.userAgent) ? 'ios' : 'other'
    queueMicrotask(() => setState(next))
  }, [])
  if (state === 'checking' || state === 'other') return null
  return <div className="app-install-hint" role="status">
    <strong>{state === 'installed' ? 'Installed app' : 'Install on iPhone'}</strong>
    <span>{state === 'installed' ? 'MyPepProtocol is running in standalone mode.' : 'In Safari, open Share and choose Add to Home Screen.'}</span>
  </div>
}
