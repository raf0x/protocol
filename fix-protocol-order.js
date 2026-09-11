const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Find the Notes block and the Compounds block, swap their order
const notesBlock = `            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'4px'}}>Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder='Goals, context, cycle length...' rows={2} style={{...inputStyle,resize:'none'}} />
            </div>
            <div style={{marginBottom:'12px'}}>
              <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'8px'}}>Compounds</label>`;

const swappedBlock = `            <div style={{marginBottom:'12px'}}>
              <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'8px'}}>Compounds</label>`;

// We need to move Notes to appear AFTER the compounds section (after the "+ Add another compound" button)
// First remove the Notes block from its current location
content = content.replace(notesBlock, swappedBlock);

// Then insert Notes block AFTER the "+ Add another compound" button
content = content.replace(
  `              <button onClick={addCompound} style={{background:'none',border:'1px dashed #3d3d5c',borderRadius:'6px',padding:'8px',width:'100%',color:mg,fontSize:'13px',cursor:'pointer'}}>+ Add another compound</button>
            </div>`,
  `              <button onClick={addCompound} style={{background:'none',border:'1px dashed #3d3d5c',borderRadius:'6px',padding:'8px',width:'100%',color:mg,fontSize:'13px',cursor:'pointer'}}>+ Add another compound</button>
            </div>
            <div style={{marginBottom:'16px'}}>
              <label style={{display:'block',fontSize:'13px',color:dg,marginBottom:'4px'}}>Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder='Goals, context, cycle length...' rows={2} style={{...inputStyle,resize:'none'}} />
            </div>`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
