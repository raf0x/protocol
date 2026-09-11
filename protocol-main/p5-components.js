const fs = require('fs');

// Create components/dashboard/StatsBar.tsx
const statsBar = `'use client'
// StatsBar — the three top tiles: current weight, weight change, cycle rings

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
        <div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{currentWeight ? currentWeight+' lbs' : '\u2014'}</div>
        <div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>CURRENT WEIGHT</div>
      </div>
      <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <div style={{fontSize:'20px',fontWeight:'900',color:totalLost !== null ? (parseFloat(totalLost) > 0 ? g : '#ff6b6b') : g}}>
          {totalLost !== null ? (parseFloat(totalLost) > 0 ? '-'+Math.abs(parseFloat(totalLost)) : '+'+Math.abs(parseFloat(totalLost)))+' lbs' : '\u2014'}
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
                  background:isActive?rc+'44':cb,
                  zIndex:row+col,position:'relative',cursor:'pointer',
                  boxShadow:isActive?'0 0 18px '+rc+', 0 0 6px '+rc:'none',
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
`;

// Create components/dashboard/InsightsCard.tsx
const insightsCard = `'use client'
// InsightsCard — computed text insights from journal data

type Insight = { text: string; accent: string }

type Props = {
  insights: Insight[]
}

export default function InsightsCard({ insights }: Props) {
  if (insights.length === 0) return null
  return (
    <div style={{background:'var(--color-card)',border:'1px solid var(--color-border)',borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
      <div style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px',marginBottom:'10px'}}>INSIGHTS</div>
      {insights.map((ins, i) => (
        <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0',fontSize:'13px',color:'var(--color-text)'}}>
          <span style={{color:ins.accent,fontWeight:'700'}}>\u2192</span>
          <span>{ins.text}</span>
        </div>
      ))}
    </div>
  )
}
`;

// Create components/dashboard/DailyLogCard.tsx
const dailyLog = `'use client'
// DailyLogCard — mood/energy/hunger/sleep/weight/notes form

type Props = {
  mood: number | null
  energy: number | null
  hunger: number | null
  sleep: string
  weight: string
  entryNotes: string
  saving: boolean
  saved: boolean
  setMood: (v: number) => void
  setEnergy: (v: number) => void
  setHunger: (v: number) => void
  setSleep: (v: string) => void
  setWeight: (v: string) => void
  setEntryNotes: (v: string) => void
  saveEntry: () => void
}

function ScoreBtn({ value, current, onChange, activeColor }: { value: number; current: number | null; onChange: (v: number) => void; activeColor?: string }) {
  const c = activeColor || 'var(--color-green)'
  const a = current === value
  return (
    <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:a?'none':'1px solid var(--color-border)',background:a?c:'var(--color-card)',color:a?'var(--color-green-text)':'var(--color-dim)',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>
      {value}
    </button>
  )
}

export default function DailyLogCard({ mood, energy, hunger, sleep, weight, entryNotes, saving, saved, setMood, setEnergy, setHunger, setSleep, setWeight, setEntryNotes, saveEntry }: Props) {
  const g = 'var(--color-green)'
  const dg = 'var(--color-dim)'
  const mg = 'var(--color-muted)'
  const bd = 'var(--color-border)'

  return (
    <div style={{background:'var(--color-card)',border:'1px solid var(--color-border)',borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
        <span style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px'}}>DAILY LOG</span>
        {saved && <span style={{fontSize:'11px',color:g}}>\u2713 saved</span>}
      </div>
      <div style={{marginBottom:'12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:'12px',color:dg}}>Mood</span>
          <div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={mood} onChange={setMood} />)}</div>
        </div>
      </div>
      <div style={{marginBottom:'12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:'12px',color:dg}}>Energy</span>
          <div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={energy} onChange={setEnergy} activeColor='#f97316' />)}</div>
        </div>
      </div>
      <div style={{marginBottom:'12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:'12px',color:dg}}>Hunger</span>
          <div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={hunger} onChange={setHunger} activeColor='#8b5cf6' />)}</div>
        </div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px'}}>
        <div>
          <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px'}}>Sleep (hrs)</span>
          <input type='number' step='0.5' value={sleep} onChange={e => setSleep(e.target.value)} placeholder='7.5' style={{width:'100%',background:'var(--color-input)',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box'}} />
        </div>
        <div>
          <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px'}}>Weight (lbs)</span>
          <input type='number' step='0.1' value={weight} onChange={e => setWeight(e.target.value)} placeholder='optional' style={{width:'100%',background:'var(--color-input)',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'var(--color-text)',fontSize:'14px',boxSizing:'border-box'}} />
        </div>
      </div>
      <textarea value={entryNotes} onChange={e => setEntryNotes(e.target.value)} placeholder='Notes...' rows={2} style={{width:'100%',background:'var(--color-input)',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'var(--color-text)',fontSize:'13px',boxSizing:'border-box',resize:'none',marginBottom:'12px'}} />
      <button onClick={saveEntry} disabled={saving} style={{width:'100%',background:saving?'var(--color-green-20)':g,color:saving?mg:'var(--color-green-text)',border:'none',borderRadius:'6px',padding:'10px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>
        {saving ? 'Saving...' : saved ? 'Update' : 'Save'}
      </button>
    </div>
  )
}
`;

// Make sure directory exists
if (!fs.existsSync('components/dashboard')) fs.mkdirSync('components/dashboard');

fs.writeFileSync('components/dashboard/StatsBar.tsx', statsBar, 'utf8');
fs.writeFileSync('components/dashboard/InsightsCard.tsx', insightsCard, 'utf8');
fs.writeFileSync('components/dashboard/DailyLogCard.tsx', dailyLog, 'utf8');
console.log('Created components/dashboard/ with 3 sub-components');

// Now update protocol/page.tsx to import these
let protocol = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add imports
protocol = protocol.replace(
  `import { createClient } from '../../lib/supabase'`,
  `import { createClient } from '../../lib/supabase'
import StatsBar from '../../components/dashboard/StatsBar'
import InsightsCard from '../../components/dashboard/InsightsCard'
import DailyLogCard from '../../components/dashboard/DailyLogCard'`
);

// Replace Stats section
protocol = protocol.replace(
  `        {/* Stats */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}}>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{lw ? lw+' lbs' : '\u2014'}</div><div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>CURRENT WEIGHT</div></div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:tl !== null ? (parseFloat(tl) > 0 ? g : '#ff6b6b') : g}}>{tl !== null ? (parseFloat(tl) > 0 ? '-'+Math.abs(parseFloat(tl)) : '+'+Math.abs(parseFloat(tl)))+' lbs' : '\u2014'}</div><div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>WEIGHT CHANGE</div></div>`,
  `        {/* Stats — StatsBar component */}
        <StatsBar
          currentWeight={lw ?? null}
          totalLost={tl}
          activeProtocols={activeProtocols}
          activeCompoundTab={activeCompoundTab}
          setActiveCompoundTab={setActiveCompoundTab}
        />`
);

// Replace Insights section
protocol = protocol.replace(
  `        {/* Insights */}
        {vi.length > 0 && (<div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}><div style={{fontSize:'11px',fontWeight:'700',color:'var(--color-text)',letterSpacing:'1px',marginBottom:'10px'}}>INSIGHTS</div>{vi.map((ins2, i) => (<div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0',fontSize:'13px',color:'var(--color-text)'}}><span style={{color:ins2.accent,fontWeight:'700'}}>\u2192</span><span>{ins2.text}</span></div>))}</div>)}`,
  `        {/* Insights — InsightsCard component */}
        <InsightsCard insights={vi} />`
);

fs.writeFileSync('app/protocol/page.tsx', protocol, 'utf8');
console.log('Updated protocol/page.tsx to use sub-components');
console.log('Priority 5 done!');
