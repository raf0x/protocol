'use client'
import Link from 'next/link'
type Props={currentWeight:number|null;totalLost:number;weightStartDate:string|null;dueCompounds:{id:string;name:string}[]}
export default function StatsBoxes({currentWeight,totalLost,weightStartDate,dueCompounds}:Props){
  const formatDate=(d:string|null)=>{if(!d)return '';const dt=new Date(d+'T00:00:00');return dt.toLocaleDateString('en-US',{month:'short',day:'numeric'})}
  return(
    <div style={{display:'flex',flexDirection:'column',gap:'8px',width:'140px'}}>
      <div style={{background:'var(--color-card)',border:'1px solid var(--color-border)',borderRadius:'10px',padding:'16px 12px',textAlign:'center'}}>
        <div style={{fontSize:'28px',fontWeight:'800',color:'#f59e0b',lineHeight:'1'}}>{currentWeight?`${currentWeight}`:'—'}</div>
        <div style={{fontSize:'18px',fontWeight:'700',color:'#f59e0b',marginTop:'2px'}}>lbs</div>
        <div style={{fontSize:'9px',fontWeight:'600',color:'var(--color-dim)',marginTop:'6px',letterSpacing:'0.5px'}}>CURRENT WEIGHT</div>
      </div>
      <div style={{background:'var(--color-card)',border:'1px solid var(--color-border)',borderRadius:'10px',padding:'16px 12px',textAlign:'center'}}>
        <div style={{fontSize:'28px',fontWeight:'800',color:totalLost>0?'#22c55e':totalLost<0?'#ef4444':'var(--color-dim)',lineHeight:'1'}}>{totalLost>0?'-':totalLost<0?'+':''}{Math.abs(totalLost)}</div>
        <div style={{fontSize:'18px',fontWeight:'700',color:totalLost>0?'#22c55e':totalLost<0?'#ef4444':'var(--color-dim)',marginTop:'2px'}}>lbs</div>
        <div style={{fontSize:'9px',fontWeight:'600',color:'var(--color-dim)',marginTop:'6px',letterSpacing:'0.5px'}}>WEIGHT CHANGE</div>
        {weightStartDate&&<div style={{ fontSize: '9px', color: totalLost > 0 ? '#22c55e' : totalLost < 0 ? '#ef4444' : 'var(--color-text)', fontWeight: '600', marginTop: '4px' }}>since {formatDate(weightStartDate)}</div>}
      </div>
      <div style={{background:'var(--color-card)',border:'1px solid var(--color-border)',borderRadius:'10px',padding:'16px 12px',textAlign:'center',flex:'1'}}>
        <div style={{fontSize:'28px',fontWeight:'800',color:'var(--color-green)',lineHeight:'1'}}>{dueCompounds.length}</div>
        <div style={{fontSize:'9px',fontWeight:'600',color:'var(--color-dim)',marginTop:'8px',letterSpacing:'0.5px'}}>DUE TODAY</div>
        {dueCompounds.length>0?<div style={{fontSize:'10px',color:'var(--color-text)',marginTop:'8px',lineHeight:'1.3',fontWeight:'600'}}>{dueCompounds.map(c=>c.name.split('/')[0].split(' ')[0]).join(', ')}</div>:<div style={{fontSize:'11px',color:'var(--color-green)',marginTop:'8px',fontWeight:'700'}}>✓ ALL LOGGED</div>}
      </div>
    </div>
  )
}
