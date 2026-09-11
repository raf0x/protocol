const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');
content = content.replace(
  "'use client'",
  "'use client'\n\nexport const dynamic = 'force-dynamic'"
);
fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
