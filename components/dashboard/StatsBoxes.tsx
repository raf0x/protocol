'use client'

type Props = {
  currentWeight: number | null
  totalLost: string | null
  weightStartDate: string | null
  dueCompounds: { id: string; name: string }[]
}

export default function StatsBoxes({ currentWeight, totalLost, weightStartDate, dueCompounds }: Props) {
  const g = 'var(--color-green)'
  const dg = 'var(--color-dim)'
  const cb = 'var(--color-card)'
  const bd = 'var(--color-border)'

  const dueCount = dueCompounds.length
  const dueNames = dueCompounds.map(c => c.name.split('/')[0].split(' ')[0]).slice(0, 3).join(', ')
  const hasMore = dueCompounds.length > 3

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
      {/* Current Weight */}
      <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{currentWeight ? currentWeight+' lbs' : '—'}</div>
        <div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>CURRENT WEIGHT</div>
      </div>

      {/* Weight Change */}
      <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <div style={{fontSize:'20px',fontWeight:'900',color:totalLost !== null ? (parseFloat(totalLost) > 0 ? g : '#ff6b6b') : g}}>
          {totalLost !== null ? (parseFloat(totalLost) > 0 ? '-'+Math.abs(parseFloat(totalLost)) : '+'+Math.abs(parseFloat(totalLost)))+' lbs' : '—'}
        </div>
        <div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>
          WEIGHT CHANGE
        </div>
        {weightStartDate && (
          <div style={{fontSize:'10px',color:dg,marginTop:'2px',fontWeight:'600'}}>
            since {new Date(weightStartDate + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        )}
      </div>

      {/* Today's Injections */}
      <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        {dueCount > 0 ? (
          <>
            <div style={{fontSize:'20px',fontWeight:'900',color:g}}>{dueCount}</div>
            <div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>DUE TODAY</div>
            <div style={{fontSize:'10px',color:dg,marginTop:'4px',textAlign:'center',lineHeight:'1.3',fontWeight:'600'}}>
              {dueNames}{hasMore ? '...' : ''}
            </div>
          </>
        ) : (
          <>
            <div style={{fontSize:'16px',fontWeight:'700',color:g}}>✓</div>
            <div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>ALL LOGGED</div>
          </>
        )}
      </div>
    </div>
  )
}
