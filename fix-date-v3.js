const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');
content = content.replace(
  "colorScheme:'dark',maxWidth:'100%',overflow:'hidden'}}",
  "colorScheme:'dark',display:'block',width:'100%',WebkitAppearance:'none'"
);
fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
