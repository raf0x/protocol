const fs = require('fs');

// Fix 1: warmer light mode in globals.css
let globals = fs.readFileSync('app/globals.css', 'utf8');
globals = globals.replace(
  `[data-theme="light"] {
  --color-bg: #f5f4f0;
  --color-card: #ffffff;
  --color-border: #e0dfd8;
  --color-green: #39ff14;
  --color-text: #1a1714;
  --color-dim: #6b6a7a;
  --color-muted: #b0afba;
  --color-input: #eeecea;
  --color-surface: #f4f3ef;
  --color-nav: #ffffff;
  --color-nav-blur: rgba(245,244,240,0.92);
}`,
  `[data-theme="light"] {
  --color-bg: #f0e9da;
  --color-card: #faf4e8;
  --color-border: #dfd5c0;
  --color-green: #39ff14;
  --color-text: #1c1a14;
  --color-dim: #6b6356;
  --color-muted: #a09278;
  --color-input: #ece5d5;
  --color-surface: #f5efe2;
  --color-nav: #faf4e8;
  --color-nav-blur: rgba(250,244,232,0.95);
}`
);
globals = globals.replace(
  `[data-theme="light"] body {
  background-color: #f5f4f0;
  background-image:
    radial-gradient(ellipse 80% 50% at 15% 10%, rgba(139, 92, 246, 0.05) 0%, transparent 55%),
    radial-gradient(ellipse 60% 45% at 90% 20%, rgba(251, 191, 36, 0.07) 0%, transparent 50%),
    radial-gradient(ellipse 50% 40% at 50% 50%, rgba(167, 139, 250, 0.03) 0%, transparent 60%),
    linear-gradient(180deg, #f5f4f0 0%, #f0efe8 50%, #f5f4f0 100%);
  background-attachment: fixed;
  background-size: cover, cover, cover, cover;
}`,
  `[data-theme="light"] body {
  background-color: #f0e9da;
  background-image:
    radial-gradient(ellipse 80% 50% at 15% 10%, rgba(180, 140, 80, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse 60% 45% at 90% 20%, rgba(200, 160, 90, 0.10) 0%, transparent 50%),
    radial-gradient(ellipse 50% 40% at 50% 50%, rgba(160, 130, 80, 0.06) 0%, transparent 60%),
    linear-gradient(180deg, #f0e9da 0%, #ece3cf 50%, #f0e9da 100%);
  background-attachment: fixed;
  background-size: cover, cover, cover, cover;
}`
);
fs.writeFileSync('app/globals.css', globals, 'utf8');
console.log('Done! Warmer light mode saved.');

// Fix 2: add theme toggle to BottomNav
const nav = `'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase'

export default function BottomNav() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id === '41266062-c8a7-4a52-aa9b-c1fb96d1c483') setIsAdmin(true)
    }
    check()
    try { const t = localStorage.getItem('protocol-theme') || 'dark'; setTheme(t) } catch(e) {}
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem('protocol-theme', next) } catch(e) {}
    document.documentElement.setAttribute('data-theme', next)
  }

  if (pathname === '/') return null

  const links = [
    { href: '/calculator', label: '\uD83E\uDDEE' },
    { href: '/community', label: 'Community' },
    { href: '/protocol', label: 'Dashboard' },
    { href: '/journal', label: 'History' },
    { href: '/profile', label: 'Profile' },
    ...(isAdmin ? [{ href: '/tracker', label: 'Admin' }] : []),
  ]

  return (
    <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'var(--color-nav)',borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'space-around',alignItems:'center',padding:'14px 8px 28px 8px',zIndex:50}}>
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(link.href+'/') && link.href !== '/'
        return (
          <a key={link.href} href={link.href} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',textDecoration:'none',flex:1}}>
            <span style={{width:'5px',height:'5px',borderRadius:'50%',background:isActive?'var(--color-green)':'transparent',display:'block'}} />
            <span style={{color:isActive?'var(--color-green)':'var(--color-dim)',fontSize:'11px',fontWeight:'700',textAlign:'center'}}>
              {link.label}
            </span>
          </a>
        )
      })}
      <button onClick={toggleTheme} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',background:'none',border:'none',cursor:'pointer',flex:1,padding:0}}>
        <span style={{width:'5px',height:'5px',borderRadius:'50%',background:'transparent',display:'block'}} />
        <span style={{color:'var(--color-dim)',fontSize:'14px',lineHeight:1}}>{theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}</span>
      </button>
    </nav>
  )
}
`;
fs.writeFileSync('components/BottomNav.tsx', nav, 'utf8');
console.log('Done! BottomNav with theme toggle saved.');
