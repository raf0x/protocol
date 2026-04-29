const fs = require('fs');
let content = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');
const lines = content.split('\n');

// Fix line 252 - vials count color
lines[251] = lines[251].replace(
  `color:count<=1?'#ff6b6b':count<=2?'#f59e0b':'rgba(255,255,255,0.8)'`,
  `color:count<=1?'#ff6b6b':count<=2?'#f59e0b':'var(--color-text)'`
);

// Show lines around Edit buttons to find their background
lines.forEach((line, i) => {
  if (line.includes("'Edit'") && line.includes('style')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 120));
  }
});

fs.writeFileSync('components/dashboard/VialInventory.tsx', lines.join('\n'), 'utf8');
console.log('Done! Count color fixed.');
