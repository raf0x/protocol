const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  "fontSize:'10px',fontWeight:'700',color:'white',letterSpacing:'0.5px'}}>{il ? '\u2713 STEADY STATE'",
  "fontSize:'10px',fontWeight:'700',color:il?'#000':'white',letterSpacing:'0.5px'}}>{il ? '\u2713 STEADY STATE'"
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes("color:il?'#000':'white'") ? 'yes' : 'NO - not found'));
