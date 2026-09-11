const fs = require('fs');
let content = fs.readFileSync('app/layout.tsx', 'utf8');
content = content.replace(
  "<link rel='apple-touch-icon' href='/icon-192.png' />",
  "<link rel='apple-touch-icon' href='/icon-192.png' />\n        <link rel='icon' type='image/png' href='/icon-192.png' />"
);
fs.writeFileSync('app/layout.tsx', content, 'utf8');
console.log('Done');
