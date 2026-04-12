'use client'

import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()
  const links = [
    { href: '/calculator', label: 'Calc' },
    { href: '/protocol', label: 'Protocol' },
    { href: '/journal', label: 'Journal' },
    { href: '/community', label: 'Community' },
    { href: '/profile', label: 'Profile' },
  ]
  return (
    <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'#000000',borderTop:'1px solid #1a1a1a',display:'flex',justifyContent:'space-around',alignItems:'center',padding:'14px 8px 28px 8px',zIndex:50}}>
      {links.map((link) => {
        const isActive = pathname === link.href || pathname.startsWith(link.href+'/') && link.href !== '/'
        return (
          <a key={link.href} href={link.href} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',textDecoration:'none',flex:1}}>
            <span style={{width:'5px',height:'5px',borderRadius:'50%',background:isActive?'#39ff14':'transparent',display:'block'}} />
            <span style={{color:isActive?'#39ff14':'#4dbd4d',fontSize:'11px',fontWeight:'700',textAlign:'center'}}>
              {link.label}
            </span>
          </a>
        )
      })}
    </nav>
  )
}