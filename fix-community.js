const fs = require('fs');
let content = fs.readFileSync('app/community/page.tsx', 'utf8');
content = content.replace(
  "style={{background:'#0a1a0a',border:'1px solid '+mg,color:dg,fontSize:'12px',padding:'6px 10px',borderRadius:'6px',cursor:'pointer',border:'none'}}",
  "style={{background:'#0a1a0a',color:dg,fontSize:'12px',padding:'6px 10px',borderRadius:'6px',cursor:'pointer',border:'none'}}"
);
fs.writeFileSync('app/community/page.tsx', content, 'utf8');
console.log('Done');
