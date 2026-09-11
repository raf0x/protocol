const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');
content = content.replace(
  "        <div style={{position:'absolute',left:0,right:0,top:'85px',display:'flex',justifyContent:'center',pointerEvents:'none',zIndex:0}}>",
  "        <div style={{position:'absolute',left:0,right:0,top:'130px',display:'flex',justifyContent:'center',pointerEvents:'none',zIndex:0}}>"
);
fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
