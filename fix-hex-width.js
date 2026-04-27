const fs = require('fs');
let content = fs.readFileSync('components/PeptideHoneycomb.tsx', 'utf8');

content = content.replace(
  `<div style={{width:'100%',padding:'0 8px',boxSizing:'border-box'}}>`,
  `<div style={{width:'100%',maxWidth:'640px',margin:'0 auto',padding:'0 8px',boxSizing:'border-box'}}>`
);

fs.writeFileSync('components/PeptideHoneycomb.tsx', content, 'utf8');
console.log('Done!');
