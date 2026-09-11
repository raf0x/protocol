const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Fix 1: add id to rings items
content = content.replace(
  `return {name:c.name,wk} })).slice(0,6);`,
  `return {id:c.id,name:c.name,wk} })).slice(0,6);`
);

// Fix 2: highlight active ring + fix click
content = content.replace(
  `<div key={i} onClick={() => { setActiveCompoundTab(item.id); const el = document.getElementById('active-compounds'); if(el) el.scrollIntoView({behavior:'smooth'}); }} style={{width:'64px',height:'64px',borderRadius:'50%',border:'3px solid '+rc,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginRight:isLastCol?'0':'-10px',marginBottom:isLastRow?'0':'-10px',background:cb,zIndex:row+col,position:'relative',cursor:'pointer'}}>`,
  `<div key={i} onClick={() => { setActiveCompoundTab(item.id); const el = document.getElementById('active-compounds'); if(el) el.scrollIntoView({behavior:'smooth'}); }} style={{width:'64px',height:'64px',borderRadius:'50%',border:'3px solid '+rc,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',marginRight:isLastCol?'0':'-10px',marginBottom:isLastRow?'0':'-10px',background:(activeCompoundTab||allCompounds[0]?.id)===item.id?rc+'22':cb,zIndex:row+col,position:'relative',cursor:'pointer',boxShadow:(activeCompoundTab||allCompounds[0]?.id)===item.id?'0 0 12px '+rc:'none',transform:(activeCompoundTab||allCompounds[0]?.id)===item.id?'scale(1.08)':'scale(1)',transition:'all 0.2s ease'}}>`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes("id:c.id") ? 'yes' : 'NO'));
