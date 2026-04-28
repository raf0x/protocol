const fs = require('fs');
let content = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');

content = content.replace(
  `<button onClick={handleDecrement} style={{background:'rgba(255,255,255,0.06)',border:'1px solid rgba(255,255,255,0.1)',borderRadius:'6px',padding:'5px 10px',color:'rgba(255,255,255,0.5)',fontSize:'12px',cursor:'pointer'}}>-1 vial</button>`,
  `<button onClick={handleDecrement} style={{background:'rgba(57,255,20,0.1)',border:'1px solid rgba(57,255,20,0.3)',borderRadius:'6px',padding:'5px 10px',color:'#39ff14',fontSize:'12px',cursor:'pointer',fontWeight:'700'}}>+ New Vial</button>`
);

content = content.replace(
  `<h3 style={{fontSize:'18px',fontWeight:'800',color:'white',marginBottom:'4px'}}>{compoundName}</h3>`,
  `<h3 style={{fontSize:'18px',fontWeight:'800',color:'white',marginBottom:'4px'}}>Starting a new {compoundName} vial?</h3>`
);

content = content.replace(
  `<p style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginBottom:'20px'}}>Log your new vial. Doses taken will reset to 0.</p>`,
  `<p style={{fontSize:'12px',color:'rgba(255,255,255,0.4)',marginBottom:'20px'}}>Your previous vial will be marked as finished. Doses taken will reset to 0.</p>`
);

content = content.replace(
  `<span style={{fontSize:'12px',color:'rgba(255,255,255,0.3)'}}>Not set</span>`,
  `<span style={{fontSize:'12px',color:'rgba(255,255,255,0.3)'}}>Not set \u00b7 tap Edit to add</span>`
);

fs.writeFileSync('components/dashboard/VialInventory.tsx', content, 'utf8');
console.log('Done!');
