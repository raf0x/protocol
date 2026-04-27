const fs = require('fs');
const content = fs.readFileSync('proxy.ts', 'utf8');
console.log(content);
