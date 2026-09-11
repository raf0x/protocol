const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add editing state
content = content.replace(
  "  const [eventDesc, setEventDesc] = useState('')",
  "  const [eventDesc, setEventDesc] = useState('')\n  const [editingEventId, setEditingEventId] = useState<string | null>(null)\n  const [editEventDesc, setEditEventDesc] = useState('')\n  const [editEventType, setEditEventType] = useState('')"
);

// Add delete and update functions after saveEvent
content = content.replace(
  "  async function loadAll() {",
  `  async function deleteEvent(id: string) {
    if (!confirm('Delete this event?')) return
    const supabase = createClient()
    await supabase.from('protocol_events').delete().eq('id', id)
    if (selectedEvent?.id === id) setSelectedEvent(null)
    loadAll()
  }

  async function updateEvent() {
    if (!editEventDesc.trim() || !editingEventId) return
    const supabase = createClient()
    await supabase.from('protocol_events').update({ description: editEventDesc.trim(), event_type: editEventType }).eq('id', editingEventId)
    setEditingEventId(null)
    loadAll()
  }

  function startEditEvent(ev: any) {
    setEditingEventId(ev.id)
    setEditEventDesc(ev.description)
    setEditEventType(ev.event_type)
  }

  async function loadAll() {`
);

// Update the Protocol Timeline to show edit/delete buttons on each event
content = content.replace(
  "            {protocolEvents.slice(-5).reverse().map((ev: any, i: number) => (\n              <div key={ev.id || i} style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'8px 0',borderBottom:i < Math.min(protocolEvents.length, 5) - 1 ? '1px solid '+bd : 'none'}}>\n                <div style={{width:'8px',height:'8px',borderRadius:'50%',background:ev.event_type==='started'?g:ev.event_type==='dose_change'?'#f59e0b':ev.event_type==='compound_added'?'#06b6d4':ev.event_type==='compound_removed'?'#ff6b6b':'#6c63ff',marginTop:'4px',flexShrink:0}} />\n                <div>\n                  <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}><span style={{fontSize:'10px',color:'#0a0a0f',background:ev.event_type==='started'?g:ev.event_type==='dose_change'?'#f59e0b':ev.event_type==='compound_added'?'#06b6d4':ev.event_type==='compound_removed'?'#ff6b6b':'#6c63ff',padding:'2px 6px',borderRadius:'4px',fontWeight:'700',textTransform:'uppercase'}}>{ev.event_type.replace(/_/g,' ')}</span><span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{ev.description}</span></div>\n                  <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginTop:'2px'}}>{new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>\n                </div>\n              </div>\n            ))}",
  `            {protocolEvents.slice(-5).reverse().map((ev: any, i: number) => (
              editingEventId === ev.id ? (
                <div key={ev.id} style={{padding:'10px 0',borderBottom:i < Math.min(protocolEvents.length, 5) - 1 ? '1px solid '+bd : 'none'}}>
                  <select value={editEventType} onChange={e => setEditEventType(e.target.value)} style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'6px',color:'white',fontSize:'12px',boxSizing:'border-box',marginBottom:'6px'}}>
                    <option value='dose_change'>Dose changed</option>
                    <option value='compound_added'>Added compound</option>
                    <option value='compound_removed'>Stopped compound</option>
                    <option value='phase_change'>Phase change</option>
                    <option value='started'>Started</option>
                    <option value='other'>Other</option>
                  </select>
                  <input value={editEventDesc} onChange={e => setEditEventDesc(e.target.value)} style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px',color:'white',fontSize:'13px',boxSizing:'border-box',marginBottom:'6px'}} />
                  <div style={{display:'flex',gap:'6px'}}>
                    <button onClick={() => setEditingEventId(null)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'6px',fontSize:'12px',cursor:'pointer'}}>Cancel</button>
                    <button onClick={updateEvent} style={{flex:2,background:g,color:'#000',border:'none',borderRadius:'6px',padding:'6px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>Save</button>
                  </div>
                </div>
              ) : (
                <div key={ev.id || i} style={{display:'flex',alignItems:'flex-start',gap:'10px',padding:'8px 0',borderBottom:i < Math.min(protocolEvents.length, 5) - 1 ? '1px solid '+bd : 'none'}}>
                  <div style={{width:'8px',height:'8px',borderRadius:'50%',background:eventColor(ev.event_type),marginTop:'4px',flexShrink:0}} />
                  <div style={{flex:1}}>
                    <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap'}}><span style={{fontSize:'10px',color:'#0a0a0f',background:eventColor(ev.event_type),padding:'2px 6px',borderRadius:'4px',fontWeight:'700',textTransform:'uppercase'}}>{ev.event_type.replace(/_/g,' ')}</span><span style={{fontSize:'13px',color:'white',fontWeight:'600'}}>{ev.description}</span></div>
                    <span style={{fontSize:'11px',color:'#8b8ba7',display:'block',marginTop:'2px'}}>{new Date(ev.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                  </div>
                  <div style={{display:'flex',gap:'8px',flexShrink:0}}>
                    <button onClick={() => startEditEvent(ev)} style={{background:'none',border:'none',color:dg,cursor:'pointer',fontSize:'11px'}}>Edit</button>
                    <button onClick={() => deleteEvent(ev.id)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'11px'}}>Delete</button>
                  </div>
                </div>
              )
            ))}`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
