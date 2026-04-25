const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

content = content.replace(
  `<div key={i} style={{width:'64px',height:'64px',borderRadius:'50%',border:'3px solid '+rc,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginRight:isLastCol?'0':'-10px',marginBottom:isLastRow?'0':'-10px',background:cb,zIndex:row+col,position:'relative'}}>`,
  `<div key={i} onClick={() => { setActiveCompoundTab(item.id); const el = document.getElementById('active-compounds'); if(el) el.scrollIntoView({behavior:'smooth'}); }} style={{width:'64px',height:'64px',borderRadius:'50%',border:'3px solid '+rc,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginRight:isLastCol?'0':'-10px',marginBottom:isLastRow?'0':'-10px',background:cb,zIndex:row+col,position:'relative',cursor:'pointer'}}>`
);

// Add id to the active compounds section so we can scroll to it
content = content.replace(
  `<span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px'}}>ACTIVE COMPOUNDS</span>`,
  `<span id='active-compounds' style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px'}}>ACTIVE COMPOUNDS</span>`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes("scrollIntoView") ? 'yes' : 'NO'));
