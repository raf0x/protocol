const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  'phases.find((ph) => wk >= ph.start_week && wk <= ph.end_week)',
  'phases.find((ph: any) => wk >= ph.start_week && wk <= ph.end_week)'
);
content = content.replace(
  'dueCompounds.find((d) => d.id === active.id)',
  'dueCompounds.find((d: any) => d.id === active.id)'
);
content = content.replace(
  'phases.map((ph, i) => {',
  'phases.map((ph: any, i: number) => {'
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
