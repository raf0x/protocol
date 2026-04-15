const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Fix auto-fill direction - protocol name fills compound name
content = content.replace(
  `                  <input value={compound.name} onChange={e => { updateCompound(index, 'name', e.target.value); if (index === 0) setProtocolName(e.target.value) }}`,
  `                  <input value={compound.name} onChange={e => updateCompound(index, 'name', e.target.value)}`
);

// Auto-fill first compound from protocol name
content = content.replace(
  `<input value={protocolName} onChange={e => setProtocolName(e.target.value)} placeholder='e.g. BPC-157 healing cycle'`,
  `<input value={protocolName} onChange={e => { setProtocolName(e.target.value); if (compounds[0].name === '' || compounds[0].name === protocolName) { const u = [...compounds]; u[0].name = e.target.value; setCompounds(u) } }} placeholder='e.g. BPC-157'`
);

// Fix dropdown width
content = content.replace(
  `{background:'#000000',border:'1px solid '+bd,borderRadius:'4px',padding:'6px 8px',color:'white',fontSize:'13px'}`,
  `{background:'#000000',border:'1px solid '+bd,borderRadius:'4px',padding:'6px 4px',color:'white',fontSize:'12px',maxWidth:'120px'}`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
