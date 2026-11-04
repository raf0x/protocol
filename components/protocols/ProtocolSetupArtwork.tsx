'use client'

import { useEffect, useId, useRef, useState } from 'react'
import styles from './protocol-setup-artwork.module.css'

/** Production-owned V0.6 artwork (Phases and Other are unchanged in V0.6.4).
 * Geometry describes the category only. No phase count, current step, completion
 * state, dates or medication data enter this decorative component.
 */
export default function ProtocolSetupArtwork({ kind, compact = false }: { kind: 'phases' | 'other'; compact?: boolean }) {
  const prefix = `protocol-setup-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const paint = (name: string) => `url(#${prefix}-${name})`
  const artwork = useRef<HTMLSpanElement>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const element = artwork.current
    if (!element) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const stopMotion = () => { if (preference.matches) setPlaying(false) }
    preference.addEventListener('change', stopMotion)
    // Hidden details and artwork below the fold retain their entrance until seen.
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= .35)) return
      if (!preference.matches) setPlaying(true)
      observer.disconnect()
    }, { threshold: .35 })
    observer.observe(element)
    return () => { observer.disconnect(); preference.removeEventListener('change', stopMotion) }
  }, [])

  useEffect(() => {
    if (!playing) return
    const timer = window.setTimeout(() => setPlaying(false), 920)
    return () => window.clearTimeout(timer)
  }, [playing])

  return <span ref={artwork} data-playing={playing ? 'true' : undefined} className={`${styles.artwork} ${styles[kind]} ${compact ? styles.compact : ''}`} data-protocol-setup-artwork={kind} data-compact={compact || undefined} aria-hidden="true">
    <svg className={styles.svg} viewBox="20 12 140 98" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${prefix}-glass`} x1="40" y1="15" x2="130" y2="105" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--setup-accent)" stopOpacity=".46" /><stop offset=".3" stopColor="#25334a" stopOpacity=".95" /><stop offset=".7" stopColor="#182439" stopOpacity=".9" /><stop offset="1" stopColor="var(--setup-secondary)" stopOpacity=".42" />
        </linearGradient>
        <linearGradient id={`${prefix}-color`} x1="60" y1="40" x2="120" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--setup-accent)" stopOpacity=".95" /><stop offset="1" stopColor="var(--setup-secondary)" stopOpacity=".65" />
        </linearGradient>
        <linearGradient id={`${prefix}-metal`} x1="65" y1="18" x2="108" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--setup-highlight)" stopOpacity=".65" /><stop offset=".35" stopColor="var(--setup-accent)" stopOpacity=".45" /><stop offset="1" stopColor="#27314a" />
        </linearGradient>
        <radialGradient id={`${prefix}-halo`}><stop stopColor="var(--setup-accent)" stopOpacity=".12" /><stop offset="1" stopColor="var(--setup-accent)" stopOpacity="0" /></radialGradient>
        <linearGradient id={`${prefix}-edge`} x1="50" y1="25" x2="124" y2="94" gradientUnits="userSpaceOnUse">
          <stop stopColor="#edf6ff" stopOpacity=".78" /><stop offset=".45" stopColor="var(--setup-highlight)" stopOpacity=".18" /><stop offset="1" stopColor="var(--setup-secondary)" stopOpacity=".5" />
        </linearGradient>
        <linearGradient id={`${prefix}-plinth`} x1="43" y1="94" x2="137" y2="105" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--setup-secondary)" stopOpacity=".08" /><stop offset=".5" stopColor="var(--setup-accent)" stopOpacity=".2" /><stop offset="1" stopColor="var(--setup-secondary)" stopOpacity=".06" />
        </linearGradient>
      </defs>
      <ellipse cx="91" cy="63" rx="63" ry="43" fill={paint('halo')} />
      <ellipse cx="90" cy="99" rx="48" ry="4" fill="#030914" opacity=".35" />
      <g data-motion="plinth"><ellipse cx="90" cy="100" rx="48" ry="5" fill={paint('plinth')} stroke={paint('edge')} strokeOpacity=".24" /><path d="M47 102Q90 111 133 102" stroke="var(--setup-secondary)" strokeOpacity=".17" /></g>
      {kind === 'phases' ? <>
        <path d="M29 95H62M95 23H125" stroke="var(--setup-secondary)" strokeOpacity=".3" strokeLinecap="round" /><path d="M32 92V98M41 94V97M50 94V97M59 92V98M98 20V26M107 22V25M116 22V25M125 20V26" stroke="var(--setup-accent)" strokeOpacity=".25" />
        {/* The whole connection has one material; no completed segment or moving progress marker. */}
        <path d="M39 79H64Q78 79 78 63V55Q78 40 96 40H138" stroke="var(--setup-secondary)" strokeOpacity=".65" strokeWidth="2" strokeDasharray="3 5" />
        <g data-motion="phase-assembly">
          <g>
            <circle cx="39" cy="79" r="16" fill={paint('glass')} stroke="var(--setup-accent)" />
            <circle cx="39" cy="79" r="11" stroke="var(--setup-highlight)" strokeOpacity=".25" />
            <path d="M27 76A12 12 0 0 1 41 67" stroke={paint('edge')} strokeLinecap="round" />
            <circle cx="39" cy="79" r="3" fill="var(--setup-highlight)" fillOpacity=".5" />
          </g>
          <g>
            <circle cx="79" cy="55" r="23" fill="var(--setup-accent)" opacity=".08" />
            <circle cx="79" cy="55" r="19" fill={paint('glass')} stroke="var(--setup-accent)" />
            <circle cx="79" cy="55" r="15" stroke="var(--setup-highlight)" strokeOpacity=".25" />
            <path d="M69 36A21 21 0 0 1 99 51" stroke="var(--setup-signal)" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round" />
            <circle cx="79" cy="55" r="3" fill="var(--setup-highlight)" fillOpacity=".5" />
          </g>
          <g>
            <circle cx="138" cy="40" r="16" fill={paint('glass')} stroke="var(--setup-accent)" />
            <circle cx="138" cy="40" r="11" stroke="var(--setup-highlight)" strokeOpacity=".25" />
            <path d="M126 37A12 12 0 0 1 139 28" stroke={paint('edge')} strokeLinecap="round" />
            <circle cx="138" cy="40" r="3" fill="var(--setup-highlight)" fillOpacity=".5" />
          </g>
        </g>
        <path d="m105 37 4 3-4 3" stroke="var(--setup-signal)" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M69 88H80" stroke="var(--setup-accent)" strokeWidth="3" strokeLinecap="round" /><path d="M84 88H90" stroke="var(--setup-signal)" strokeWidth="3" strokeLinecap="round" />
      </> : <>
        <g data-motion="document">
          <rect x="57" y="23" width="68" height="70" rx="10" transform="rotate(10 57 23)" fill={paint('glass')} stroke="#62698a" />
          <rect x="46" y="29" width="72" height="67" rx="10" fill={paint('glass')} stroke="var(--setup-accent)" strokeWidth="1.5" />
          <path d="M50 80V86Q50 92 57 92H102" stroke={paint('edge')} strokeOpacity=".6" strokeLinecap="round" />
          <path d="M56 33H106" stroke="var(--setup-highlight)" strokeOpacity=".4" strokeLinecap="round" />
          <path data-motion="document-reflection" d="M54 38V86" stroke="var(--setup-highlight)" strokeWidth="3" strokeLinecap="round" opacity="0" />
          <rect x="57" y="42" width="20" height="20" rx="6" fill={paint('color')} />
          <path d="M63 48H71M63 52H71M63 56H67" stroke="var(--setup-highlight)" strokeOpacity=".8" strokeLinecap="round" />
          <g data-motion="metadata" stroke="var(--setup-highlight)" strokeOpacity=".65" strokeWidth="2" strokeLinecap="round"><path d="M86 45H105M86 54H98M58 74H103M58 84H85" /></g>
          <g data-motion="document-dots" fill="var(--setup-highlight)"><circle cx="91" cy="84" r="1.5" /><circle cx="97" cy="84" r="1.5" /><circle cx="103" cy="84" r="1.5" /></g>
        </g>
        <g data-motion="gear-front"><g data-motion="gear">
          <path d="m127 60 8 0 1 5 4 2 5-1 4 7-4 4v4l4 4-4 7-5-1-4 2-1 5h-8l-1-5-4-2-5 1-4-7 4-4v-4l-4-4 4-7 5 1 4-2Z" fill={paint('metal')} stroke="var(--setup-secondary)" strokeLinejoin="round" />
          <circle cx="131" cy="79" r="9" fill="#28304c" stroke="var(--setup-signal)" />
          <circle cx="131" cy="79" r="4" fill="var(--setup-secondary)" />
          <path d="M131 67V69M141 79H143M131 89V91M119 79H121" stroke="var(--setup-highlight)" strokeOpacity=".6" strokeLinecap="round" />
        </g></g>
      </>}
    </svg>
  </span>
}
