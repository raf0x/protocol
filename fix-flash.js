const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// The broken rgba computation from hex parsing - replace with direct CSS var
content = content.replace(
  `background:isAct?('rgba('+parseInt(tc.slice(1,3),16)+','+parseInt(tc.slice(3,5),16)+','+parseInt(tc.slice(5,7),16)+',0.12)')  :cb`,
  `background:isAct?'var(--color-green-10)':cb`
);

// Also fix any variant of this pattern
content = content.replace(
  `background:isAct?('rgba('+parseInt(tc.slice(1,3),16)+','+parseInt(tc.slice(3,5),16)+','+parseInt(tc.slice(5,7),16)+',0.12)'):cb`,
  `background:isAct?'var(--color-green-10)':cb`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('parseInt(tc.slice') ? 'STILL THERE - not found' : 'yes'));
