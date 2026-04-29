const fs = require('fs');
const inv = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');
const inj = fs.readFileSync('components/dashboard/TodaysInjections.tsx', 'utf8');

console.log('=== VialInventory line 242 ===');
console.log(inv.split('\n')[241]);

console.log('\n=== TodaysInjections rows ===');
inj.split('\n').forEach((line, i) => {
  if (line.includes('rgba(160') || line.includes('rgba(200') || line.includes('0d0d') || line.includes('#111') || line.includes('rgba(0,0')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 130));
  }
});
