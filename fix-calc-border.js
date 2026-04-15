const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');
content = content.replace(
  "background:'#1a1a2e',border:'1px solid #2a2a4e',borderRadius:'8px',padding:'12px',border:'1px solid '+(hasAll?mg:bd)",
  "background:'#1a1a2e',border:'1px solid '+(hasAll?'#6c63ff':bd),borderRadius:'8px',padding:'12px'"
);
fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
