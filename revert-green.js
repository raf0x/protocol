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

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let content = fs.readFileSync(f, 'utf8');
  content = content.split('#4ade80').join('#39ff14');
  fs.writeFileSync(f, content, 'utf8');
});

let css = fs.readFileSync('app/globals.css', 'utf8');
css = css.replace(/74, 222, 128/g, '57, 255, 20');
fs.writeFileSync('app/globals.css', css, 'utf8');

console.log('Reverted to #39ff14');
