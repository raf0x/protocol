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
  })).slice(0, 6)  // Max 6 compounds for now

  const colors = ['#39ff14','#6c63ff','#f59e0b','#06b6d4','#f43f5e','#a3e635']
  const tabId = activeCompoundTab || items[0]?.id

  if (items.length === 0) return null

  // Always 2 rows × 3 columns (Olympic rings style)
  const cols = 3
  const rows = 2
  const total = 6
  const padded = [...items, ...Array(total - items.length).fill(null)]

  const ringSize = 64
  const overlapH = 10
  const overlapV = 10

  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{
        display:'grid',
        gridTemplateColumns:`repeat(${cols}, ${ringSize}px)`,
        gap:'0px',
        position:'relative'
      }}>
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
            <div
              key={item.id}
              onClick={() => setActiveCompoundTab(item.id)}
              style={{
                width:`${ringSize}px`,
                height:`${ringSize}px`,
                borderRadius:'50%',
                border:(isActive?'4px':'3px')+' solid '+rc,
                display:'flex',
                flexDirection:'column',
                alignItems:'center',
                justifyContent:'center',
                background:isActive?rc+'33':'var(--color-card)',
                cursor:'pointer',
                boxShadow:isActive?`0 0 20px ${rc}, 0 0 8px ${rc}`:'0 2px 8px rgba(0,0,0,0.2)',
                transform:isActive?'scale(1.15)':'scale(1)',
                transition:'all 0.25s ease',
