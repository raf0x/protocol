const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

// Add editingId state
content = content.replace(
  "  const [entryNotes, setEntryNotes] = useState('')",
  "  const [entryNotes, setEntryNotes] = useState('')\n  const [editingId, setEditingId] = useState<string | null>(null)"
);

// Add startEdit and deleteEntry functions after saveEntry
content = content.replace(
  `  async function saveEntry() {`,
  `  function startEdit(entry: any) {
    setEditingId(entry.id)
    setDate(entry.date)
    setMood(entry.mood)
    setEnergy(entry.energy)
    setSleep(entry.sleep?.toString() || '')
    setWeight(entry.weight?.toString() || '')
    setHunger(entry.hunger ?? null)
    setEntryNotes(entry.notes || '')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function deleteEntry(id: string) {
    if (!confirm('Delete this entry?')) return
    const supabase = createClient()
    await supabase.from('journal_entries').delete().eq('id', id)
    loadAll()
  }

  function cancelEdit() {
    setEditingId(null)
    setDate(today); setMood(null); setEnergy(null); setSleep('')
    setWeight(''); setHunger(null); setEntryNotes('')
  }

  async function saveEntry() {`
);

// Update Save button to handle edit mode
content = content.replace(
  "          <button onClick={saveEntry} disabled={saving} style={{width:'100%',background:saving?'#1a3d1a':g,color:saving?mg:'#000',border:'none',borderRadius:'6px',padding:'12px',fontSize:'14px',fontWeight:'700',cursor:saving?'not-allowed':'pointer'}}>{saving?'Saving...':'Save Entry'}</button>",
  `          <div style={{display:'flex',gap:'8px'}}>
            {editingId && (
              <button onClick={cancelEdit} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'12px',fontSize:'14px',cursor:'pointer'}}>Cancel</button>
            )}
            <button onClick={saveEntry} disabled={saving} style={{flex:2,background:saving?'#1a3d1a':g,color:saving?mg:'#000',border:'none',borderRadius:'6px',padding:'12px',fontSize:'14px',fontWeight:'700',cursor:saving?'not-allowed':'pointer'}}>{saving?'Saving...':editingId?'Save Changes':'Save Entry'}</button>
          </div>`
);

// Add Edit/Delete buttons to the recent entries list
content = content.replace(
  `          <div key={e.id} style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'12px',marginBottom:'8px'}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'6px'}}>
              <span style={{fontSize:'13px',fontWeight:'600',color:g}}>{new Date(e.date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
            </div>`,
  `          <div key={e.id} style={{background:cb,border:'1px solid '+bd,borderRadius:'8px',padding:'12px',marginBottom:'8px'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
              <span style={{fontSize:'13px',fontWeight:'600',color:g}}>{new Date(e.date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
              <div style={{display:'flex',gap:'10px'}}>
                <button onClick={() => startEdit(e)} style={{background:'none',border:'none',color:dg,cursor:'pointer',fontSize:'12px'}}>Edit</button>
                <button onClick={() => deleteEntry(e.id)} style={{background:'none',border:'none',color:'#ff6b6b',cursor:'pointer',fontSize:'12px'}}>Delete</button>
              </div>
            </div>`
);

// Update the saveEntry after success to clear edit state
content = content.replace(
  `    setSaving(false)\n    loadAll()\n  }`,
  `    setSaving(false)\n    setEditingId(null)\n    if (date === today) { /* keep today's values */ } else { setDate(today); setMood(null); setEnergy(null); setSleep(''); setWeight(''); setHunger(null); setEntryNotes('') }\n    loadAll()\n  }`
);

// Update the form header to reflect edit mode
content = content.replace(
  "<h2 style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'16px'}}>HOW ARE YOU TODAY?</h2>",
  "<h2 style={{fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'16px'}}>{editingId ? 'EDIT ENTRY' : 'HOW ARE YOU TODAY?'}</h2>"
);

fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
