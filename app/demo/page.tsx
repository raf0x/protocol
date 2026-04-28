'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

const DEMO_COMPOUNDS = [
  { id: 'demo-1', name: 'Retatrutide', vial_strength: 10, vial_unit: 'mg', bac_water_ml: 3, reconstitution_date: '2026-04-22', doses_taken_override: 1, ml_per_dose: 0.6, vials_in_stock: 2, phases: [{ name: 'Loading up Reta', dose: 60, dose_unit: 'IU', frequency: '1x/week', start_week: 1, end_week: 12, time_of_day: 'morning' }] },
  { id: 'demo-2', name: 'BPC-157/TB-500', vial_strength: 10, vial_unit: 'mg', bac_water_ml: 3, reconstitution_date: '2026-04-17', doses_taken_override: 4, ml_per_dose: 0.5, vials_in_stock: 1, phases: [{ name: 'Healing Phase', dose: 50, dose_unit: 'IU', frequency: 'every3days', start_week: 1, end_week: 4, time_of_day: 'morning' }] },
  { id: 'demo-3', name: 'CJC/Ipamorelin', vial_strength: 5, vial_unit: 'mg', bac_water_ml: 2, reconstitution_date: '2026-04-20', doses_taken_override: 6, ml_per_dose: 0.1, vials_in_stock: 3, phases: [{ name: 'Phase 1', dose: 10, dose_unit: 'IU', frequency: '5x/week', start_week: 1, end_week: 12, time_of_day: 'night' }] },
  { id: 'demo-4', name: 'GHK-Cu', vial_strength: 50, vial_unit: 'mg', bac_water_ml: 3, reconstitution_date: '2026-04-22', doses_taken_override: 3, ml_per_dose: 0.12, vials_in_stock: 2, phases: [{ name: 'Phase 1', dose: 12, dose_unit: 'IU', frequency: 'daily', start_week: 1, end_week: 8, time_of_day: 'morning' }] },
]

const DEMO_ENTRIES = [
  { date: '2026-04-27', mood: 4, energy: 4, sleep: 7.5, weight: 172.4, hunger: 2 },
  { date: '2026-04-26', mood: 4, energy: 3, sleep: 7.0, weight: 172.8, hunger: 2 },
  { date: '2026-04-25', mood: 3, energy: 3, sleep: 6.5, weight: 173.0, hunger: 3 },
  { date: '2026-04-24', mood: 4, energy: 4, sleep: 8.0, weight: 173.4, hunger: 2 },
  { date: '2026-04-23', mood: 3, energy: 3, sleep: 7.0, weight: 173.8, hunger: 2 },
  { date: '2026-04-22', mood: 4, energy: 4, sleep: 7.5, weight: 174.2, hunger: 2 },
  { date: '2026-04-21', mood: 3, energy: 3, sleep: 6.0, weight: 174.6, hunger: 3 },
  { date: '2026-04-20', mood: 4, energy: 4, sleep: 7.5, weight: 175.0, hunger: 2 },
  { date: '2026-04-17', mood: 3, energy: 3, sleep: 7.0, weight: 176.2, hunger: 3 },
  { date: '2026-04-10', mood: 3, energy: 2, sleep: 6.5, weight: 178.0, hunger: 4 },
  { date: '2026-04-03', mood: 3, energy: 3, sleep: 7.0, weight: 180.0, hunger: 4 },
  { date: '2026-03-27', mood: 3, energy: 3, sleep: 7.5, weight: 181.0, hunger: 4 },
  { date: '2026-03-20', mood: 2, energy: 2, sleep: 6.0, weight: 182.0, hunger: 5 },
]

const RING_COLORS = ['#39ff14','#06b6d4','#f59e0b','#8b5cf6']
const START_DATE = '2026-03-15'

function SignupModal({ onClose, router }: { onClose: () => void; router: any }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.85)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'24px'}}>
      <div style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'16px',padding:'28px',width:'100%',maxWidth:'360px'}}>
        <div style={{fontSize:'24px',marginBottom:'8px',textAlign:'center'}}>??</div>
        <h3 style={{fontSize:'20px',fontWeight:'900',color:'white',marginBottom:'6px',textAlign:'center'}}>Save your progress</h3>
        <p style={{fontSize:'13px',color:'#8b8ba7',marginBottom:'24px',textAlign:'center',lineHeight:'1.6'}}>Create your free account to track your own protocol. No credit card required.</p>
        <input type='email' value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter' && email.includes('@') && router.push('/auth/login?email='+encodeURIComponent(email))} placeholder='your@email.com' style={{width:'100%',background:'#0a0a0f',border:'1px solid #1e1e2e',borderRadius:'8px',padding:'14px',color:'white',fontSize:'16px',boxSizing:'border-box',marginBottom:'12px',outline:'none'}} autoFocus />
        <button onClick={() => email.includes('@') && router.push('/auth/login?email='+encodeURIComponent(email))} disabled={!email.includes('@')} style={{width:'100%',background:'#39ff14',color:'#000',border:'none',borderRadius:'8px',padding:'14px',fontSize:'16px',fontWeight:'800',cursor:'pointer',marginBottom:'10px',opacity:email.includes('@')?1:0.5}}>Get started free →</button>
        <button onClick={onClose} style={{width:'100%',background:'none',border:'none',color:'#3d3d5c',cursor:'pointer',fontSize:'13px'}}>Continue exploring demo</button>
      </div>
    </div>
  )
}

export default function DemoPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('demo-1')
  const [showSignup, setShowSignup] = useState(false)
  const [showChart, setShowChart] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [loggedToday, setLoggedToday] = useState<Record<string,boolean>>({})
  const [mood, setMood] = useState<number|null>(null)
  const [energy, setEnergy] = useState<number|null>(null)
  const [hunger, setHunger] = useState<number|null>(null)
  const [sleep, setSleep] = useState('')
  const [weight, setWeight] = useState('')

  const g = '#39ff14', dg = '#8b8ba7', mg = '#3d3d5c', cb = '#12121a', bd = '#1e1e2e'
  const startWeight = DEMO_ENTRIES[DEMO_ENTRIES.length-1].weight
  const currentWeight = DEMO_ENTRIES[0].weight
  const totalLost = (startWeight - currentWeight).toFixed(1)
  const daysIn = Math.floor((Date.now() - new Date(START_DATE+'T00:00:00').getTime()) / 86400000)
  const currentWeek = Math.max(1, Math.floor(daysIn/7)+1)

  const activeCompound = DEMO_COMPOUNDS.find(c => c.id === activeTab) || DEMO_COMPOUNDS[0]
  const compoundIndex = DEMO_COMPOUNDS.findIndex(c => c.id === activeTab)
  const color = RING_COLORS[compoundIndex] || g
  const phase = activeCompound.phases[0]
  const mlUsed = activeCompound.doses_taken_override * activeCompound.ml_per_dose
  const fillPct = Math.max(0, (activeCompound.bac_water_ml - mlUsed) / activeCompound.bac_water_ml)
  const vialDaysLeft = 28 - Math.floor((Date.now() - new Date(activeCompound.reconstitution_date+'T00:00:00').getTime()) / 86400000)
  const progress = Math.min(100, Math.round((daysIn / (phase.end_week * 7)) * 100))

  const cd = DEMO_ENTRIES.slice().reverse().map(e => ({ date: new Date(e.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}), mood: e.mood, energy: e.energy, sleep: e.sleep, weight: e.weight }))

  function save() { setShowSignup(true) }
  function logInjection(id: string) { setLoggedToday(p => ({...p,[id]:!p[id]})); if (!loggedToday[id]) setTimeout(() => setShowSignup(true), 1000) }

  return (
    <main style={{minHeight:'100vh',background:'#0c0c14',color:'white',padding:'0',fontFamily:'Inter,sans-serif'}}>
      {showSignup && <SignupModal onClose={() => setShowSignup(false)} router={router} />}

      {/* Demo banner */}
      <div style={{background:'rgba(57,255,20,0.08)',borderBottom:'1px solid rgba(57,255,20,0.2)',padding:'10px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,zIndex:50,backdropFilter:'blur(8px)'}}>
        <span style={{fontSize:'12px',color:'#39ff14',fontWeight:'600'}}>?? You're viewing a live demo</span>
        <button onClick={save} style={{background:'#39ff14',color:'#000',border:'none',borderRadius:'6px',padding:'6px 14px',fontSize:'12px',fontWeight:'800',cursor:'pointer'}}>Sign up free</button>
      </div>

      <div style={{padding:'24px 22px 100px',maxWidth:'540px',margin:'0 auto'}}>
        <h1 style={{fontSize:'24px',fontWeight:'bold',color:g,marginBottom:'4px'}}>Dashboard</h1>
        <p style={{color:dg,fontSize:'13px',marginBottom:'16px'}}>Every day logged is data working for you.</p>

        {/* Stats + Rings */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}}>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{currentWeight} lbs</div>
            <div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>CURRENT WEIGHT</div>
          </div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:g}}>-{totalLost} lbs</div>
            <div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>WEIGHT CHANGE</div>
          </div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0px'}}>
              {DEMO_COMPOUNDS.map((c, i) => {
                const rc = RING_COLORS[i]
                const isActive = activeTab === c.id
                const short = c.name.split('/')[0].split(' ')[0].slice(0,6)
                const di = Math.floor((Date.now()-new Date(START_DATE+'T00:00:00').getTime())/86400000)
                const wk = Math.max(1, Math.floor(di/7)+1)
                const col = i % 2; const row = Math.floor(i/2)
                return (
                  <div key={c.id} onClick={() => setActiveTab(c.id)} style={{width:'64px',height:'64px',borderRadius:'50%',border:(isActive?'4px':'3px')+' solid '+rc,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginRight:col===0?'-10px':'0',marginBottom:row===0?'-10px':'0',background:isActive?rc+'44':cb,cursor:'pointer',boxShadow:isActive?'0 0 18px '+rc+', 0 0 6px '+rc:'none',transform:isActive?'scale(1.15)':'scale(1)',transition:'all 0.2s ease',zIndex:isActive?2:1,position:'relative'}}>
                    <span style={{fontSize:'10px',fontWeight:'800',color:'white',textAlign:'center',lineHeight:'1.2'}}>{short}</span>
                    <span style={{fontSize:'10px',fontWeight:'600',color:rc,textAlign:'center',lineHeight:'1.2'}}>Wk {wk}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Hero card */}
        <div style={{background:'linear-gradient(135deg,#111111,#1a1a2e)',borderRadius:'16px',padding:'20px',marginBottom:'16px',border:'1px solid rgba(255,255,255,0.08)'}}>
          <div style={{fontSize:'10px',fontWeight:'700',color:'rgba(255,255,255,0.4)',letterSpacing:'2px',marginBottom:'6px'}}>ACTIVE COMPOUND</div>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div style={{flex:1,minWidth:0}}>
              <h2 style={{fontSize:'22px',fontWeight:'900',color:'white',marginBottom:'8px'}}>{activeCompound.name}</h2>
              <div style={{display:'flex',gap:'6px',marginBottom:'14px',flexWrap:'wrap'}}>
                <span style={{fontSize:'12px',fontWeight:'700',color:color,background:color+'18',padding:'3px 8px',borderRadius:'20px'}}>Week {currentWeek}</span>
                <span style={{fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>{phase.dose}{phase.dose_unit} · {phase.frequency}</span>
                <span style={{fontSize:'12px',fontWeight:'700',color:'#f59e0b',background:'rgba(245,158,11,0.1)',padding:'3px 8px',borderRadius:'20px'}}>-{totalLost} lbs</span>
              </div>
              <div style={{display:'flex',gap:'16px',marginBottom:'12px'}}>
                <div>
                  <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',fontWeight:'600',letterSpacing:'1px',marginBottom:'2px'}}>VIAL EXPIRES</div>
                  <div style={{fontSize:'13px',fontWeight:'700',color:vialDaysLeft<=5?'#ff6b6b':vialDaysLeft<=10?'#f59e0b':'rgba(255,255,255,0.8)'}}>{vialDaysLeft}d left</div>
                </div>
                <div>
                  <div style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',fontWeight:'600',letterSpacing:'1px',marginBottom:'2px'}}>EST. REMAINING</div>
                  <div style={{fontSize:'13px',fontWeight:'700',color:'rgba(255,255,255,0.8)'}}>{Math.max(0,activeCompound.bac_water_ml-mlUsed).toFixed(2)} mL</div>
                </div>
              </div>
              <div style={{marginBottom:'14px'}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                  <span style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',fontWeight:'600',letterSpacing:'1px'}}>PROTOCOL PROGRESS</span>
                  <span style={{fontSize:'9px',color:'rgba(255,255,255,0.5)',fontWeight:'700'}}>{progress}%</span>
                </div>
                <div style={{height:'4px',background:'rgba(255,255,255,0.08)',borderRadius:'2px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:progress+'%',background:'linear-gradient(90deg,'+color+','+color+'99)',borderRadius:'2px'}} />
                </div>
              </div>
              {/* Vial inventory section */}
              <div style={{borderTop:'1px solid rgba(255,255,255,0.1)',paddingTop:'10px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
                  <div>
                    <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',letterSpacing:'1px',fontWeight:'600',marginBottom:'2px'}}>mL PER DOSE</div>
                    <div style={{fontSize:'13px',color:'rgba(255,255,255,0.8)',fontWeight:'700'}}>{activeCompound.ml_per_dose} mL</div>
                  </div>
                  <button onClick={save} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'5px 10px',color:'rgba(255,255,255,0.5)',fontSize:'11px',cursor:'pointer'}}>Edit</button>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px',paddingTop:'6px',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
                  <div>
                    <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',letterSpacing:'1px',fontWeight:'600',marginBottom:'2px'}}>VIALS IN STOCK</div>
                    <div style={{fontSize:'13px',color:activeCompound.vials_in_stock<=1?'#ff6b6b':'rgba(255,255,255,0.8)',fontWeight:'700'}}>{activeCompound.vials_in_stock} vials</div>
                  </div>
                  <div style={{display:'flex',gap:'6px'}}>
                    <button onClick={save} style={{background:'rgba(57,255,20,0.1)',border:'1px solid rgba(57,255,20,0.3)',borderRadius:'6px',padding:'5px 10px',color:'#39ff14',fontSize:'11px',cursor:'pointer',fontWeight:'700'}}>+ New Vial</button>
                    <button onClick={save} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'5px 10px',color:'rgba(255,255,255,0.5)',fontSize:'11px',cursor:'pointer'}}>Edit</button>
                  </div>
                </div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:'6px',borderTop:'1px solid rgba(255,255,255,0.08)'}}>
                  <div>
                    <div style={{fontSize:'10px',color:'rgba(255,255,255,0.3)',letterSpacing:'1px',fontWeight:'600',marginBottom:'2px'}}>DOSES TAKEN (THIS VIAL)</div>
                    <div style={{fontSize:'13px',color:'rgba(255,255,255,0.8)',fontWeight:'700'}}>{activeCompound.doses_taken_override}</div>
                  </div>
                  <button onClick={save} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'5px 10px',color:'rgba(255,255,255,0.5)',fontSize:'11px',cursor:'pointer'}}>Edit</button>
                </div>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'10px'}}>
                <button onClick={save} style={{background:'none',border:'1px solid rgba(255,255,255,0.15)',borderRadius:'6px',padding:'6px 12px',color:'rgba(255,255,255,0.5)',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Share protocol →</button>
                <a href='/protocol/manage' onClick={e => {e.preventDefault();save()}} style={{color:'rgba(255,255,255,0.4)',textDecoration:'none',fontSize:'12px',fontWeight:'600'}}>+ Add / Edit Protocols →</a>
              </div>
            </div>
            {/* Vial SVG */}
            <div style={{marginLeft:'16px',flexShrink:0}}>
              <svg width='72' height='140' viewBox='0 0 72 140' fill='none'>
                <rect x='22' y='2' width='28' height='16' rx='5' fill={color} opacity='0.9'/>
                <rect x='26' y='16' width='20' height='8' rx='3' fill={color} opacity='0.5'/>
                <rect x='10' y='24' width='52' height='100' rx='8' fill='#0d0d1a' stroke={color} strokeWidth='1.2' strokeOpacity='0.5'/>
                <clipPath id='vc2'><rect x='10' y='24' width='52' height='100' rx='8'/></clipPath>
                {fillPct > 0 && <rect x='10' y={24+100*(1-fillPct)} width='52' height={100*fillPct} fill={color} opacity='0.35' clipPath='url(#vc2)'/>}
                {fillPct > 0.02 && <rect x='11' y={24+100*(1-fillPct)} width='50' height='3' fill={color} opacity='0.6' clipPath='url(#vc2)'/>}
                <rect x='14' y='28' width='7' height='40' rx='3.5' fill='white' opacity='0.06'/>
                {[0.25,0.5,0.75].map((t,i) => <line key={i} x1='52' y1={24+100*(1-t)} x2='62' y2={24+100*(1-t)} stroke={color} strokeWidth='1.5' opacity='0.8'/>)}
                <text x='36' y='68' textAnchor='middle' fontSize='8' fontWeight='800' fill={color} fontFamily='Inter,sans-serif'>{activeCompound.name.split('/')[0].split(' ')[0].slice(0,7)}</text>
                <text x='36' y='83' textAnchor='middle' fontSize='12' fontWeight='900' fill='white' fontFamily='Inter,sans-serif'>{Math.round(fillPct*100)}%</text>
              </svg>
            </div>
          </div>
        </div>

        {/* Today's injections */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',marginBottom:'16px',overflow:'hidden'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'14px 16px'}}>
            <span style={{fontSize:'13px',fontWeight:'800',color:'white'}}>TODAY'S INJECTIONS</span>
            <span style={{fontSize:'13px',fontWeight:'700',color:Object.values(loggedToday).filter(Boolean).length===4?g:dg}}>{Object.values(loggedToday).filter(Boolean).length}/{DEMO_COMPOUNDS.length}</span>
          </div>
          <div style={{padding:'0 16px 16px'}}>
            {DEMO_COMPOUNDS.map((c,i) => {
              const rc = RING_COLORS[i]
              const taken = loggedToday[c.id]
              return (
                <div key={c.id} style={{borderRadius:'10px',padding:'12px 14px',marginBottom:'8px',border:'1px solid '+(taken?rc+'44':'rgba(200,70,70,0.25)'),background:taken?(rc+'11'):'rgba(160,40,40,0.06)',transition:'all 0.2s'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                    <button onClick={() => logInjection(c.id)} style={{width:'28px',height:'28px',borderRadius:'7px',border:'1.5px solid '+(taken?rc:'rgba(200,80,80,0.5)'),background:taken?rc:'transparent',cursor:'pointer',color:'#000',fontWeight:'800',padding:0,fontSize:'14px'}}>{taken?'✓':''}</button>
                    <div>
                      <div style={{fontSize:'14px',fontWeight:'700',color:taken?dg:'white',textDecoration:taken?'line-through':'none'}}>{c.name}</div>
                      <div style={{fontSize:'12px',color:dg}}>{c.phases[0].dose}{c.phases[0].dose_unit} · {c.phases[0].time_of_day}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Insights */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
          <div style={{fontSize:'11px',fontWeight:'700',color:'white',letterSpacing:'1px',marginBottom:'10px'}}>INSIGHTS</div>
          {[
            {text:`You're down ${totalLost} lbs since you started � keep going`, accent:g},
            {text:`Averaging ${((startWeight-currentWeight)/6).toFixed(1)} lbs lost per week`, accent:g},
            {text:'Appetite suppressed � protocol is delivering', accent:'#8b5cf6'},
            {text:'Sleep averaging 7.2 hrs � recovery on track', accent:'#06b6d4'},
          ].map((ins,i) => (
            <div key={i} style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0',fontSize:'13px',color:'white'}}>
              <span style={{color:ins.accent,fontWeight:'700'}}>→</span><span>{ins.text}</span>
            </div>
          ))}
        </div>

        {/* Charts + Summary toggles */}
        <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
          <button onClick={() => setShowChart(!showChart)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>{showChart?'Hide charts':'Show charts'}</button>
          <button onClick={() => setShowSummary(!showSummary)} style={{flex:1,background:showSummary?'rgba(57,255,20,0.1)':cb,color:showSummary?g:dg,border:'1px solid '+(showSummary?'rgba(57,255,20,0.3)':bd),borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>Week recap</button>
        </div>

        {showChart && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <p style={{fontSize:'11px',color:mg,marginBottom:'8px',letterSpacing:'1px',fontWeight:'600'}}>MOOD, ENERGY & SLEEP</p>
            <ResponsiveContainer width='100%' height={140}>
              <LineChart data={cd}>
                <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} /><YAxis tick={{fontSize:10,fill:mg}} width={20} />
                <Tooltip contentStyle={{background:cb,border:'1px solid '+bd,borderRadius:'6px',fontSize:'12px'}} />
                <Line type='monotone' dataKey='mood' stroke={g} strokeWidth={2} dot={false} name='Mood' />
                <Line type='monotone' dataKey='energy' stroke='#f97316' strokeWidth={2} dot={false} name='Energy' />
                <Line type='monotone' dataKey='sleep' stroke='#06b6d4' strokeWidth={2} dot={false} name='Sleep' />
              </LineChart>
            </ResponsiveContainer>
            <p style={{fontSize:'11px',color:mg,marginBottom:'8px',marginTop:'16px',letterSpacing:'1px',fontWeight:'600'}}>WEIGHT</p>
            <ResponsiveContainer width='100%' height={100}>
              <LineChart data={cd.filter(d => d.weight)}>
                <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} /><YAxis tick={{fontSize:10,fill:mg}} width={30} domain={['auto','auto']} />
                <Tooltip contentStyle={{background:cb,border:'1px solid '+bd,borderRadius:'6px',fontSize:'12px'}} />
                <Line type='monotone' dataKey='weight' stroke='#8b5cf6' strokeWidth={2} dot={{r:3,fill:'#8b5cf6'}} name='Weight' />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {showSummary && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'white',letterSpacing:'1px',marginBottom:'12px'}}>WEEK {currentWeek} RECAP</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'}}>
              {[{label:'DAYS LOGGED',value:'7/7',color:g},{label:'WEIGHT CHANGE',value:'-1.8 lbs',color:g},{label:'AVG MOOD',value:'3.7',color:'#f97316'},{label:'AVG SLEEP',value:'7.1h',color:'#06b6d4'}].map((s,i) => (
                <div key={i} style={{background:'#0a0a0f',borderRadius:'8px',padding:'10px',textAlign:'center'}}>
                  <div style={{fontSize:'22px',fontWeight:'900',color:s.color}}>{s.value}</div>
                  <div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px'}}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Daily log */}
        <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
          <div style={{fontSize:'11px',fontWeight:'700',color:'white',letterSpacing:'1px',marginBottom:'14px'}}>DAILY LOG</div>
          {[{label:'Mood',val:mood,set:setMood,ac:g},{label:'Energy',val:energy,set:setEnergy,ac:'#f97316'},{label:'Hunger',val:hunger,set:setHunger,ac:'#8b5cf6'}].map(({label,val,set,ac}) => (
            <div key={label} style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
              <span style={{fontSize:'12px',color:dg}}>{label}</span>
              <div style={{display:'flex',gap:'6px'}}>
                {[1,2,3,4,5].map(v => (
                  <button key={v} onClick={() => { set(v); setTimeout(save, 1500) }} style={{width:'36px',height:'36px',borderRadius:'50%',border:val===v?'none':'1px solid '+bd,background:val===v?ac:cb,color:val===v?'#000':dg,fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>{v}</button>
                ))}
              </div>
            </div>
          ))}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'12px'}}>
            <div>
              <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px'}}>Sleep (hrs)</span>
              <input type='number' step='0.5' value={sleep} onChange={e => setSleep(e.target.value)} onFocus={save} placeholder='7.5' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'14px',boxSizing:'border-box'}} />
            </div>
            <div>
              <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'4px'}}>Weight (lbs)</span>
              <input type='number' step='0.1' value={weight} onChange={e => setWeight(e.target.value)} onFocus={save} placeholder='optional' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'14px',boxSizing:'border-box'}} />
            </div>
          </div>
          <button onClick={save} style={{width:'100%',background:g,color:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'14px',fontWeight:'700',cursor:'pointer'}}>Save today's log</button>
        </div>

        {/* CTA */}
        <div style={{background:'rgba(57,255,20,0.05)',border:'1px solid rgba(57,255,20,0.2)',borderRadius:'12px',padding:'20px',textAlign:'center'}}>
          <div style={{fontSize:'16px',fontWeight:'800',color:'white',marginBottom:'6px'}}>Ready to track your own protocol?</div>
          <div style={{fontSize:'13px',color:dg,marginBottom:'16px'}}>Free account. No credit card. 30 seconds to set up.</div>
          <button onClick={save} style={{background:g,color:'#000',border:'none',borderRadius:'8px',padding:'14px 32px',fontSize:'15px',fontWeight:'800',cursor:'pointer'}}>Get started free →</button>
        </div>
      </div>

      {/* Bottom nav */}
      <nav style={{position:'fixed',bottom:0,left:0,right:0,background:'#0a0a0f',borderTop:'1px solid #1e1e2e',display:'flex',justifyContent:'space-around',alignItems:'center',padding:'14px 8px 28px',zIndex:50}}>
        {[{label:'🧮',active:false},{label:'Dashboard',active:true},{label:'History',active:false},{label:'Profile',active:false}].map((t,i) => (
          <button key={i} onClick={save} style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',background:'none',border:'none',cursor:'pointer',flex:1}}>
            <span style={{width:'5px',height:'5px',borderRadius:'50%',background:t.active?g:'transparent',display:'block'}} />
            <span style={{color:t.active?g:'#6b7280',fontSize:'11px',fontWeight:'700'}}>{t.label}</span>
          </button>
        ))}
      </nav>
    </main>
  )
}