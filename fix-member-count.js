const fs = require('fs');
let content = fs.readFileSync('app/community/page.tsx', 'utf8');
content = content.replace(
  "{count > 0 && <span style={{fontSize:'11px',color:mg}}>· {count} {count===1?'member':'members'}</span>}",
  "{count > 0 && <span style={{fontSize:'12px',color:dg,fontWeight:'600'}}>· {count} {count===1?'member':'members'}</span>}"
);
fs.writeFileSync('app/community/page.tsx', content, 'utf8');
console.log('Done');
