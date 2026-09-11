const fs = require('fs');
let content = fs.readFileSync('components/BottomNav.tsx', 'utf8');
content = content.replace(
  "  const pathname = usePathname()",
  "  const pathname = usePathname()\n  if (pathname === '/') return null"
);
fs.writeFileSync('components/BottomNav.tsx', content, 'utf8');
console.log('Done');
