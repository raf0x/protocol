'use client'

import { useId } from 'react'
import { formatProtocolAmount, formatProtocolPercent } from '../../lib/health/dosingEntry'
import styles from './enhanced-artwork.module.css'

type Props = {
  name: string
  strength?: number | null
  unit?: string | null
  remainingFraction: number | null
  remainingMl: number | null
}

/** V0.6.4 glass geometry; consumes the Hero's existing estimate, never computes inventory. */
export default function EnhancedVial({ name, strength, unit, remainingFraction, remainingMl }: Props) {
  const prefix = `${useId().replace(/:/g, '')}-today-vial`
  const paint = (name: string) => `url(#${prefix}-${name})`
  const known = remainingFraction !== null && Number.isFinite(remainingFraction) && remainingFraction >= 0 && remainingFraction <= 1
    && remainingMl !== null && Number.isFinite(remainingMl) && remainingMl >= 0
  const fraction = known ? remainingFraction : 0
  const liquidY = 97 - 47 * fraction
  const strengthText = formatProtocolAmount(strength, unit)

  return <figure className={styles.vial} aria-label={name?.trim() ? name + ' vial' : 'Selected compound vial'} data-inventory-state={known ? 'estimated' : 'unknown'}>
    <svg className={styles.artwork} data-premium-vial="true" viewBox="42 12 98 94" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${prefix}-glass`} x1="64" y1="49" x2="118" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#9de2e6" stopOpacity=".68" />
          <stop offset=".12" stopColor="#397e9c" stopOpacity=".58" />
          <stop offset=".31" stopColor="#203c57" stopOpacity=".8" />
          <stop offset=".57" stopColor="#15334b" stopOpacity=".48" />
          <stop offset=".8" stopColor="#4169b8" stopOpacity=".48" />
          <stop offset="1" stopColor="#ad9cdd" stopOpacity=".68" />
        </linearGradient>
        <linearGradient id={`${prefix}-liquid`} x1="65" y1="73" x2="113" y2="98" gradientUnits="userSpaceOnUse">
          <stop stopColor="#79ddcd" />
          <stop offset=".31" stopColor="#39b9c4" stopOpacity=".94" />
          <stop offset=".67" stopColor="#3b86c9" stopOpacity=".92" />
          <stop offset="1" stopColor="#8378cc" stopOpacity=".86" />
        </linearGradient>
        <linearGradient id={`${prefix}-metal`} x1="72" y1="20" x2="110" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#bddce9" />
          <stop offset=".23" stopColor="#739dbd" />
          <stop offset=".51" stopColor="#43668d" />
          <stop offset=".81" stopColor="#6777b3" />
          <stop offset="1" stopColor="#a99bd1" />
        </linearGradient>
        <linearGradient id={`${prefix}-edge`} x1="65" y1="25" x2="118" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d1eff2" stopOpacity=".9" />
          <stop offset=".4" stopColor="#6cbfcf" stopOpacity=".62" />
          <stop offset=".72" stopColor="#698ddd" stopOpacity=".65" />
          <stop offset="1" stopColor="#b4a3df" stopOpacity=".72" />
        </linearGradient>
        <linearGradient id={`${prefix}-label`} x1="73" y1="52" x2="107" y2="69" gradientUnits="userSpaceOnUse">
          <stop stopColor="#284761" stopOpacity=".94" />
          <stop offset="1" stopColor="#26344c" stopOpacity=".97" />
        </linearGradient>
        <linearGradient id={`${prefix}-reflection`} x1="66" y1="35" x2="82" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e2f6fa" stopOpacity="0" />
          <stop offset=".45" stopColor="#d1f2f1" stopOpacity=".65" />
          <stop offset=".58" stopColor="#fff7e8" stopOpacity=".8" />
          <stop offset="1" stopColor="#a8baf0" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${prefix}-plinth`} x1="43" y1="94" x2="137" y2="105" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7398e2" stopOpacity=".08" />
          <stop offset=".5" stopColor="#6bd2df" stopOpacity=".2" />
          <stop offset="1" stopColor="#7398e2" stopOpacity=".06" />
        </linearGradient>
        <clipPath id={`${prefix}-vial-clip`}>
          <path d="M76 30V40L65 50V87C65 93 69 97 75 97H106C112 97 116 93 116 87V50L105 40V30Z" />
        </clipPath>
      </defs>
      <ellipse cx="90" cy="99" rx="44" ry="4" fill="#030914" opacity=".2" />
      <ellipse cx="90" cy="100" rx="46" ry="4" fill={paint('plinth')} stroke={paint('edge')} strokeOpacity=".24" />
          <g className={styles.bottle}>
            <path d="M76 30V40L65 50V87C65 93 69 97 75 97H106C112 97 116 93 116 87V50L105 40V30" fill={paint('glass')} stroke={paint('edge')} strokeWidth="1.5" />
            <g clipPath={paint('vial-clip')}>
              <path d="M68 51L79 42V34H102V42L113 51V87Q113 94 105 94H76Q68 94 68 87Z" stroke="#c8e9ed" strokeOpacity=".15" />
              {known && fraction > 0 && <g data-vial-liquid="estimated" className={styles.liquid}>
                <rect x="65" y={liquidY} width="51" height={97 - liquidY} fill={paint('liquid')} />
                <path d={`M65 ${liquidY} Q90.5 ${liquidY - 1.5} 116 ${liquidY}`} stroke="#bcf0e6" strokeWidth="1.2" strokeOpacity=".85" />
              </g>}
              <path d="M68 52V86Q68 94 76 94H104" stroke="#c2e5eb" strokeOpacity=".34" strokeLinecap="round" />
              <path d="M111 54V85Q111 92 106 93" stroke="#b8b2e6" strokeWidth="2.4" strokeOpacity=".3" strokeLinecap="round" />
              <path className={styles.glassSweep} d="M67 35H82L75 99H59Z" fill={paint('reflection')} />
            </g>
            <rect x="72" y="18" width="37" height="15" rx="4" fill={paint('metal')} stroke="#a5c9df" strokeWidth="1.2" />
            <path d="M77 23H104" stroke="#e1f1f1" strokeOpacity=".66" strokeLinecap="round" />
            <path d="M73 30H108" stroke="#203e62" strokeOpacity=".7" />
            <path d="M79 21V29M85 21V29M91 21V29M97 21V29M103 21V29" stroke="#e1e9fb" strokeOpacity=".24" />
            <path d="M72 50V86" stroke="#d2f3ef" strokeWidth="1.8" strokeOpacity=".68" strokeLinecap="round" />
            <path d="M109 54V81M76 37H105" stroke="#c5d1ef" strokeOpacity=".44" strokeLinecap="round" />
            <path d="M68 82V88Q68 94 75 94H104" stroke={paint('edge')} strokeOpacity=".7" strokeLinecap="round" />
            <rect x="73" y="52" width="34" height="16" rx="4" fill={paint('label')} stroke="#7e9bc5" strokeOpacity=".62" />
            <path d="M79 58H98" stroke="#d0dfed" strokeOpacity=".86" strokeLinecap="round" />
            <path d="M79 63H91" stroke="#b9b6e1" strokeOpacity=".76" strokeLinecap="round" />
            <rect x="100" y="57" width="2" height="7" rx="1" fill="#d6bb8b" fillOpacity=".86" />
          </g>
    </svg>
    <figcaption className={styles.caption}>
      <span className={styles.strength}>{strengthText ?? 'Strength not recorded'}</span>
      <span className={styles.remainingLabel}>{known ? 'Estimated remaining' : 'Remaining unknown'}</span>
      {known && <strong className={styles.remainingValue}>{formatProtocolPercent(fraction * 100)}<span>{formatProtocolAmount(remainingMl, 'mL', 'volume')}</span></strong>}
    </figcaption>
  </figure>
}
