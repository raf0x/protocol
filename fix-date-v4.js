const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');
content = content.replace(
  "colorScheme:'dark',display:'block',width:'100%',WebkitAppearance:'none' />",
  "colorScheme:'dark',WebkitAppearance:'none'}} />"
);
fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
