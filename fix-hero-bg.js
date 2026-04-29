const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

lines[163] = lines[163].replace(
  "background:'var(--color-surface)'",
  "background:'var(--color-card)'"
);

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', lines.join('\n'), 'utf8');
console.log('Done! Fixed: ' + (lines[163].includes("var(--color-card)") ? 'yes' : 'NO'));
