const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// Fix syringes - both vertical, both green
content = content.replace(
  "transform:'rotate(45deg)',display:'block'",
  "transform:'rotate(135deg)',display:'block'"
);
content = content.replace(
  "transform:'rotate(-45deg)',display:'block'",
  "transform:'rotate(135deg)',display:'block'"
);
content = content.replace(
  "color:'#6c63ff',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed'}}>GLP-1",
  "color:'#39ff14',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed'}}>GLP-1"
);

// Move rings higher - away from subheadline, barely touching hero text
content = content.replace(
  "<svg width=\"600\" height=\"400\" viewBox=\"0 0 600 400\" style={{opacity:0.18}}>",
  "<svg width=\"600\" height=\"400\" viewBox=\"0 0 600 400\" style={{opacity:0.18,transform:'translateY(-60px)'}}>"
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
