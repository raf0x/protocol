const fs = require('fs');
let content = fs.readFileSync('public/sw.js', 'utf8');
content = content.replace("const CACHE_NAME = 'protocol-v5'", "const CACHE_NAME = 'protocol-v6'");
fs.writeFileSync('public/sw.js', content, 'utf8');
console.log('Done');
