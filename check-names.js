const fs = require('fs');

// Fix 1: Tomorrow's Injections - compound names missing
// The tomorrowCompounds don't have names because the DueCompound type
// is built from dueCompounds which uses compound data - check TodaysInjections
let inj = fs.readFileSync('components/dashboard/TodaysInjections.tsx', 'utf8');
console.log('TodaysInjections name field:');
const lines = inj.split('\n');
lines.forEach((line, i) => {
  if (line.includes('c.name') || line.includes('compound') || line.includes('name')) {
    console.log((i+1) + ': ' + line.trim().slice(0, 100));
  }
});
