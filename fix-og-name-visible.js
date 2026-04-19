const fs = require('fs');
let content = fs.readFileSync('app/api/og/route.tsx', 'utf8');

// Make the compound name in the header bigger and brighter
content = content.replace(
  "          <span style={{fontSize:'20px',color:'#3d3d5c'}}>{name || 'Peptide Calculator'}</span>",
  "          <span style={{fontSize:'28px',color:'#ffffff',fontWeight:700}}>{name || 'Peptide Calculator'}</span>"
);

// Make the compound name inside the result box bigger and greener
content = content.replace(
  "              {name && <span style={{fontSize:'18px',color:'#8b8ba7',marginBottom:'8px'}}>{name}</span>}",
  "              {name && <span style={{fontSize:'32px',color:'#39ff14',fontWeight:800,marginBottom:'4px',letterSpacing:'1px'}}>{name}</span>}"
);

fs.writeFileSync('app/api/og/route.tsx', content, 'utf8');
console.log('Done');
