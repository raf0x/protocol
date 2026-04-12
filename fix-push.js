const fs = require('fs');
let content = fs.readFileSync('app/api/push/route.ts', 'utf8');
content = "export const runtime = 'nodejs'\n\n" + content;
fs.writeFileSync('app/api/push/route.ts', content, 'utf8');
console.log('Done');
