const fs = require('fs');
let content = fs.readFileSync('app/globals.css', 'utf8');

content = content.replace(
  `[data-theme="light"] {
  --color-bg: #f0e9da;
  --color-card: #faf4e8;
  --color-border: #dfd5c0;
  --color-green: #39ff14;
  --color-text: #1c1a14;
  --color-dim: #6b6356;
  --color-muted: #a09278;
  --color-input: #ece5d5;
  --color-surface: #f5efe2;
  --color-nav: #faf4e8;
  --color-nav-blur: rgba(250,244,232,0.95);
}`,
  `[data-theme="light"] {
  --color-bg: #F4EDE0;
  --color-card: #FBF6EC;
  --color-border: #E2D5BE;
  --color-green: #1A6B42;
  --color-text: #1C1814;
  --color-dim: #6B5D4A;
  --color-muted: #A8957A;
  --color-input: #EDE4D3;
  --color-surface: #F0E8D8;
  --color-nav: #FBF6EC;
  --color-nav-blur: rgba(251,246,236,0.96);
  --color-green-05: rgba(26,107,66,0.05);
  --color-green-10: rgba(26,107,66,0.1);
  --color-green-15: rgba(26,107,66,0.15);
  --color-green-20: rgba(26,107,66,0.2);
  --color-green-30: rgba(26,107,66,0.3);
  --color-green-40: rgba(26,107,66,0.4);
  --color-green-50: rgba(26,107,66,0.5);
  --color-green-60: rgba(26,107,66,0.6);
}`
);

fs.writeFileSync('app/globals.css', content, 'utf8');
console.log('Fixed: ' + (content.includes('#1A6B42') ? 'yes' : 'NO - not found'));
