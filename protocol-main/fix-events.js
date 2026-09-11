const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add protocolEvents state
content = content.replace(
  "  const [showProtocols, setShowProtocols] = useState(false)",
  "  const [showProtocols, setShowProtocols] = useState(false)\n  const [protocolEvents, setProtocolEvents] = useState<any[]>([])\n  const [showAddEvent, setShowAddEvent] = useState(false)\n  const [eventDesc, setEventDesc] = useState('')\n  const [eventType, setEventType] = useState('dose_change')"
);

// Fetch events in loadAll
content = content.replace(
  "    const map: Record<string, LogEntry> = {}; (ls || []).forEach((l: any) => { map[l.compound_id] = { compound_id: l.compound_id, taken: l.taken, discomfort: l.discomfort } }); setLogs(map)",
  "    const map: Record<string, LogEntry> = {}; (ls || []).forEach((l: any) => { map[l.compound_id] = { compound_id: l.compound_id, taken: l.taken, discomfort: l.discomfort } }); setLogs(map)\n    const { data: events } = await supabase.from('protocol_events').select('*').order('date', { ascending: true })\n    setProtocolEvents(events || [])"
);

// Add saveEvent function before loadAll
content = content.replace(
  "  async function loadAll() {",
  `  async function saveEvent() {
    if (!eventDesc.trim()) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const todayStr = new Date().toISOString().split('T')[0]
    await supabase.from('protocol_events').insert({ user_id: user.id, date: todayStr, event_type: eventType, description: eventDesc.trim() })
    setEventDesc(''); setShowAddEvent(false)
    loadAll()
  }

  async function loadAll() {`
);

// Replace the existing markers logic to include protocol_events
content = content.replace(
  "  const mk: { date: string; label: string }[] = []; activeProtocols.forEach((p: any) => { const sl = new Date(p.start_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}); (p.compounds||[]).forEach((c: any) => { mk.push({ date: sl, label: c.name }) }) })",
  `  const mk: { date: string; label: string }[] = []
  activeProtocols.forEach((p: any) => { const sl = new Date(p.start_date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}); (p.compounds||[]).forEach((c: any) => { mk.push({ date: sl, label: c.name }) }) })
  protocolEvents.forEach((ev: any) => { const evDate = new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}); mk.push({ date: evDate, label: ev.description }) })`
);

// Add "Log event" button and form right after the Active Compounds section
content = content.replace(
  "        {/* Today's injections */}",
  `        {/* Event logger */}
        <div style={{marginBottom:'16px'}}>
          {!showAddEvent ? (
            <button onClick={() => setShowAddEvent(true)} style={{width:'100%',background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'12px',cursor:'pointer',fontWeight:'600'}}>+ Log protocol change</button>
          ) : (
            <div style={{background:cb,border:'1px solid '+bd,borderRadius:'12px',padding:'16px'}}>
              <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',display:'block',marginBottom:'10px'}}>LOG PROTOCOL CHANGE</span>
              <select value={eventType} onChange={e => setEventType(e.target.value)} style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'13px',boxSizing:'border-box',marginBottom:'8px'}}>
                <option value='dose_change'>Dose changed</option>
                <option value='compound_added'>Added compound</option>
                <option value='compound_removed'>Stopped compound</option>
                <option value='phase_change'>Phase change</option>
                <option value='other'>Other</option>
              </select>
              <input value={eventDesc} onChange={e => setEventDesc(e.target.value)} placeholder='e.g. Increased Reta to 5mg' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'10px',color:'white',fontSize:'14px',boxSizing:'border-box',marginBottom:'10px'}} />
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={() => setShowAddEvent(false)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
                <button onClick={saveEvent} disabled={!eventDesc.trim()} style={{flex:2,background:!eventDesc.trim()?'#1a3d1a':g,color:!eventDesc.trim()?mg:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>Log Event</button>
              </div>
            </div>
          )}
        </div>

        {/* Today's injections */}`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
