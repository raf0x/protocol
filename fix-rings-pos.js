const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');
content = content.replace(
  "style={{opacity:0.18,transform:'translateY(-60px)'}}",
  "style={{opacity:0.18,transform:'translateY(40px)'}}"
);
fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
