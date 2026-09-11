const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  `setActiveCompoundTab(item.id); const el = document.getElementById('active-compounds'); if(el) el.scrollIntoView({behavior:'smooth'});`,
  `setActiveCompoundTab(item.id);`
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('scrollIntoView') ? 'STILL THERE' : 'removed'));
