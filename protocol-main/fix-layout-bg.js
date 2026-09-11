const fs = require('fs');
let content = fs.readFileSync('app/layout.tsx', 'utf8');
content = content.replace(
  "style={{background:'#030712',paddingBottom:'80px'}}",
  "style={{paddingBottom:'80px'}}"
);
fs.writeFileSync('app/layout.tsx', content, 'utf8');
console.log('Done');
