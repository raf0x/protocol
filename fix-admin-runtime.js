const fs = require('fs');
let content = fs.readFileSync('app/api/admin/route.ts', 'utf8');
content = "export const runtime = 'nodejs'\n\n" + content;
fs.writeFileSync('app/api/admin/route.ts', content, 'utf8');
console.log('Done');
