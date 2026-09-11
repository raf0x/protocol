const fs = require('fs');

// Fix 1: Remove toggle from BottomNav
let nav = fs.readFileSync('components/BottomNav.tsx', 'utf8');
nav = `'use client'

import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '../lib/supabase'

export default function BottomNav() {
  const pathname = usePathname()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id === '41266062-c8a7-4a52-aa9b-c1fb96d1c483') setIsAdmin(true)
    }
    check()
  }, [])

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
    </nav>
  )
}
`;
fs.writeFileSync('components/BottomNav.tsx', nav, 'utf8');
console.log('Done! BottomNav cleaned.');

// Fix 2: Add floating theme toggle component
const toggle = `'use client'

import { useState, useEffect } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState('dark')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    try { const t = localStorage.getItem('protocol-theme') || 'dark'; setTheme(t) } catch(e) {}
    setMounted(true)
  }, [])

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    try { localStorage.setItem('protocol-theme', next) } catch(e) {}
    document.documentElement.setAttribute('data-theme', next)
  }

  if (!mounted) return null

  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        zIndex: 100,
        width: '36px',
        height: '36px',
        borderRadius: '50%',
        border: '1px solid var(--color-border)',
        background: 'var(--color-card)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '16px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        transition: 'all 0.2s ease',
      }}
    >
      {theme === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19'}
    </button>
  )
}
`;
fs.writeFileSync('components/ThemeToggle.tsx', toggle, 'utf8');
console.log('Done! ThemeToggle component created.');
