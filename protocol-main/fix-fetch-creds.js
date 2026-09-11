const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');
content = content.replace(
  "      const res = await fetch('/api/create-protocol', {\n        method: 'POST',\n        headers: { 'Content-Type': 'application/json' },",
  "      const res = await fetch('/api/create-protocol', {\n        method: 'POST',\n        credentials: 'same-origin',\n        headers: { 'Content-Type': 'application/json' },"
);
fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
