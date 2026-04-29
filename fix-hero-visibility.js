const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');

// Make all internal labels fully white/visible
content = content.split("color:'rgba(255,255,255,0.6)'").join("color:'rgba(255,255,255,0.85)'");
content = content.split("color:'rgba(255,255,255,0.65)'").join("color:'rgba(255,255,255,0.9)'");
content = content.split("color:'rgba(255,255,255,0.75)'").join("color:'rgba(255,255,255,0.95)'");

// Progress bar track more visible
content = content.split("background:'rgba(255,255,255,0.15)'").join("background:'rgba(255,255,255,0.25)'");

// 33% label more visible
content = content.replace(
  `<span style={{fontSize:'9px',color:'rgba(255,255,255,0.5)',fontWeight:'700'}}>{progress}%</span>`,
  `<span style={{fontSize:'9px',color:'white',fontWeight:'700'}}>{progress}%</span>`
);

// ACTIVE COMPOUND label
content = content.replace(
  `<div style={{fontSize:'10px',fontWeight:'700',color:'rgba(255,255,255,0.4)',letterSpacing:'2px',marginBottom:'6px'}}>ACTIVE COMPOUND</div>`,
  `<div style={{fontSize:'10px',fontWeight:'700',color:'rgba(255,255,255,0.7)',letterSpacing:'2px',marginBottom:'6px'}}>ACTIVE COMPOUND</div>`
);

// PROTOCOL PROGRESS label
content = content.replace(
  `<span style={{fontSize:'9px',color:'rgba(255,255,255,0.3)',fontWeight:'600',letterSpacing:'1px'}}>PROTOCOL PROGRESS</span>`,
  `<span style={{fontSize:'9px',color:'rgba(255,255,255,0.7)',fontWeight:'700',letterSpacing:'1px'}}>PROTOCOL PROGRESS</span>`
);

// VIAL EXPIRES and EST REMAINING labels
content = content.split("color:'rgba(255,255,255,0.3)',fontWeight:'600',letterSpacing:'1px',marginBottom:'2px'").join("color:'rgba(255,255,255,0.7)',fontWeight:'700',letterSpacing:'1px',marginBottom:'2px'");

// vialDaysLeft value
content = content.replace(
  `color:vialDaysLeft<=5?'#ff6b6b':vialDaysLeft<=10?'#f59e0b':'rgba(255,255,255,0.8)'`,
  `color:vialDaysLeft<=5?'#ff6b6b':vialDaysLeft<=10?'#f59e0b':'white'`
);

// EST remaining value
content = content.split("color:'rgba(255,255,255,0.8)'").join("color:'white'");

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', content, 'utf8');
console.log('Hero card visibility fixed');
