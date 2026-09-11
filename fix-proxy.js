const fs = require('fs');
let content = fs.readFileSync('proxy.ts', 'utf8');
content = content.replace(
  `const isPublicPage = path === '/' || path === '/calculator' || path === '/onboarding'`,
  `const isPublicPage = path === '/' || path === '/calculator' || path === '/onboarding' || path.startsWith('/share')`
);
fs.writeFileSync('proxy.ts', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes("path.startsWith('/share')") ? 'yes' : 'NO'));
