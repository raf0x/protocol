const fs = require('fs');
let content = fs.readFileSync('components/dashboard/CompoundNotes.tsx', 'utf8');

// Start collapsed by default
content = content.replace(
  `const [editing, setEditing] = useState(false)`,
  `const [editing, setEditing] = useState(false)
  const [collapsed, setCollapsed] = useState(true)`
);

content = content.replace(
  `  return (
    <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--color-border)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'6px'}}>
        <span style={{fontSize:'10px',fontWeight:'700',color:'var(--color-dim)',letterSpacing:'1px'}}>COMPOUND NOTES</span>`,
  `  return (
    <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--color-border)'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom: collapsed ? '0' : '6px',cursor:'pointer'}} onClick={() => !editing && setCollapsed(!collapsed)}>
        <span style={{fontSize:'10px',fontWeight:'700',color:'var(--color-dim)',letterSpacing:'1px'}}>COMPOUND NOTES</span>`
);

// Wrap content in collapsed check
content = content.replace(
  `        {saved && <span style={{fontSize:'11px',color:'var(--color-green)'}}>&#10003; saved</span>}
          {!editing && <button onClick={() => setEditing(true)} style={{background:'none',border:'none',color:'var(--color-dim)',cursor:'pointer',fontSize:'12px',padding:0}}>{notes ? 'Edit' : '+ Add note'}</button>}`,
  `        <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
            {saved && <span style={{fontSize:'11px',color:'var(--color-green)'}}>&#10003; saved</span>}
            {!editing && <button onClick={e => {e.stopPropagation();setEditing(true);setCollapsed(false)}} style={{background:'none',border:'none',color:'var(--color-dim)',cursor:'pointer',fontSize:'12px',padding:0}}>{notes ? 'Edit' : '+ Add note'}</button>}
            <span style={{fontSize:'10px',color:'var(--color-muted)'}}>{collapsed ? '\u25B6' : '\u25BC'}</span>
          </div>`
);

content = content.replace(
  `      {editing ? (`,
  `      {!collapsed && editing ? (`
);

content = content.replace(
  `      ) : notes ? (
        <p style={{fontSize:'12px',color:'var(--color-dim)',margin:0,lineHeight:'1.6'}}>{notes}</p>
      ) : null}`,
  `      ) : !collapsed && notes ? (
        <p style={{fontSize:'12px',color:'var(--color-dim)',margin:0,lineHeight:'1.6'}}>{notes}</p>
      ) : null}`
);

fs.writeFileSync('components/dashboard/CompoundNotes.tsx', content, 'utf8');
console.log('Done! CompoundNotes collapsible.');
