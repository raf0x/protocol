const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  "fontSize:'10px',color:daysLeft<=5?'#ff6b6b':daysLeft<=10?'#f59e0b':dg",
  "fontSize:'11px',fontWeight:'600',color:daysLeft<=5?'#ff6b6b':daysLeft<=10?'#f59e0b':'#8b8ba7'"
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
