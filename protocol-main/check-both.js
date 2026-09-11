const fs = require('fs');
const inv = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');
const inj = fs.readFileSync('components/dashboard/TodaysInjections.tsx', 'utf8');

// Find Edit button styles in VialInventory
inv.split('\n').forEach((line, i) => {
  if (line.includes("'Edit'") || (line.includes('style') && line.includes('border') && line.includes('padding'))) {
    if (i >= 240 && i <= 295) console.log('INV ' + (i+1) + ': ' + line.trim().slice(0, 130));
  }
});

// Find row background in TodaysInjections
inj.split('\n').forEach((line, i) => {
  if (line.includes('background') && (line.includes('160') || line.includes('0d0d') || line.includes('color-card') || line.includes('color-surface'))) {
    console.log('INJ ' + (i+1) + ': ' + line.trim().slice(0, 130));
  }
});
