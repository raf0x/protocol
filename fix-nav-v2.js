const fs = require('fs');
let content = fs.readFileSync('components/BottomNav.tsx', 'utf8');
content = content.replace(
  "{ href: '/protocol', label: 'Protocol' }",
  "{ href: '/protocol', label: 'Dashboard' }"
);
content = content.replace(
  "{ href: '/journal', label: 'Journal' }",
  "{ href: '/journal', label: 'History' }"
);
fs.writeFileSync('components/BottomNav.tsx', content, 'utf8');
console.log('Done');
