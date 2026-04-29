const fs = require('fs');
const inv = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');
const inj = fs.readFileSync('components/dashboard/TodaysInjections.tsx', 'utf8');

console.log('=== VialInventory line 242 full ===');
console.log(inv.split('\n')[241]);

console.log('\n=== TodaysInjections full file ===');
inj.split('\n').forEach((line, i) => {
  if (i >= 85 && i <= 115) console.log((i+1) + ': ' + line);
});
