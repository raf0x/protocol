const fs = require('fs');
let content = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');
const lines = content.split('\n');
[241, 266, 284].forEach(i => console.log((i+1) + ': ' + lines[i].trim().slice(0, 150)));
