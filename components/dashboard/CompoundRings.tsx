'use client'

type Props = {
  activeProtocols: any[]
  activeCompoundTab: string | null
  setActiveCompoundTab: (id: string) => void
}

export default function CompoundRings({ activeProtocols, activeCompoundTab, setActiveCompoundTab }: Props) {
  const items = activeProtocols.flatMap((p: any) => (p.compounds||[]).map((c: any) => {
    const di = Math.max(0, Math.floor((Date.now()-new Date(p.start_date+'T00:00:00').getTime())/86400000))
    const wk = Math.max(1, Math.floor(di/7)+1)
    return { id: c.id, name: c.name, wk }
  }))

  const colors = ['#39ff14','#6c63ff','#f59e0b','#06b6d4','#f43f5e','#a3e635','#8b5cf6','#ec4899','#14b8a6']
  const tabId = activeCompoundTab || items[0]?.id
  if (items.length === 0) return null

  const ringSize = 'var(--app-ring-size, 76px)'
  const overlapH = 14
  const overlapV = 14

  return (
    <div style={{
      width:'100%',
      background:'var(--color-card)',
      border:'1px solid var(--color-border)',
      borderRadius:'12px',
     padding:'24px 16px 16px 16px',
      display:'flex',
      flexDirection:'column',
      alignItems:'center',
      justifyContent:'center',
      gap:'24px',
      position:'relative',
      overflow:'hidden'
    }}>
      <div style={{
        position:'absolute',
        top:'50%',
        left:'50%',
        transform:'translate(-50%, -50%)',
        width:'180px',
        height:'180px',
        background:'radial-gradient(circle, rgba(57,255,20,0.06) 0%, transparent 70%)',
        filter:'blur(40px)',
        pointerEvents:'none'
      }} />
      
      <div style={{
        display:'grid',
        gridTemplateColumns:`repeat(${Math.min(3, items.length)}, ${ringSize})`,
        gap:'0px',
        position:'relative',
        zIndex:1
      }}>
        {items.map((item: any, i: number) => {
          const rc = colors[i % colors.length]
          const isActive = (tabId === item.id)
          const short = item.name.split('/')[0].split(' ')[0].slice(0,6)
          const col = i % 3
          const row = Math.floor(i / 3)
          const isLastCol = col === 2 || i === items.length - 1
          const isLastRow = row === Math.floor((items.length - 1) / 3)
          
          return (
            <button type="button" key={item.id} aria-label={`${item.name}, week ${item.wk}. Select protocol`} aria-pressed={isActive} onClick={() => setActiveCompoundTab(item.id)} style={{
              width:ringSize,
              height:ringSize,
              borderRadius:'50%',
              border:(isActive?'4px':'3px')+' solid '+rc,
              display:'flex',
              flexDirection:'column',
              alignItems:'center',
              justifyContent:'center',
              background:isActive?rc+'22':'var(--color-card)',
              cursor:'pointer',
              boxShadow:isActive?`0 0 12px ${rc}44`:'none',
              transform:isActive?'scale(1.06)':'scale(1)',
              transition:'all 0.25s ease',
              marginRight:isLastCol?'0':`-${overlapH}px`,
              marginBottom:isLastRow?'0':`-${overlapV}px`,
              zIndex:isActive?100:row*10+col,
              position:'relative'
            }}>
              <span style={{fontSize:'12px',fontWeight:'800',color:'var(--color-text)',textAlign:'center',lineHeight:'1.2'}}>{short}</span>
              <span style={{fontSize:'12px',fontWeight:'600',color:'var(--color-dim)',textAlign:'center',lineHeight:'1.2',marginTop:'2px'}}>Wk {item.wk}</span>
            </button>
          )
        })}
      </div>

      <button
        onClick={() => window.location.href = '/protocol/manage'}
        style={{
          background:'var(--color-green-10)',
          border:'2px solid var(--color-green-30)',
          borderRadius:'8px',
          padding:'10px 20px',
          color:'var(--color-green)',
          fontSize:'12px',
          fontWeight:'700',
          cursor:'pointer',
          transition:'all 0.2s ease',
          zIndex:1,
          position:'relative',
          display:'flex',
          alignItems:'center',
          gap:'6px'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = 'var(--color-green-15)'
          e.currentTarget.style.borderColor = 'var(--color-green)'
          e.currentTarget.style.transform = 'scale(1.02)'
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = 'var(--color-green-10)'
          e.currentTarget.style.borderColor = 'var(--color-green-30)'
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        <span style={{fontSize:'16px'}}>+</span>
        <span>Add/Edit Protocol</span>
      </button>
    </div>
  )
}
