const fs = require('fs');
let content = fs.readFileSync('public/sw.js', 'utf8');
content = content.replace("const CACHE_NAME = 'protocol-v3'", "const CACHE_NAME = 'protocol-v4'");
fs.writeFileSync('public/sw.js', content, 'utf8');
console.log('Done');
