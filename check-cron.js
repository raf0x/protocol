const fs = require('fs');
const content = fs.readFileSync('app/api/cron/route.ts', 'utf8');
console.log(content);
