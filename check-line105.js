const fs = require('fs');
let content = fs.readFileSync('components/dashboard/TodaysInjections.tsx', 'utf8');
const lines = content.split('\n');
console.log('Line 103:', lines[102].trim().slice(0, 120));
console.log('Line 104:', lines[103].trim().slice(0, 120));
console.log('Line 105:', lines[104].trim().slice(0, 120));
console.log('Line 106:', lines[105].trim().slice(0, 120));
console.log('Line 107:', lines[106].trim().slice(0, 120));
console.log('Line 108:', lines[107].trim().slice(0, 120));
