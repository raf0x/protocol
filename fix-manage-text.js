const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  ">Manage stack →</a>",
  ">+ Add / Edit Protocols →</a>"
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
