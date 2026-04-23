const fs = require('fs');
const content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
const start = content.indexOf('const items = activeProtocols');
console.log(content.slice(start, start + 300));
