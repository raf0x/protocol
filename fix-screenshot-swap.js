const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');
content = content.replace(
  "src='/journal-screenshot.png'",
  "src='/journal-screenshot2.png'"
);
fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
