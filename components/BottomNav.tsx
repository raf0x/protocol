'use client'

import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const links = [
    { href: '/calculator', label: 'Calc' },
    { href: '/protocol', label: 'Protocol' },
    { href: '/journal', label: 'Journal' },
    { href: '/learn', label: 'Learn' },
  ]

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'#111827',borderTop:'1px solid #1f2937',display:'flex',justifyContent:'space-around',padding:'12px 0 20px 0',zIndex:50}}>
      {links.map((link) => {
        const isActive = pathname === link.href
        return (
          <a key={link.href} href={link.href} style={{textDecoration:'none',color:isActive?'#3b82f6':'#6b7280',fontSize:'12px',fontWeight:isActive?'600':'400',padding:'4px 8px'}}>{link.label}</a>
        )
      })}
      <button onClick={handleSignOut} style={{background:'none',border:'none',color:'#6b7280',fontSize:'12px',padding:'4px 8px',cursor:'pointer'}}>
        Sign out
      </button>
    </nav>
  )
}