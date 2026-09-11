'use client'
// StatsBar � the three top tiles: current weight, weight change, cycle rings

type Props = {
  currentWeight: number | null
  totalLost: string | null
  activeProtocols: any[]
  activeCompoundTab: string | null
  setActiveCompoundTab: (id: string) => void
}

export default function StatsBar({ currentWeight, totalLost, activeProtocols, activeCompoundTab, setActiveCompoundTab }: Props) {
  const g = 'var(--color-green)'
  const dg = 'var(--color-dim)'
  const cb = 'var(--color-card)'
  const bd = 'var(--color-border)'

  const items = activeProtocols.flatMap((p: any) => (p.compounds||[]).map((c: any) => {
    const di = Math.max(0, Math.floor((Date.now()-new Date(p.start_date+'T00:00:00').getTime())/86400000))
    const wk = Math.max(1, Math.floor(di/7)+1)
    return { id: c.id, name: c.name, wk }
  })).slice(0,6)

  const colors = ['#39ff14','#6c63ff','#f59e0b','#06b6d4','#f43f5e','#a3e635']
  const total = items.length <= 4 ? 4 : 6
  const padded = [...items, ...Array(total - items.length).fill(null)]
  const tabId = activeCompoundTab || items[0]?.id

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}}>
      <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{currentWeight ? currentWeight+' lbs' : '—'}</div>
        <div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>CURRENT WEIGHT</div>
      </div>
      <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <div style={{fontSize:'20px',fontWeight:'900',color:totalLost !== null ? (parseFloat(totalLost) > 0 ? g : '#ff6b6b') : g}}>
          {totalLost !== null ? (parseFloat(totalLost) > 0 ? '-'+Math.abs(parseFloat(totalLost)) : '+'+Math.abs(parseFloat(totalLost)))+' lbs' : '—'}
        </div>
        <div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>WEIGHT CHANGE</div>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
        <div style={{display:'grid',gridTemplateColumns:items.length<=4?'1fr 1fr':'1fr 1fr 1fr',gap:'0px'}}>
          {padded.map((item: any, i: number) => {
            const rc = colors[i] || '#6b7280'
            const cols = items.length <= 4 ? 2 : 3
            const col = i % cols
            const row = Math.floor(i / cols)
            const rows = Math.ceil(padded.length / cols)
            const isLastCol = col === cols - 1
            const isLastRow = row === rows - 1
            const isActive = (tabId === item?.id)
            if (!item) return <div key={i} style={{width:'64px',height:'64px'}} />
            const short = item.name.split('/')[0].split(' ')[0].slice(0,6)
            return (
              <div key={i}
                onClick={() => setActiveCompoundTab(item.id)}
                style={{
                  width:'64px',height:'64px',borderRadius:'50%',
                  border:(isActive?'4px':'3px')+' solid '+rc,
                  display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',
                  marginRight:isLastCol?'0':'-10px',
                  marginBottom:isLastRow?'0':'-10px',
                  background:isActive?rc+'44':'var(--color-card)',
                  zIndex:row+col,position:'relative',cursor:'pointer',
                  boxShadow:isActive?'0 0 18px '+rc+', 0 0 6px '+rc:'0 2px 8px rgba(0,0,0,0.1)',
                  transform:isActive?'scale(1.15)':'scale(1)',
                  transition:'all 0.2s ease'
                }}>
                <span style={{fontSize:'10px',fontWeight:'800',color:'var(--color-text)',textAlign:'center',lineHeight:'1.2'}}>{short}</span>
                <span style={{fontSize:'10px',fontWeight:'600',color:rc,textAlign:'center',lineHeight:'1.2'}}>Wk {item.wk}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
