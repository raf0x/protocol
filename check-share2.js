const fs = require('fs');
console.log('Files in app/share/[token]:', fs.readdirSync('app/share/[token]'));
const content = fs.readFileSync('app/share/[token]/page.tsx', 'utf8');
console.log('First 200 chars:', content.slice(0, 200));
