const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  `})).slice(0,4);
              const colors`,
  `})).slice(0,6);
              const colors`
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('slice(0,6)') ? 'yes' : 'NO'));
