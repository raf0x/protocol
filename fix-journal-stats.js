const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

// 1. Add imports for chart components and weightEntries state
content = content.replace(
  "import { createClient } from '../../lib/supabase'",
  "import { createClient } from '../../lib/supabase'\nimport { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'"
);

// 2. Add state for active protocol and showChart
content = content.replace(
  "  const [dueCompounds, setDueCompounds] = useState<DueCompound[]>([])\n  const [logs, setLogs] = useState<Record<string, LogEntry>>({})",
  "  const [dueCompounds, setDueCompounds] = useState<DueCompound[]>([])\n  const [logs, setLogs] = useState<Record<string, LogEntry>>({})\n  const [currentWeek, setCurrentWeek] = useState(0)\n  const [showChart, setShowChart] = useState(false)"
);

// 3. In loadAll, compute current week from active protocol
content = content.replace(
  "    const { data: protocols } = await supabase.from('protocols').select('id, start_date, name, compounds(id, name, phases(dose, dose_unit, frequency, day_of_week, start_week, end_week))').eq('status', 'active')",
  `    const { data: protocols } = await supabase.from('protocols').select('id, start_date, name, compounds(id, name, phases(dose, dose_unit, frequency, day_of_week, start_week, end_week))').eq('status', 'active')
    if (protocols && protocols.length > 0) {
      const earliestStart = protocols.reduce((min: string, p: any) => p.start_date < min ? p.start_date : min, protocols[0].start_date)
      const startMs = new Date(earliestStart + 'T00:00:00').getTime()
      const daysIn = Math.floor((Date.now() - startMs) / 86400000)
      setCurrentWeek(Math.max(1, Math.floor(daysIn / 7) + 1))
    }`
);

// 4. Compute stats inline before render
content = content.replace(
  "  if (loading) return <main style={{minHeight:'100vh',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>",
  `  const weightEntries = entries.filter((e: any) => e.weight).sort((a, b) => a.date.localeCompare(b.date))
  const startWeight = weightEntries[0]?.weight
  const latestWeight = weightEntries[weightEntries.length - 1]?.weight
  const totalLost = (startWeight && latestWeight) ? (startWeight - latestWeight).toFixed(1) : null
  const chartData = entries.slice().sort((a, b) => a.date.localeCompare(b.date)).map((e: any) => ({
    date: new Date(e.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    mood: e.mood, energy: e.energy, sleep: e.sleep, weight: e.weight
  }))
  const tooltipStyle = { contentStyle: { background: cb, border: '1px solid '+bd, borderRadius: '6px', fontSize: '12px' } }

  if (loading) return <main style={{minHeight:'100vh',color:dg,display:'flex',alignItems:'center',justifyContent:'center'}}>Loading...</main>`
);

// 5. Insert stats header after the h1 + subtitle
content = content.replace(
  "        <p style={{color:dg,fontSize:'13px',marginBottom:'20px'}}>Log your day. Track your progress.</p>\n",
  `        <p style={{color:dg,fontSize:'13px',marginBottom:'16px'}}>Log your day. Track your progress.</p>

        {/* Stats header */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'8px',marginBottom:'16px'}}>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:g}}>{totalLost !== null ? totalLost : '—'}{totalLost !== null ? ' lbs' : ''}</div>
            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>TOTAL LOST</div>
          </div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:'#6c63ff'}}>{currentWeek > 0 ? 'Wk ' + currentWeek : '—'}</div>
            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>CURRENT WEEK</div>
          </div>
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}>
            <div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{latestWeight ? latestWeight : '—'}{latestWeight ? ' lbs' : ''}</div>
            <div style={{fontSize:'10px',color:mg,marginTop:'2px',letterSpacing:'1px'}}>CURRENT</div>
          </div>
        </div>

`
);

// 6. Add Show Chart toggle button and chart panel right before Today's injections block
content = content.replace(
  "        {/* Today's injections */}",
  `        {/* Chart toggle */}
        {entries.length > 1 && (
          <div style={{marginBottom:'16px'}}>
            <button onClick={() => setShowChart(!showChart)} style={{width:'100%',background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>
              {showChart ? 'Hide chart' : 'Show chart'}
            </button>
          </div>
        )}

        {showChart && chartData.length > 1 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px',marginBottom:'16px'}}>
            <p style={{fontSize:'11px',color:mg,marginBottom:'8px',letterSpacing:'1px',fontWeight:'600'}}>MOOD & ENERGY</p>
            <ResponsiveContainer width='100%' height={120}>
              <LineChart data={chartData}>
                <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} />
                <YAxis domain={[1,5]} tick={{fontSize:10,fill:mg}} width={20} />
                <Tooltip {...tooltipStyle} />
                <Line type='monotone' dataKey='mood' stroke={g} strokeWidth={2} dot={false} name='Mood' />
                <Line type='monotone' dataKey='energy' stroke='#f59e0b' strokeWidth={2} dot={false} name='Energy' />
              </LineChart>
            </ResponsiveContainer>
            <p style={{fontSize:'11px',color:mg,marginBottom:'8px',marginTop:'16px',letterSpacing:'1px',fontWeight:'600'}}>SLEEP</p>
            <ResponsiveContainer width='100%' height={100}>
              <LineChart data={chartData}>
                <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} />
                <YAxis tick={{fontSize:10,fill:mg}} width={20} />
                <Tooltip {...tooltipStyle} />
                <Line type='monotone' dataKey='sleep' stroke='#7fff7f' strokeWidth={2} dot={false} name='Sleep' />
              </LineChart>
            </ResponsiveContainer>
            {weightEntries.length > 1 && (<>
              <p style={{fontSize:'11px',color:mg,marginBottom:'8px',marginTop:'16px',letterSpacing:'1px',fontWeight:'600'}}>WEIGHT</p>
              <ResponsiveContainer width='100%' height={100}>
                <LineChart data={chartData.filter(d => d.weight)}>
                  <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} />
                  <YAxis tick={{fontSize:10,fill:mg}} width={30} domain={['auto','auto']} />
                  <Tooltip {...tooltipStyle} />
                  <Line type='monotone' dataKey='weight' stroke='#8b5cf6' strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} name='Weight' />
                </LineChart>
              </ResponsiveContainer>
            </>)}
          </div>
        )}

        {/* Today's injections */}`
);

fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
