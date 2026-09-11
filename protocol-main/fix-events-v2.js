const fs = require('fs');

// 1. Fix chart markers - alternate positions to avoid overlap
let dash = fs.readFileSync('app/protocol/page.tsx', 'utf8');

dash = dash.replace(
  "label={{value: m.label, position: 'insideTopRight', fontSize: 10, fill: '#a78bfa', fontWeight: 700, offset: 8}}",
  "label={{value: m.label, position: i % 2 === 0 ? 'insideTopRight' : 'insideBottomRight', fontSize: 10, fill: '#a78bfa', fontWeight: 700, offset: 8}}"
);

// 2a. Show event type tag in Protocol Timeline
dash = dash.replace(
  "                  <span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{ev.description}</span>",
  "                  <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}><span style={{fontSize:'10px',color:'#0a0a0f',background:ev.event_type==='started'?g:ev.event_type==='dose_change'?'#f59e0b':ev.event_type==='compound_added'?'#06b6d4':ev.event_type==='compound_removed'?'#ff6b6b':'#6c63ff',padding:'2px 6px',borderRadius:'4px',fontWeight:'700',textTransform:'uppercase'}}>{ev.event_type.replace(/_/g,' ')}</span><span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{ev.description}</span></div>"
);

fs.writeFileSync('app/protocol/page.tsx', dash, 'utf8');
console.log('Dashboard fixed');

// 2b. Show protocol events in History tab
let history = fs.readFileSync('app/journal/page.tsx', 'utf8');

// Add events state
history = history.replace(
  "  const [saving, setSaving] = useState(false)",
  "  const [saving, setSaving] = useState(false)\n  const [protocolEvents, setProtocolEvents] = useState<any[]>([])"
);

// Fetch events in load function
history = history.replace(
  "    const { data } = await supabase.from('journal_entries').select('*').order('date', { ascending: false })\n    setEntries(data || [])",
  "    const { data } = await supabase.from('journal_entries').select('*').order('date', { ascending: false })\n    setEntries(data || [])\n    const { data: events } = await supabase.from('protocol_events').select('*').order('date', { ascending: false })\n    setProtocolEvents(events || [])"
);

// Merge events into entries display - add events section before entries list
history = history.replace(
  "        {entries.length === 0 && <p style={{color:mg,textAlign:'center',padding:'48px 0'}}>No entries yet. Log your first day from the Dashboard.</p>}",
  `        {entries.length === 0 && protocolEvents.length === 0 && <p style={{color:mg,textAlign:'center',padding:'48px 0'}}>No entries yet. Log your first day from the Dashboard.</p>}

        {protocolEvents.length > 0 && (
          <div style={{marginBottom:'20px'}}>
            <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',display:'block',marginBottom:'10px'}}>PROTOCOL CHANGES</span>
            {protocolEvents.map((ev, i) => (
              <div key={ev.id || i} style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'12px',marginBottom:'8px'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                    <span style={{width:'8px',height:'8px',borderRadius:'50%',background:ev.event_type==='started'?g:ev.event_type==='dose_change'?'#f59e0b':ev.event_type==='compound_added'?'#06b6d4':ev.event_type==='compound_removed'?'#ff6b6b':'#6c63ff',display:'inline-block'}} />
                    <span style={{fontSize:'10px',color:'#0a0a0f',background:ev.event_type==='started'?g:ev.event_type==='dose_change'?'#f59e0b':ev.event_type==='compound_added'?'#06b6d4':ev.event_type==='compound_removed'?'#ff6b6b':'#6c63ff',padding:'2px 6px',borderRadius:'4px',fontWeight:'700',textTransform:'uppercase'}}>{ev.event_type.replace(/_/g,' ')}</span>
                  </div>
                  <span style={{fontSize:'12px',color:dg}}>{new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                </div>
                <span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{ev.description}</span>
              </div>
            ))}
          </div>
        )}`
);

fs.writeFileSync('app/journal/page.tsx', history, 'utf8');
console.log('History updated');
console.log('All done');
