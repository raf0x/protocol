const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

// Add entryDate state after the notes state
content = content.replace(
  "  const [notes, setNotes] = useState('')",
  "  const [notes, setNotes] = useState('')\n  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0])"
);

// Update startNew to reset date to today
content = content.replace(
  "  function startNew() { setEditingId(null); setMood(3); setEnergy(3); setSleep(''); setNotes(''); setShowForm(true); setError('') }",
  "  function startNew() { setEditingId(null); setMood(3); setEnergy(3); setSleep(''); setNotes(''); setEntryDate(new Date().toISOString().split('T')[0]); setShowForm(true); setError('') }"
);

// Update startEdit to set the entry date
content = content.replace(
  "  function startEdit(entry: JournalEntry) { setEditingId(entry.id); setMood(entry.mood); setEnergy(entry.energy); setSleep(String(entry.sleep)); setNotes(entry.notes || ''); setShowForm(true); setError('') }",
  "  function startEdit(entry: JournalEntry) { setEditingId(entry.id); setMood(entry.mood); setEnergy(entry.energy); setSleep(String(entry.sleep)); setNotes(entry.notes || ''); setEntryDate(entry.date); setShowForm(true); setError('') }"
);

// Use entryDate instead of hardcoded today
content = content.replace(
  "      const today = new Date().toISOString().split('T')[0]\n      await supabase.from('journal_entries').insert({ user_id: user.id, date: today, mood, energy, sleep: parseFloat(sleep), notes: notes.trim() })",
  "      await supabase.from('journal_entries').insert({ user_id: user.id, date: entryDate, mood, energy, sleep: parseFloat(sleep), notes: notes.trim() })"
);

// Add date picker to the form - insert after the h2 title
content = content.replace(
  "            <h2 style={{fontSize:'16px',fontWeight:'600',marginBottom:'16px',color:g}}>{editingId ? 'Edit Entry' : 'How are you today?'}</h2>",
  "            <h2 style={{fontSize:'16px',fontWeight:'600',marginBottom:'16px',color:g}}>{editingId ? 'Edit Entry' : 'How are you today?'}</h2>\n            <div style={{marginBottom:'16px'}}>\n              <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'4px'}}>Date</label>\n              <input type='date' value={entryDate} onChange={e => setEntryDate(e.target.value)} style={{width:'100%',background:'#000000',border:'1px solid '+bd,borderRadius:'6px',padding:'8px 10px',color:'white',fontSize:'14px',boxSizing:'border-box',colorScheme:'dark'}} />\n            </div>"
);

fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
