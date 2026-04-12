const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

// Fix update to include date
content = content.replace(
  "await supabase.from('journal_entries').update({ mood, energy, sleep: parseFloat(sleep), notes: notes.trim() }).eq('id', editingId)",
  "await supabase.from('journal_entries').update({ mood, energy, sleep: parseFloat(sleep), notes: notes.trim(), date: entryDate }).eq('id', editingId)"
);

fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
