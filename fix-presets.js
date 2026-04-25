const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');
content = content.replace(
  'const STRENGTH_PRESETS = [1, 2, 5, 10, 15, 20]',
  'const STRENGTH_PRESETS = [1, 2, 5, 10, 15, 20, 30, 60]'
);
fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('30, 60') ? 'yes' : 'NO'));
