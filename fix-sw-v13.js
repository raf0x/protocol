const fs = require('fs');
let content = fs.readFileSync('public/sw.js', 'utf8');
content = content.replace(/protocol-v\d+/, "protocol-v13");
fs.writeFileSync('public/sw.js', content, 'utf8');
console.log('Done');
