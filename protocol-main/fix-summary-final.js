const fs = require('fs');
const content = `'use client'
// WeeklySummary - shown on Sundays by default, togglable any day

type Entry = {
  date: string
  mood: number | null
  energy: number | null
  sleep: number | null
  weight: number | null
  hunger: number | null
}

type Props = {
  entries: Entry[]
  currentWeek: number
  show: boolean
}

export default function WeeklySummary({ entries, currentWeek, show }: Props) {
  if (!show || entries.length < 3) return null

  const week = entries.slice(0, 7)
  const logged = week.length
  const avgMood = week.filter(e => e.mood).reduce((s, e) => s + (e.mood||0), 0) / (week.filter(e => e.mood).length || 1)
  const avgSleep = week.filter(e => e.sleep).reduce((s, e) => s + (e.sleep||0), 0) / (week.filter(e => e.sleep).length || 1)
  const weights = week.filter(e => e.weight).map(e => e.weight as number)
  const weightChange = weights.length >= 2 ? (weights[weights.length-1] - weights[0]).toFixed(1) : null
  const g = 'var(--color-green)'

  return (
    <div style={{background:'var(--color-card)',border:'1px solid var(--color-border)',borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
      <div style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px',marginBottom:'12px'}}>WEEK {currentWeek} RECAP</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px'}}>
        <div style={{background:'var(--color-surface)',borderRadius:'8px',padding:'10px',textAlign:'center'}}>
          <div style={{fontSize:'22px',fontWeight:'900',color:g}}>{logged}/7</div>
          <div style={{fontSize:'10px',color:'var(--color-dim)',marginTop:'2px',letterSpacing:'1px'}}>DAYS LOGGED</div>
        </div>
        <div style={{background:'var(--color-surface)',borderRadius:'8px',padding:'10px',textAlign:'center'}}>
          <div style={{fontSize:'22px',fontWeight:'900',color:weightChange !== null ? (parseFloat(weightChange) <= 0 ? g : '#ff6b6b') : 'var(--color-muted)'}}>
            {weightChange !== null ? (parseFloat(weightChange) > 0 ? '+' : '') + weightChange + ' lbs' : 'No data'}
          </div>
          <div style={{fontSize:'10px',color:'var(--color-dim)',marginTop:'2px',letterSpacing:'1px'}}>WEIGHT CHANGE</div>
        </div>
        <div style={{background:'var(--color-surface)',borderRadius:'8px',padding:'10px',textAlign:'center'}}>
          <div style={{fontSize:'22px',fontWeight:'900',color:'#f97316'}}>{week.filter(e => e.mood).length ? avgMood.toFixed(1) : '\u2014'}</div>
          <div style={{fontSize:'10px',color:'var(--color-dim)',marginTop:'2px',letterSpacing:'1px'}}>AVG MOOD</div>
        </div>
        <div style={{background:'var(--color-surface)',borderRadius:'8px',padding:'10px',textAlign:'center'}}>
          <div style={{fontSize:'22px',fontWeight:'900',color:'#06b6d4'}}>{week.filter(e => e.sleep).length ? avgSleep.toFixed(1)+'h' : '\u2014'}</div>
          <div style={{fontSize:'10px',color:'var(--color-dim)',marginTop:'2px',letterSpacing:'1px'}}>AVG SLEEP</div>
        </div>
      </div>
      <p style={{fontSize:'12px',color:'var(--color-dim)',margin:0,textAlign:'center'}}>
        {logged >= 6 ? 'Excellent consistency this week.' : logged >= 4 ? 'Good week. Keep the streak going.' : 'Log more days for better insights.'}
      </p>
    </div>
  )
}
`;
fs.writeFileSync('components/dashboard/WeeklySummary.tsx', content, 'utf8');
console.log('Done!');
