const fs = require('fs');

// Step 1: add --color-green-text token to both themes in globals.css
let globals = fs.readFileSync('app/globals.css', 'utf8');

globals = globals.replace(
  `  --color-green-05: rgba(57,255,20,0.05);`,
  `  --color-green-text: #000000;
  --color-green-05: rgba(57,255,20,0.05);`
);

globals = globals.replace(
  `  --color-green-05: rgba(26,107,66,0.05);`,
  `  --color-green-text: #ffffff;
  --color-green-05: rgba(26,107,66,0.05);`
);

fs.writeFileSync('app/globals.css', globals, 'utf8');
console.log('globals.css updated');

// Step 2: replace color:'#000' next to green backgrounds across all files
const files = [
  'app/protocol/page.tsx',
  'app/journal/page.tsx',
  'app/community/page.tsx',
  'app/profile/page.tsx',
  'app/calculator/page.tsx',
  'app/protocol/manage/page.tsx',
  'components/BottomNav.tsx',
];

files.forEach(filepath => {
  if (!fs.existsSync(filepath)) return;
  let content = fs.readFileSync(filepath, 'utf8');

  // Any button/element that uses green as background and black as text
  content = content.split("background:saving?'#1a3d1a':g,color:saving?mg:'#000'").join("background:saving?'var(--color-green-20)':g,color:saving?'var(--color-muted)':'var(--color-green-text)'");
  content = content.split("background:saving?'#1a3d1a':g,color:saving?mg:'#000000'").join("background:saving?'var(--color-green-20)':g,color:saving?'var(--color-muted)':'var(--color-green-text)'");
  content = content.split("background:!eventDesc.trim()?'#1a3d1a':g,color:!eventDesc.trim()?mg:'#000'").join("background:!eventDesc.trim()?'var(--color-green-20)':g,color:!eventDesc.trim()?'var(--color-muted)':'var(--color-green-text)'");
  content = content.split(",color:'#000'").join(",color:'var(--color-green-text)'");
  content = content.split(",color:'#000000'").join(",color:'var(--color-green-text)'");
  content = content.split("color:'#000'").join("color:'var(--color-green-text)'");
  content = content.split("color:'#000000'").join("color:'var(--color-green-text)'");
  content = content.split('color:"#000"').join('color:"var(--color-green-text)"');
  content = content.split('color:"#000000"').join('color:"var(--color-green-text)"');

  fs.writeFileSync(filepath, content, 'utf8');
  console.log('Updated: ' + filepath);
});

console.log('All done!');
