const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

// Add types and helper for due compounds after the existing JournalEntry type
content = content.replace(
  "type JournalEntry = { id: string; date: string; mood: number; energy: number; sleep: number; notes: string }",
  `type JournalEntry = { id: string; date: string; mood: number; energy: number; sleep: number; notes: string }
type DueCompound = { id: string; name: string; dose: number; unit: string; frequency: string; start_date: string; protocol_name: string }
type LogEntry = { compound_id: string; taken: boolean; discomfort: number }

function isDueToday(frequency: string, start_date: string): boolean {
  if (!start_date) return false
  const start = new Date(start_date + 'T00:00:00')
  const today = new Date()
  today.setHours(0,0,0,0)
  const daysDiff = Math.floor((today.getTime() - start.getTime()) / (1000*60*60*24))
  if (daysDiff < 0) return false
  if (frequency === 'daily') return true
  if (frequency === 'eod') return daysDiff % 2 === 0
  if (frequency === 'every3days') return daysDiff % 3 === 0
  if (frequency === 'every4days') return daysDiff % 4 === 0
  if (frequency === 'every5days') return daysDiff % 5 === 0
  if (frequency === 'monthly') return daysDiff % 30 === 0
  const startDay = start.getDay()
  const todayDay = today.getDay()
  const weekOffset = Math.floor(daysDiff / 7)
  if (frequency === '1x/week') return daysDiff % 7 === 0
  if (frequency === '2x/week') { const d = (todayDay - startDay + 7) % 7; return d === 0 || d === 3 }
  if (frequency === '3x/week') { const d = (todayDay - startDay + 7) % 7; return d === 0 || d === 2 || d === 4 }
  if (frequency === '4x/week') { const d = (todayDay - startDay + 7) % 7; return d === 0 || d === 2 || d === 4 || d === 6 }
  if (frequency === '5x/week') { const d = (todayDay - startDay + 7) % 7; return d !== 5 && d !== 6 }
  if (frequency === '6x/week') { const d = (todayDay - startDay + 7) % 7; return d !== 6 }
  return false
}`
);

// Add state for due compounds and logs
content = content.replace(
  "  const [showChart, setShowChart] = useState(false)",
  `  const [showChart, setShowChart] = useState(false)
  const [dueCompounds, setDueCompounds] = useState<DueCompound[]>([])
  const [logs, setLogs] = useState<Record<string, LogEntry>>({})`
);

// Update loadEntries to also load due compounds and today's logs
content = content.replace(
  `  async function loadEntries() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('journal_entries').select('*').order('date', { ascending: true })
    setEntries(data || [])
    setLoading(false)
  }`,
  `  async function loadEntries() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await supabase.from('journal_entries').select('*').order('date', { ascending: true })
    setEntries(data || [])
    const { data: compoundsData } = await supabase.from('compounds').select('id, name, dose, unit, frequency, start_date, protocols(name)')
    const dueList: DueCompound[] = []
    ;(compoundsData || []).forEach((c: any) => {
      if (isDueToday(c.frequency, c.start_date)) {
        dueList.push({ id: c.id, name: c.name, dose: c.dose, unit: c.unit, frequency: c.frequency, start_date: c.start_date, protocol_name: c.protocols?.name || '' })
      }
    })
    setDueCompounds(dueList)
    const todayStr = new Date().toISOString().split('T')[0]
    const { data: logsData } = await supabase.from('protocol_logs').select('*').eq('date', todayStr)
    const logsMap: Record<string, LogEntry> = {}
    ;(logsData || []).forEach((l: any) => { logsMap[l.compound_id] = { compound_id: l.compound_id, taken: l.taken, discomfort: l.discomfort } })
    setLogs(logsMap)
    setLoading(false)
  }

  async function toggleLog(compoundId: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const todayStr = new Date().toISOString().split('T')[0]
    const current = logs[compoundId]
    const newTaken = !current?.taken
    await supabase.from('protocol_logs').upsert({ user_id: user.id, compound_id: compoundId, date: todayStr, taken: newTaken, discomfort: current?.discomfort || 0 }, { onConflict: 'user_id,compound_id,date' })
    setLogs({ ...logs, [compoundId]: { compound_id: compoundId, taken: newTaken, discomfort: current?.discomfort || 0 } })
  }

  async function setDiscomfort(compoundId: string, level: number) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const todayStr = new Date().toISOString().split('T')[0]
    const current = logs[compoundId]
    await supabase.from('protocol_logs').upsert({ user_id: user.id, compound_id: compoundId, date: todayStr, taken: true, discomfort: level }, { onConflict: 'user_id,compound_id,date' })
    setLogs({ ...logs, [compoundId]: { compound_id: compoundId, taken: true, discomfort: level } })
  }`
);

// Insert "Today's injections" section right after the progress rings card (before the weekly comparison)
content = content.replace(
  "        {thisWeek && lastWeek && (",
  `        {dueCompounds.length > 0 && (
          <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'14px'}}>
              <h2 style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px'}}>TODAY'S INJECTIONS</h2>
              <span style={{fontSize:'12px',color:mg}}>{Object.values(logs).filter(l => l.taken).length}/{dueCompounds.length}</span>
            </div>
            {dueCompounds.map(c => {
              const log = logs[c.id]
              const taken = log?.taken || false
              const discomfort = log?.discomfort || 0
              return (
                <div key={c.id} style={{background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'8px',padding:'12px',marginBottom:'8px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                    <button onClick={() => toggleLog(c.id)} style={{width:'24px',height:'24px',borderRadius:'6px',border:'1px solid '+(taken?g:bd),background:taken?g:'transparent',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',color:'#000',fontWeight:'800',padding:0}}>
                      {taken ? '✓' : ''}
                    </button>
                    <div style={{flex:1}}>
                      <div style={{fontSize:'14px',fontWeight:'600',color:taken?dg:'white',textDecoration:taken?'line-through':'none'}}>{c.name}</div>
                      <div style={{fontSize:'12px',color:mg}}>{c.dose} {c.unit}</div>
                    </div>
                  </div>
                  {taken && (
                    <div style={{marginTop:'10px',paddingTop:'10px',borderTop:'1px solid '+bd}}>
                      <span style={{fontSize:'11px',color:mg,display:'block',marginBottom:'6px',letterSpacing:'0.5px'}}>DISCOMFORT / ISSUES (0 = none)</span>
                      <div style={{display:'flex',gap:'6px'}}>
                        {[0,1,2,3,4,5].map(n => (
                          <button key={n} onClick={() => setDiscomfort(c.id, n)} style={{width:'32px',height:'32px',borderRadius:'6px',border:'1px solid '+(discomfort===n?(n===0?g:'#ff6b6b'):bd),background:discomfort===n?(n===0?'rgba(57,255,20,0.15)':'rgba(255,107,107,0.15)'):'transparent',color:discomfort===n?(n===0?g:'#ff6b6b'):dg,fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>{n}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {thisWeek && lastWeek && (`
);

fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
