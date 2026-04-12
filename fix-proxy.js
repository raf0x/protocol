const fs = require('fs');
let content = fs.readFileSync('proxy.ts', 'utf8');
content = content.replace('export async function middleware(', 'export async function proxy(');
fs.writeFileSync('proxy.ts', content, 'utf8');
console.log('Done');
