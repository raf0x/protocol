const fs = require('fs');
let content = fs.readFileSync('proxy.ts', 'utf8');
content = content.replace(
  `const isPublicPage = path === '/' || path === '/calculator' || path === '/onboarding' || path.startsWith('/share')`,
  `const isPublicPage = path === '/' || path === '/calculator' || path === '/onboarding' || path.startsWith('/share') || path.startsWith('/demo')`
);
fs.writeFileSync('proxy.ts', content, 'utf8');
console.log('Done!');
