'use client'

import { useId } from 'react'
import styles from './enhanced-artwork.module.css'

/** Decorative V0.6.4 calendar material. No selections, dose marks, dates or advancing hands. */
export default function EnhancedScheduleArtwork() {
  const prefix = `${useId().replace(/:/g, '')}-today-schedule`
  const paint = (name: string) => `url(#${prefix}-${name})`
  return <svg className={styles.schedule} data-premium-schedule="true" viewBox="38 14 110 94" fill="none" aria-hidden="true" focusable="false">
    <defs>
      <linearGradient id={`${prefix}-edge`} x1="65" y1="25" x2="118" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#d1eff2" stopOpacity=".9" />
          <stop offset=".4" stopColor="#6cbfcf" stopOpacity=".62" />
          <stop offset=".72" stopColor="#698ddd" stopOpacity=".65" />
          <stop offset="1" stopColor="#b4a3df" stopOpacity=".72" />
        </linearGradient>
        <linearGradient id={`${prefix}-calendar`} x1="45" y1="30" x2="123" y2="94" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5777a4" stopOpacity=".83" />
          <stop offset=".24" stopColor="#293f60" stopOpacity=".96" />
          <stop offset=".65" stopColor="#202e48" stopOpacity=".98" />
          <stop offset="1" stopColor="#5c568a" stopOpacity=".83" />
        </linearGradient>
        <linearGradient id={`${prefix}-calendar-header`} x1="44" y1="29" x2="127" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4d97ce" stopOpacity=".9" />
          <stop offset=".4" stopColor="#5278c3" stopOpacity=".9" />
          <stop offset=".8" stopColor="#806fb9" stopOpacity=".87" />
          <stop offset="1" stopColor="#a38fc9" stopOpacity=".86" />
        </linearGradient>
        <linearGradient id={`${prefix}-clock`} x1="103" y1="65" x2="143" y2="104" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8da8d5" stopOpacity=".9" />
          <stop offset=".28" stopColor="#364e72" />
          <stop offset=".74" stopColor="#25334f" />
          <stop offset="1" stopColor="#8c80b9" stopOpacity=".92" />
        </linearGradient>
        <linearGradient id={`${prefix}-clock-face`} x1="111" y1="66" x2="134" y2="99" gradientUnits="userSpaceOnUse">
          <stop stopColor="#25374f" />
          <stop offset="1" stopColor="#182439" />
        </linearGradient>
        <linearGradient id={`${prefix}-time-arc`} x1="113" y1="67" x2="140" y2="79" gradientUnits="userSpaceOnUse">
          <stop stopColor="#dbbf88" />
          <stop offset=".5" stopColor="#d79e9d" />
          <stop offset="1" stopColor="#b4a0dc" />
        </linearGradient>
    </defs>
          <rect x="47" y="30" width="83" height="66" rx="10" fill="#050c19" opacity=".55" />
          <g className={styles.calendar}>
            <rect x="44" y="27" width="83" height="66" rx="10" fill={paint('calendar')} stroke="#98b6df" strokeOpacity=".8" strokeWidth="1.5" />
            <path d="M49 50V81Q49 88 56 88H94" stroke={paint('edge')} strokeOpacity=".5" strokeLinecap="round" />
            <path d="M45 38Q45 28 55 28H116Q126 28 126 38V46H45Z" fill={paint('calendar-header')} />
            <path d="M49 31Q50 29 55 29H115" stroke="#c3d9f3" strokeOpacity=".35" strokeLinecap="round" />
            <path d="M44 46H127" stroke="#c0d3ee" strokeOpacity=".57" />
            <path d="M62 21V33M108 21V33" stroke="#d0d8ed" strokeWidth="2.4" strokeLinecap="round" />
            {/* Neutral cells are decorative; only the real table displays dose states. */}
            {[56, 78, 100].map(x => [55, 74].map(y => <rect key={x + '-' + y} x={x} y={y} width="13" height="12" rx="3" fill="#9cb4da" fillOpacity=".07" stroke="#bed0e7" strokeOpacity=".26" />))}
          </g>
          <g className={styles.clock}>
            <circle cx="123" cy="82" r="23" fill="#627fc4" opacity=".08" />
            <circle cx="123" cy="82" r="22" fill={paint('clock')} stroke="#a6a5cf" strokeOpacity=".7" strokeWidth="1.5" />
            <circle cx="123" cy="82" r="17" fill={paint('clock-face')} stroke="#779bc3" strokeOpacity=".4" />
            <path d="M113 67A18 18 0 0 1 140 79" pathLength="1" stroke={paint('time-arc')} strokeWidth="2" strokeLinecap="round" />
            <path d="M123 67V69M138 82H136M123 97V95M108 82H110" stroke="#c7d7e8" strokeOpacity=".6" />
            <svg x="106" y="65" width="34" height="34" viewBox="0 0 34 34" overflow="visible" aria-hidden="true" focusable="false">
              <g><path d="M17 5V17" stroke="#dec295" strokeWidth="2" strokeLinecap="round" /></g>
              <g><path d="M17 17L25 21" stroke="#c7d9ee" strokeWidth="2" strokeLinecap="round" /></g>
            </svg>
            <circle cx="123" cy="82" r="2" fill="#dbd7ee" />
          </g>
  </svg>
}
