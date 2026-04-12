const fs = require('fs');
const content = fs.readFileSync('proxy.ts', 'utf8');
const fixed = content.replace(
  /matcher: \[['"].*['"]\]/,
  `matcher: ['/((?!_next/static|_next/image|favicon.ico|api|\\.png).*)']`
);
fs.writeFileSync('proxy.ts', fixed, 'utf8');
console.log('Done');
