const fs = require('fs');
let content = fs.readFileSync('proxy.ts', 'utf8');
content = content.replace(
  "  const isAuthPage = request.nextUrl.pathname.startsWith('/auth')",
  "  const isAuthPage = request.nextUrl.pathname.startsWith('/auth')\n  const isApiRoute = request.nextUrl.pathname.startsWith('/api')"
);
content = content.replace(
  "  if (!user && !isAuthPage && !isPublicPage) {",
  "  if (!user && !isAuthPage && !isPublicPage && !isApiRoute) {"
);
fs.writeFileSync('proxy.ts', content, 'utf8');
console.log('Done');
