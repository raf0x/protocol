'use client'

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
    { href: '/calculator', label: '🧮' },
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
