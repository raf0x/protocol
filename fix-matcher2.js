const fs = require('fs');
let content = fs.readFileSync('proxy.ts', 'utf8');
content = content.replace(
  /matcher: \[.*\]/,
  "matcher: ['/((?!_next/static|_next/image|favicon.ico|api/|.*\\.png$).*)']"
);
fs.writeFileSync('proxy.ts', content, 'utf8');
console.log('Done');
