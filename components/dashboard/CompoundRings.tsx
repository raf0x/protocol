'use client'
import { useRef, useEffect } from 'react'

type Props = {
  activeProtocols: any[]
  activeCompoundTab: string | null
  setActiveCompoundTab: (id: string) => void
}

export default function CompoundRings({ activeProtocols, activeCompoundTab, setActiveCompoundTab }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const items = activeProtocols.flatMap((p: any) => (p.compounds||[]).map((c: any) => {
    const di = Math.max(0, Math.floor((Date.now()-new Date(p.start_date+'T00:00:00').getTime())/86400000))
    const wk = Math.max(1, Math.floor(di/7)+1)
    return { id: c.id, name: c.name, wk }
  }))

  const colors = ['#39ff14','#6c63ff','#f59e0b','#06b6d4','#f43f5e','#a3e635','#8b5cf6','#ec4899','#14b8a6']
  const tabId = activeCompoundTab || items[0]?.id

  useEffect(() => {
    const activeIndex = items.findIndex(item => item.id === tabId)
    if (activeIndex !== -1 && scrollRef.current) {
      const ring = scrollRef.current.children[activeIndex] as HTMLElement
      if (ring) {
        ring.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }, [tabId, items])

  if (items.length === 0) return null

  return (
    <div style={{marginBottom:'16px',overflow:'hidden'}}>
      <div
        ref={scrollRef}
        style={{
          display:'flex',
          gap:'12px',
          overflowX:'auto',
          padding:'8px 4px',
          scrollbarWidth:'none',
          msOverflowStyle:'none',
          WebkitOverflowScrolling:'touch'
        }}
      >
        {items.map((item: any, i: number) => {
          const rc = colors[i % colors.length]
          const isActive = (tabId === item.id)
          const short = item.name.split('/')[0].split(' ')[0].slice(0,6)
          
          return (
            <div
              key={item.id}
              onClick={() => setActiveCompoundTab(item.id)}
              style={{
                minWidth:'70px',
                width:'70px',
                height:'70px',
                borderRadius:'50%',
                border:(isActive?'4px':'3px')+' solid '+rc,
                display:'flex',
                flexDirection:'column',
                alignItems:'center',
                justifyContent:'center',
                background:isActive?rc+'33':'var(--color-card)',
                cursor:'pointer',
                boxShadow:isActive?'0 0 20px '+rc+', 0 0 8px '+rc:'0 2px 8px rgba(0,0,0,0.15)',
                transform:isActive?'scale(1.1)':'scale(1)',
                transition:'all 0.25s ease',
                flexShrink:0
              }}
            >
              <span style={{fontSize:'11px',fontWeight:'800',color:'var(--color-text)',textAlign:'center',lineHeight:'1.2'}}>{short}</span>
              <span style={{fontSize:'10px',fontWeight:'600',color:rc,textAlign:'center',lineHeight:'1.2',marginTop:'2px'}}>Wk {item.wk}</span>
            </div>
          )
        })}
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        div::-webkit-scrollbar { display: none; }
      `}} />
    </div>
  )
}
