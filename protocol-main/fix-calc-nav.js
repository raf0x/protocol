const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');
content = content.replace(
  "<a href={'/protocol?newprotocol=1&dose='+activeDose+'&vial='+activeStrength+'&water='+activeWater} style={{flex:1,background:g,color:'#000',textDecoration:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer'}}>Save to protocol →</a>",
  "<button onClick={() => window.location.href='/protocol?newprotocol=1&dose='+activeDose+'&vial='+activeStrength+'&water='+activeWater} style={{flex:1,background:g,color:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>Save to protocol →</button>"
);
fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
