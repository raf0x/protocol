const fs = require('fs');
const content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
const start = content.indexOf('const colors = [');
const end = content.indexOf('})()}', start) + 5;
console.log(content.slice(start, end));
