const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');
content = content.replace(
  "Track your protocol.<br/><span style={{color:'#39ff14'}}>Own your data.</span>",
  "Track your protocol results.<br/><span style={{color:'#39ff14'}}>See what's actually working.</span>"
);
fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
