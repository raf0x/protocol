const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Fix tab colors array
content = content.replace(
  `const tc = ['#39ff14','#6c63ff','#f59e0b','#06b6d4'][ci] || g`,
  `const tc = ['#39ff14','#6c63ff','#f59e0b','#06b6d4','#f43f5e','#a3e635'][ci] || g`
);

// Fix rings colors array
content = content.replace(
  `const colors = ['#39ff14','#6c63ff','#f59e0b','#06b6d4'];`,
  `const colors = ['#39ff14','#6c63ff','#f59e0b','#06b6d4','#f43f5e','#a3e635'];`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('#f43f5e') ? 'yes' : 'NO'));
