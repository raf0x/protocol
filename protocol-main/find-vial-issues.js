const fs = require('fs');
const content = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');
const lines = content.split('\n');
lines.forEach((line, i) => {
  if (line.includes('Edit') || line.includes('count<=1') || line.includes('vials_in_stock') || line.includes('rgba(255,255')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 120));
  }
});
