'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { PhaseRow } from '../../lib/health/timeline'
import styles from './protocol-detail-artwork.module.css'

type AdministrationPresentation = 'injection' | 'oral'
type ArtworkProps = { kind: 'inventory' } | { kind: 'administration'; presentation: AdministrationPresentation }

/** Choose decoration from recorded context, never from calculated dose equivalents.
 * An explicit route wins; a versioned entry supersedes legacy administration fields.
 */
export function administrationArtwork(phase: PhaseRow | null | undefined): AdministrationPresentation | null {
  if (!phase) return null
  const route = phase.route?.trim().toLowerCase()
  if (route === 'oral') return 'oral'
  if (route === 'subq' || route === 'im') return 'injection'
  if (route) return null
  const recorded = (value: number | string | null | undefined) =>
    (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) && Number.isFinite(Number(value)) && Number(value) >= 0
  const entry = phase.dosing_entry
  return (entry
    ? recorded(entry.injection_volume) || recorded(entry.syringe_markings)
    : recorded(phase.injection_volume_ml) || recorded(phase.syringe_units)) ? 'injection' : null
}

/** Production-owned adaptation of Visual Lab V0.6 (unchanged in V0.6.4).
 * Decorative materials only: no dose scale, fill level, stock count or completion state.
 * Real values remain in ProtocolDetail's existing definition lists.
 */
export default function ProtocolDetailArtwork(props: ArtworkProps) {
  const { kind } = props
  const presentation = props.kind === 'administration' ? props.presentation : undefined
  const prefix = `protocol-art-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const paint = (name: string) => `url(#${prefix}-${name})`
  const figure = useRef<HTMLElement>(null)
  const [playing, setPlaying] = useState(false)
  const title = kind === 'administration' ? 'Administration' : 'Inventory'

  useEffect(() => {
    const element = figure.current
    if (!element) return
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const stopMotion = () => { if (preference.matches) setPlaying(false) }
    preference.addEventListener('change', stopMotion)
    // Hidden More details content does not spend its entrance animation offscreen.
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
    const timer = window.setTimeout(() => setPlaying(false), 1000)
    return () => window.clearTimeout(timer)
  }, [playing])

  return <figure ref={figure} className={`${styles.figure} ${styles[kind]}`} data-protocol-artwork={kind} data-administration-artwork={presentation} data-playing={playing ? 'true' : undefined}>
    <div className={styles.stage}>
    <svg className={styles.artwork} data-protocol-artwork-svg={kind} viewBox={presentation === 'oral' ? '20 26 140 86' : '20 12 140 100'} fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${prefix}-glass`} x1="40" y1="15" x2="130" y2="105" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--art-accent)" stopOpacity=".46" />
          <stop offset=".3" stopColor="#25334a" stopOpacity=".95" />
          <stop offset=".7" stopColor="#182439" stopOpacity=".9" />
          <stop offset="1" stopColor="var(--art-secondary)" stopOpacity=".42" />
        </linearGradient>
        <linearGradient id={`${prefix}-color`} x1="60" y1="40" x2="120" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--art-accent)" stopOpacity=".95" />
          <stop offset="1" stopColor="var(--art-secondary)" stopOpacity=".65" />
        </linearGradient>
        <linearGradient id={`${prefix}-metal`} x1="65" y1="18" x2="108" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--art-highlight)" stopOpacity=".65" />
          <stop offset=".35" stopColor="var(--art-accent)" stopOpacity=".45" />
          <stop offset="1" stopColor="#27314a" />
        </linearGradient>
        <radialGradient id={`${prefix}-halo`}>
          <stop stopColor="var(--art-accent)" stopOpacity=".15" />
          <stop offset="1" stopColor="var(--art-accent)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${prefix}-edge`} x1="50" y1="25" x2="124" y2="94" gradientUnits="userSpaceOnUse">
          <stop stopColor="#edf6ff" stopOpacity=".78" />
          <stop offset=".45" stopColor="var(--art-highlight)" stopOpacity=".18" />
          <stop offset="1" stopColor="var(--art-secondary)" stopOpacity=".5" />
        </linearGradient>
        <linearGradient id={`${prefix}-plinth`} x1="43" y1="94" x2="137" y2="105" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--art-secondary)" stopOpacity=".08" />
          <stop offset=".5" stopColor="var(--art-accent)" stopOpacity=".2" />
          <stop offset="1" stopColor="var(--art-secondary)" stopOpacity=".06" />
        </linearGradient>
      </defs>
      <ellipse cx="91" cy="63" rx="63" ry="43" fill={paint('halo')} />
      <ellipse cx="90" cy="99" rx="48" ry="4" fill="#030914" opacity=".3" />
      <ellipse cx="90" cy="99" rx="39" ry="2" fill="var(--art-secondary)" opacity=".15" />
      <g data-motion="plinth"><ellipse cx="90" cy="100" rx="48" ry="5" fill={paint('plinth')} stroke={paint('edge')} strokeOpacity=".24" /><path d="M47 102Q90 111 133 102" stroke="var(--art-secondary)" strokeOpacity=".17" /></g>
      {kind === 'administration' ? presentation === 'injection' ? <>
        <path data-motion="instrument-arc" d="M49 78A43 43 0 0 1 109 24" pathLength="1" stroke={paint('edge')} strokeOpacity=".48" strokeLinecap="round" />
        <path d="m47 71-4-1m6-12-4-2m11-9-3-3m15-7-2-4" stroke="var(--art-accent)" strokeOpacity=".35" strokeLinecap="round" />
        <path d="M35 81H56C63 81 65 74 65 68V43C65 35 73 32 83 32H145" stroke="var(--art-secondary)" strokeOpacity=".65" strokeDasharray="3 5" />
        <circle cx="145" cy="32" r="9" fill="var(--art-secondary)" opacity=".18" />
        <circle cx="145" cy="32" r="4" fill="var(--art-signal)" />
        <g data-motion="syringe"><g transform="rotate(-34 86 59)">
          <rect x="51" y="54" width="61" height="17" rx="4" fill="#030914" opacity=".35" />
          <rect x="51" y="51" width="61" height="17" rx="4" fill={paint('glass')} stroke="var(--art-accent)" strokeWidth="1.5" />
          <path d="M55 54H109" stroke="var(--art-highlight)" strokeOpacity=".6" strokeLinecap="round" />
          <path d="M54 65H108" stroke="var(--art-secondary)" strokeOpacity=".6" strokeLinecap="round" />
          <rect x="59" y="54" width="4" height="11" rx="1" fill="var(--art-signal)" fillOpacity=".75" />
          <path d="M112 55H122V65H112M122 60H143M51 60H35" stroke="var(--art-highlight)" strokeWidth="2" strokeLinecap="round" />
          <rect x="31" y="48" width="6" height="24" rx="2" fill={paint('metal')} stroke="var(--art-accent)" />
          <path d="M48 48V72" stroke="var(--art-accent)" strokeWidth="3" strokeLinecap="round" />
          <path data-motion="barrel-reflection" d="M55 56H109" pathLength="1" stroke="var(--art-highlight)" strokeWidth="2" strokeLinecap="round" opacity="0" />
        </g></g>
        <g data-motion="capsule">
          <rect x="116" y="78" width="26" height="12" rx="6" transform="rotate(-25 116 78)" fill="var(--art-signal)" fillOpacity=".65" stroke="var(--art-signal)" />
          <path d="m128 74 5 11" stroke="var(--art-highlight)" strokeOpacity=".6" />
          <path d="m120 79 5-2" stroke="#fff0e5" strokeOpacity=".6" strokeLinecap="round" />
        </g>
      </> : <>
        {/* Enlarge the approved capsule motif; no assumed oral quantity or formulation. */}
        <g transform="translate(-170 -91) scale(2)"><g data-motion="capsule">
          <rect x="116" y="80" width="26" height="12" rx="6" transform="rotate(-25 116 80)" fill="#030914" opacity=".3" />
          <rect x="116" y="78" width="26" height="12" rx="6" transform="rotate(-25 116 78)" fill="var(--art-signal)" fillOpacity=".65" stroke="var(--art-signal)" />
          <path d="m128 74 5 11" stroke="var(--art-highlight)" strokeOpacity=".6" />
          <path d="m120 79 5-2" stroke="#fff0e5" strokeOpacity=".6" strokeLinecap="round" />
        </g></g>
      </> : <>
        <g data-motion="stock-box">
          <path d="m42 53 36-17 42 18-35 18Z" fill={paint('color')} fillOpacity=".45" stroke="var(--art-accent)" strokeLinejoin="round" />
          <path d="M42 53V82L85 101V72Z" fill={paint('glass')} stroke="var(--art-accent)" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M85 101l35-18V54L85 72Z" fill="#1e3442" stroke="var(--art-secondary)" strokeWidth="1.5" strokeLinejoin="round" />
          <path d="m62 44 40 19v17" stroke="var(--art-highlight)" strokeOpacity=".55" />
          <path d="m46 58 35 16v22M91 95l24-13" stroke={paint('edge')} strokeOpacity=".5" strokeLinecap="round" />
          <path data-motion="stock-edge" d="m46 52 32-12 35 14" pathLength="1" stroke="var(--art-signal)" strokeOpacity=".65" strokeLinecap="round" />
          <rect x="52" y="62" width="13" height="5" rx="1.5" transform="rotate(24 52 62)" fill="var(--art-highlight)" fillOpacity=".18" />
          <path d="M53 74V81M60 77V84M67 80V87" stroke="var(--art-accent)" strokeWidth="3" strokeLinecap="round" />
        </g>
        <g data-motion="stock-vial">
          <path d="M119 29v10l-7 6v27q0 6 6 6h20q6 0 6-6V45l-7-6V29" fill={paint('glass')} stroke="var(--art-accent)" strokeWidth="1.5" />
          <rect x="116" y="20" width="24" height="11" rx="3" fill={paint('metal')} stroke="var(--art-accent)" />
          <path d="M119 45V52" stroke="var(--art-highlight)" strokeOpacity=".65" strokeLinecap="round" />
          <path d="M140 47V70Q140 74 136 74" stroke="var(--art-secondary)" strokeOpacity=".5" strokeLinecap="round" />
          <path data-motion="stock-reflection" d="M116 46V70" stroke="var(--art-highlight)" strokeWidth="3" strokeLinecap="round" opacity="0" />
        </g>
        <g data-motion="stock-seal"><circle cx="132" cy="88" r="10" fill="#293c35" stroke="var(--art-signal)" /><circle cx="132" cy="88" r="7" stroke="var(--art-signal)" strokeOpacity=".3" /></g>
      </>}
    </svg>
    </div>
    <figcaption className={styles.caption}>
      <span>Illustrative · {kind === 'administration' ? 'not a dose guide' : 'not a stock count'}</span>
      <button className={styles.replay} type="button" aria-label={`Replay ${title} illustration`} title={`Replay ${title} illustration`} disabled={playing} onClick={() => { if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(true) }}>
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false"><path d="M5.2 6.5A6 6 0 1 1 4 11M5 3v4H1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </button>
    </figcaption>
  </figure>
}