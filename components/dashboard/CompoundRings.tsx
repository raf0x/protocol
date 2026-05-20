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
  })).slice(0, 6)

  const colors = ['#39ff14','#6c63ff','#f59e0b','#06b6d4','#f43f5e','#a3e635']
  const tabId = activeCompoundTab || items[0]?.id
  if (items.length === 0) return null

  const cols = 3
  const rows = 2
  const total = 6
  const padded = [...items, ...Array(total - items.length).fill(null)]
  const ringSize = 76
  const overlapH = 14
  const overlapV = 14

  return (
    <div style={{
      background:'var(--color-card)',
      border:'1px solid var(--color-border)',
      borderRadius:'12px',
      padding:'20px',
      display:'inline-flex',  // Changed from flex to inline-flex
      alignItems:'center',
      justifyContent:'center',
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
      
      <div style={{display:'grid',gridTemplateColumns:`repeat(${cols}, ${ringSize}px)`,gap:'0px',position:'relative',zIndex:1}}>
        {padded.map((item: any, i: number) => {
          if (!item) return <div key={`empty-${i}`} style={{width:`${ringSize}px`,height:`${ringSize}px`}} />
          const rc = colors[i % colors.length]
          const isActive = (tabId === item.id)
          const short = item.name.split('/')[0].split(' ')[0].slice(0,6)
          const col = i % cols
          const row = Math.floor(i / cols)
          const isLastCol = col === cols - 1
          const isLastRow = row === rows - 1
          return (
            <div key={item.id} onClick={() => setActiveCompoundTab(item.id)} style={{width:`${ringSize}px`,height:`${ringSize}px`,borderRadius:'50%',border:(isActive?'4px':'3px')+' solid '+rc,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',background:isActive?rc+'33':'rgba(10,10,15,0.85)',cursor:'pointer',boxShadow:isActive?`0 0 24px ${rc}, 0 0 12px ${rc}`:'0 2px 10px rgba(0,0,0,0.3)',transform:isActive?'scale(1.12)':'scale(1)',transition:'all 0.25s ease',marginRight:isLastCol?'0':`-${overlapH}px`,marginBottom:isLastRow?'0':`-${overlapV}px`,zIndex:isActive?100:row*10+col,position:'relative'}}>
              <span style={{fontSize:'11px',fontWeight:'800',color:'#ffffff',textAlign:'center',lineHeight:'1.2'}}>{short}</span>
              <span style={{fontSize:'10px',fontWeight:'600',color:rc,textAlign:'center',lineHeight:'1.2',marginTop:'2px'}}>Wk {item.wk}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
