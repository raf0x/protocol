'use client'
import { useEffect, useRef } from 'react'

/** Keep the focused flow inside the visible viewport when a software keyboard opens. */
export function useSetupViewport() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const page = ref.current?.closest<HTMLElement>('.protocols-focused')
    const viewport = window.visualViewport
    if (!page || !viewport) return
    const resize = () => {
      page.style.setProperty('--setup-height', `${viewport.height}px`)
      page.style.setProperty('--setup-top', `${viewport.offsetTop}px`)
    }
    resize()
    viewport.addEventListener('resize', resize)
    viewport.addEventListener('scroll', resize)
    return () => { viewport.removeEventListener('resize', resize); viewport.removeEventListener('scroll', resize) }
  }, [])
  return ref
}
