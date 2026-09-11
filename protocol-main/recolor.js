const fs = require('fs');
const path = require('path');

const replacements = [
  // Backgrounds
  ["background:'#000000'", "background:'#0a0a0f'"],
  ["background:'#030712'", "background:'#0a0a0f'"],
  ["background:'#111827'", "background:'#12121a'"],
  ["background:'#0d0d0d'", "background:'#12121a'"],
  // Borders
  ["'1px solid #1a1a1a'", "'1px solid #1e1e2e'"],
  ["border:'#1a1a1a'", "border:'#1e1e2e'"],
  // Secondary text (muted green -> lavender)
  ["color:'#4dbd4d'", "color:'#8b8ba7'"],
  ["color:dg", "color:dg"],
  // Dim text
  ["color:'#2d5a2d'", "color:'#3d3d5c'"],
  ["color:mg", "color:mg"],
  // Blue accents -> purple
  ["'#2563eb'", "'#6c63ff'"],
  ["'#1d4ed8'", "'#5549e8'"],
  ["'#3b82f6'", "'#6c63ff'"],
  ["'#1f2937'", "'#12121a'"],
  ["'#374151'", "'#1e1e2e'"],
  // Nav background
  ["background:'#111827'", "background:'#0d0d14'"],
];

const pages = [
  'app/page.tsx',
  'app/calculator/page.tsx',
  'app/protocol/page.tsx',
  'app/journal/page.tsx',
  'app/learn/page.tsx',
  'app/profile/page.tsx',
  'app/community/page.tsx',
  'app/auth/login/page.tsx',
  'app/onboarding/page.tsx',
  'app/admin/page.tsx',
  'components/BottomNav.tsx',
];

pages.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  replacements.forEach(([from, to]) => {
    content = content.split(from).join(to);
  });
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Updated:', filePath);
  }
});

// Also update the color variables in pages that use g/dg/mg
const colorVarPages = [
  'app/protocol/page.tsx',
  'app/journal/page.tsx',
  'app/community/page.tsx',
  'app/profile/page.tsx',
  'app/calculator/page.tsx',
  'app/admin/page.tsx',
  'app/learn/page.tsx',
  'app/onboarding/page.tsx',
];

colorVarPages.forEach(filePath => {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  content = content
    .replace(/const dg = '#4dbd4d'/g, "const dg = '#8b8ba7'")
    .replace(/const mg = '#2d5a2d'/g, "const mg = '#3d3d5c'")
    .replace(/const cb = '#0d0d0d'/g, "const cb = '#12121a'")
    .replace(/const bd = '#1a1a1a'/g, "const bd = '#1e1e2e'");
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Color vars updated:', filePath);
});

console.log('All done');
