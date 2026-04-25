const fs = require('fs');
let content = fs.readFileSync('app/layout.tsx', 'utf8');

content = content.replace(
  `import BottomNav from '../components/BottomNav'`,
  `import BottomNav from '../components/BottomNav'
import ThemeToggle from '../components/ThemeToggle'`
);

content = content.replace(
  `        <BottomNav />`,
  `        <BottomNav />
        <ThemeToggle />`
);

fs.writeFileSync('app/layout.tsx', content, 'utf8');
console.log('Done! Layout updated.');
