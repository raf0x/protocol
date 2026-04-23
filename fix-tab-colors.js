const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

content = content.replace(
  `{allCompounds.map((c) => (
                  <button key={c.id} onClick={() => setActiveCompoundTab(c.id)} style={{padding:'8px 14px',borderRadius:'8px',fontSize:'12px',fontWeight:'700',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,border:tabId===c.id?'1px solid '+g:'1px solid '+bd,background:tabId===c.id?'rgba(57,255,20,0.1)':cb,color:tabId===c.id?g:dg}}>{c.name}</button>
                ))}`,
  `{allCompounds.map((c, ci) => { const tc = ['#39ff14','#6c63ff','#f59e0b','#06b6d4'][ci] || g; const isAct = tabId===c.id; return (
                  <button key={c.id} onClick={() => setActiveCompoundTab(c.id)} style={{padding:'8px 14px',borderRadius:'8px',fontSize:'12px',fontWeight:'700',cursor:'pointer',whiteSpace:'nowrap',flexShrink:0,border:isAct?'1px solid '+tc:'1px solid '+bd,background:isAct?('rgba('+parseInt(tc.slice(1,3),16)+','+parseInt(tc.slice(3,5),16)+','+parseInt(tc.slice(5,7),16)+',0.12)')  :cb,color:isAct?tc:dg}}>{c.name}</button>
                )})}`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes("['#39ff14','#6c63ff','#f59e0b','#06b6d4'][ci]") ? 'yes' : 'NO'));
