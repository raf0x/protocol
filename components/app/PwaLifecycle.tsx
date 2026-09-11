'use client'

import { useEffect } from 'react'
import { isNativeAppRuntime } from '../../lib/clientRuntime'

const CHUNK_RECOVERY_KEY = 'mpp-chunk-recovery-attempted'

export default function PwaLifecycle() {
  useEffect(() => {
    if (isNativeAppRuntime()) {
      if ('serviceWorker' in navigator) {
        void navigator.serviceWorker.getRegistrations().then(registrations => Promise.all(registrations.map(item => item.unregister()))).catch(() => {})
      }
      return
    }
    if (!('serviceWorker' in navigator)) return
    let active = true
    let hadController = Boolean(navigator.serviceWorker.controller)
    let registration: ServiceWorkerRegistration | null = null

    const recoverStaleBuild = (event: ErrorEvent) => {
      const detail = `${event.message || ''} ${String(event.error || '')}`
      if (!/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(detail)) return
      if (sessionStorage.getItem(CHUNK_RECOVERY_KEY)) return
      sessionStorage.setItem(CHUNK_RECOVERY_KEY, '1')
      void registration?.update().finally(() => window.location.reload())
    }
    const refreshOnControllerChange = () => {
      if (!hadController) { hadController = true; return }
      window.location.reload()
    }
    const checkForUpdate = () => {
      if (document.visibilityState === 'visible') void registration?.update()
    }

    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).then(value => {
      if (!active) return
      registration = value
      if (value.waiting) value.waiting.postMessage({ type: 'SKIP_WAITING' })
      value.addEventListener('updatefound', () => {
        const worker = value.installing
        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })
    }).catch(() => {
      // The website remains usable when service workers are unavailable.
    })

    window.addEventListener('error', recoverStaleBuild)
    window.addEventListener('pageshow', checkForUpdate)
    window.addEventListener('online', checkForUpdate)
    document.addEventListener('visibilitychange', checkForUpdate)
    navigator.serviceWorker.addEventListener('controllerchange', refreshOnControllerChange)
    return () => {
      active = false
      window.removeEventListener('error', recoverStaleBuild)
      window.removeEventListener('pageshow', checkForUpdate)
      window.removeEventListener('online', checkForUpdate)
      document.removeEventListener('visibilitychange', checkForUpdate)
      navigator.serviceWorker.removeEventListener('controllerchange', refreshOnControllerChange)
    }
  }, [])
  return null
}
