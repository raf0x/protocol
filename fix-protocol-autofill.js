const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Fix 1: Auto-fill protocol name from first compound
content = content.replace(
  "                  <input value={c.name} onChange={e => updateCompound(ci, 'name', e.target.value)} placeholder='Compound name (e.g. Retatrutide)' style={{...inputStyle,marginBottom:'8px'}} />",
  "                  <input value={c.name} onChange={e => { updateCompound(ci, 'name', e.target.value); if (ci === 0 && (!protocolName || protocolName === compounds[0].name)) setProtocolName(e.target.value) }} placeholder='Compound name (e.g. Retatrutide)' style={{...inputStyle,marginBottom:'8px'}} />"
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
