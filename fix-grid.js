const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

content = content.replace(
  `<div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0px'}}>`,
  `<div style={{display:'grid',gridTemplateColumns:items.length<=4?'1fr 1fr':'1fr 1fr 1fr',gap:'0px'}}>`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('items.length<=4') ? 'yes' : 'NO'));
