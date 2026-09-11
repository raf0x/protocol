const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  '(active.phases || []).slice().sort((a, b) => a.start_week - b.start_week)',
  '(active.phases || []).slice().sort((a: any, b: any) => a.start_week - b.start_week)'
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('(a: any, b: any)') ? 'yes' : 'NO - not found'));
