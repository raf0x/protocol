const fs = require('fs');
let content = fs.readFileSync('app/learn/page.tsx', 'utf8');
content = content.replace(
  "color:'#4dbd4d',lineHeight:'1.6',margin:0}}",
  "color:'#ff4444',lineHeight:'1.6',margin:0,fontWeight:'700'}}"
);
fs.writeFileSync('app/learn/page.tsx', content, 'utf8');
console.log('Done');
