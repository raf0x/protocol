const fs = require('fs');
let content = fs.readFileSync('components/BottomNav.tsx', 'utf8');
content = content.replace(
  "{ href: '/calculator', label: 'Calc' }",
  "{ href: '/calculator', label: '\uD83E\uDDEE' }"
);
fs.writeFileSync('components/BottomNav.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('\uD83E\uDDEE') ? 'yes' : 'NO'));
