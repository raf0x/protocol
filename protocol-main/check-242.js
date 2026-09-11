const fs = require('fs');
let content = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');
const lines = content.split('\n');
console.log('Full line 242:', lines[241]);
