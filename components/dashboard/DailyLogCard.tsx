'use client'
// DailyLogCard � mood/energy/hunger/sleep/weight/notes form

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

function ScoreBtn({ value, current, onChange }: { value: number; current: number | null; onChange: (v: number) => void }) {
  const a = current === value
  const scoreColors = ['#ef4444','#f97316','#eab308','#84cc16','#22c55e']
  const sc = scoreColors[value-1]
  return (
    <button onClick={() => onChange(value)} style={{width:'36px',height:'36px',borderRadius:'50%',border:a?'none':'1px solid var(--color-border)',background:a?sc:'var(--color-card)',color:a?'#fff':'var(--color-dim)',fontSize:'13px',fontWeight:'700',cursor:'pointer',opacity:a?1:0.5}}>
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
        {saved && <span style={{fontSize:'11px',color:g}}>✓ saved</span>}
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
          <div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={energy} onChange={setEnergy} />)}</div>
        </div>
      </div>
      <div style={{marginBottom:'12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span style={{fontSize:'12px',color:dg}}>Hunger</span>
          <div style={{display:'flex',gap:'6px'}}>{[1,2,3,4,5].map(v => <ScoreBtn key={v} value={v} current={hunger} onChange={setHunger} />)}</div>
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
