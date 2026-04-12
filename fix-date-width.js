const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');
content = content.replace(
  "style={{width:'100%',background:'#000000',border:'1px solid '+bd,borderRadius:'6px',padding:'8px 10px',color:'white',fontSize:'14px',boxSizing:'border-box',colorScheme:'dark'}}",
  "style={{width:'100%',background:'#000000',border:'1px solid '+bd,borderRadius:'6px',padding:'8px 10px',color:'white',fontSize:'14px',boxSizing:'border-box',colorScheme:'dark',maxWidth:'100%',overflow:'hidden'}}"
);
fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
