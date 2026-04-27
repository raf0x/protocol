const fs = require('fs');
let content = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');

content = content.replace(
  `  const [count, setCount] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')`,
  `  const [count, setCount] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [input, setInput] = useState('')
  const [dosesOverride, setDosesOverride] = useState<number | null>(null)
  const [editingDoses, setEditingDoses] = useState(false)
  const [dosesInput, setDosesInput] = useState('')`
);

content = content.replace(
  `  useEffect(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved !== null) setCount(parseInt(saved))
    } catch(e) {}
  }, [compoundId])`,
  `  useEffect(() => {
    try {
      const saved = localStorage.getItem(key)
      if (saved !== null) setCount(parseInt(saved))
      const doses = localStorage.getItem(key + '_doses')
      if (doses !== null) setDosesOverride(parseInt(doses))
    } catch(e) {}
  }, [compoundId])`
);

content = content.replace(
  `  function decrement() {`,
  `  function saveDoses() {
    const val = parseInt(dosesInput)
    if (!isNaN(val) && val >= 0) {
      setDosesOverride(val)
      try { localStorage.setItem(key + '_doses', String(val)) } catch(e) {}
    }
    setEditingDoses(false)
  }

  function decrement() {`
);

content = content.replace(
  `      <button onClick={() => { setEditing(true); setInput(count !== null ? String(count) : '') }} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px 10px',color:'var(--color-dim)',fontSize:'12px',cursor:'pointer'}}>{count === null ? 'Set' : 'Edit'}</button>`,
  `      <button onClick={() => { setEditing(true); setInput(count !== null ? String(count) : '') }} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px 10px',color:'var(--color-dim)',fontSize:'12px',cursor:'pointer'}}>{count === null ? 'Set' : 'Edit'}</button>
        </div>
      </div>
      <div style={{marginTop:'8px',paddingTop:'8px',borderTop:'1px solid var(--color-border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <span style={{fontSize:'10px',fontWeight:'700',color:'var(--color-muted)',letterSpacing:'1px',display:'block',marginBottom:'2px'}}>DOSES TAKEN (TOTAL)</span>
          <span style={{fontSize:'13px',color:'var(--color-text)',fontWeight:'700'}}>{dosesOverride !== null ? dosesOverride : 'Not set'}</span>
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          {editingDoses ? (
            <div style={{display:'flex',gap:'4px'}}>
              <input type='number' min='0' value={dosesInput} onChange={e => setDosesInput(e.target.value)} onKeyDown={e => e.key==='Enter' && saveDoses()} style={{width:'55px',background:'var(--color-input)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px',color:'var(--color-text)',fontSize:'12px',textAlign:'center'}} autoFocus />
              <button onClick={saveDoses} style={{background:'var(--color-green)',color:'var(--color-green-text)',border:'none',borderRadius:'6px',padding:'5px 8px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>\u2713</button>
            </div>
          ) : (
            <button onClick={() => { setEditingDoses(true); setDosesInput(dosesOverride !== null ? String(dosesOverride) : '') }} style={{background:'var(--color-surface)',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'5px 10px',color:'var(--color-dim)',fontSize:'12px',cursor:'pointer'}}>{dosesOverride === null ? 'Set' : 'Edit'}</button>`
);

fs.writeFileSync('components/dashboard/VialInventory.tsx', content, 'utf8');
console.log('Done!');
