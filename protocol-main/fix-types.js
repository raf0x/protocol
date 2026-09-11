const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  'activeProtocols.flatMap((p) => (p.compounds || []).map((c) => ({ ...c, protocol: p })))',
  'activeProtocols.flatMap((p: any) => (p.compounds || []).map((c: any) => ({ ...c, protocol: p })))'
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Lines replaced: ' + (content.includes('(p: any)') ? 'yes' : 'NO - not found'));
