const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
const lines = content.split('\n');

const insertAfter = 413; // line 414 is `)}` closing isDue block, insert after line 413
const newLines = [
  `                  <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--color-border)'}}>`,
  `                    <CompoundNotes compoundId={active.id} initialNotes={active.notes || ''} />`,
  `                    <VialInventory compoundId={active.id} compoundName={active.name} />`,
  `                    <div style={{display:'flex',justifyContent:'flex-end',marginTop:'10px'}}>`,
  `                      <button onClick={() => shareProtocol(ap.id)} style={{background:'none',border:'1px solid var(--color-border)',borderRadius:'6px',padding:'6px 12px',color:'var(--color-dim)',fontSize:'12px',fontWeight:'600',cursor:'pointer'}}>Share protocol \u2192</button>`,
  `                    </div>`,
  `                  </div>`,
];

const result = [
  ...lines.slice(0, insertAfter),
  ...newLines,
  ...lines.slice(insertAfter),
];

fs.writeFileSync('app/protocol/page.tsx', result.join('\n'), 'utf8');
console.log('Done! Share button, CompoundNotes, VialInventory inserted at line ' + insertAfter);
