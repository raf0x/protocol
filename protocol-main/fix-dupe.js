const fs = require('fs');
let content = fs.readFileSync('components/dashboard/TodaysInjections.tsx', 'utf8');
const lines = content.split('\n');

lines[104] = lines[104].replace(
  `fontSize:'14px',fontWeight:'700',color:taken?'var(--color-muted)':'var(--color-text)',fontWeight:'700'`,
  `fontSize:'14px',fontWeight:'700',color:taken?'var(--color-muted)':'var(--color-text)'`
);

fs.writeFileSync('components/dashboard/TodaysInjections.tsx', lines.join('\n'), 'utf8');
console.log('Done!');
