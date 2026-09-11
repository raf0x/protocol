const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add a ref to track if user manually edited the name
content = content.replace(
  "  const [protocolName, setProtocolName] = useState('')",
  "  const [protocolName, setProtocolName] = useState('')\n  const [protocolNameTouched, setProtocolNameTouched] = useState(false)"
);

// Update startNew to reset touched
content = content.replace(
  "    setProtocolName('')\n    setNotes('')",
  "    setProtocolName('')\n    setProtocolNameTouched(false)\n    setNotes('')"
);

// Update startEdit to mark as touched (editing existing = name is intentional)
content = content.replace(
  "    setProtocolName(p.name)\n    setNotes(p.notes || '')",
  "    setProtocolName(p.name)\n    setProtocolNameTouched(true)\n    setNotes(p.notes || '')"
);

// Update the protocol name input to mark as touched when user types
content = content.replace(
  "              <input value={protocolName} onChange={e => setProtocolName(e.target.value)} placeholder='Auto-fills from first compound' style={inputStyle} />",
  "              <input value={protocolName} onChange={e => { setProtocolName(e.target.value); setProtocolNameTouched(true) }} placeholder='Auto-fills from first compound' style={inputStyle} />"
);

// Fix the compound name onChange to use touched flag
content = content.replace(
  "                  <input value={c.name} onChange={e => { updateCompound(ci, 'name', e.target.value); if (ci === 0 && (!protocolName || protocolName === compounds[0].name)) setProtocolName(e.target.value) }} placeholder='Compound name (e.g. Retatrutide)' style={{...inputStyle,marginBottom:'8px'}} />",
  "                  <input value={c.name} onChange={e => { updateCompound(ci, 'name', e.target.value); if (ci === 0 && !protocolNameTouched) setProtocolName(e.target.value) }} placeholder='Compound name (e.g. Retatrutide)' style={{...inputStyle,marginBottom:'8px'}} />"
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
