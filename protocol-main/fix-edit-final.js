const fs = require('fs');
let content = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');
const lines = content.split('\n');

lines[241] = lines[241]
  .replace(
    `'rgba(255,255,255,0.06)'`,
    `'var(--color-surface)'`
  )
  .replace(
    `'rgba(255,255,255,0.1)'`,
    `'var(--color-border)'`
  )
  .replace(
    `'rgba(255,255,255,0.5)'`,
    `'var(--color-dim)'`
  );

// Also fix lines 267 and 285 text color
lines[266] = lines[266].replace(/color:'var\(--color-muted\)'/, "color:'var(--color-text)'");
lines[284] = lines[284].replace(/color:'var\(--color-muted\)'/, "color:'var(--color-text)'");

fs.writeFileSync('components/dashboard/VialInventory.tsx', lines.join('\n'), 'utf8');
console.log('Done!');
