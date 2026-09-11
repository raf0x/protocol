const fs = require('fs');

const files = [
  'app/page.tsx',
  'app/protocol/page.tsx',
  'app/protocol/manage/page.tsx',
  'app/journal/page.tsx',
  'app/calculator/page.tsx',
  'app/community/page.tsx',
  'app/community/cohorts/[id]/page.tsx',
  'app/profile/page.tsx',
  'app/auth/login/page.tsx',
  'app/onboarding/page.tsx',
  'app/admin/page.tsx',
  'app/learn/page.tsx',
  'components/BottomNav.tsx',
  'app/api/og/route.tsx',
];

let count = 0;
files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');
  const original = content;

  // Rebrand green
  content = content.split('#39ff14').join('#4ade80');
  content = content.split("'#39ff14'").join("'#4ade80'");

  if (content !== original) { fs.writeFileSync(f, content, 'utf8'); count++; console.log('Updated:', f); }
});

// Also update globals.css green references
let css = fs.readFileSync('app/globals.css', 'utf8');
css = css.replace(/57, 255, 20/g, '74, 222, 128');
fs.writeFileSync('app/globals.css', css, 'utf8');
console.log('Updated: globals.css');

console.log('Total files updated:', count);
