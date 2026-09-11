const fs = require('fs');
const globals = fs.readFileSync('app/globals.css', 'utf8');
const idx = globals.indexOf('[data-theme="light"]');
console.log(globals.slice(idx, idx + 300));
