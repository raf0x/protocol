const fs = require('fs');
let globals = fs.readFileSync('app/globals.css', 'utf8');

globals = globals.replace(
  `[data-theme="light"] {
  --color-bg: #F4EDE0;
  --color-card: #FBF6EC;
  --color-border: #E2D5BE;
  --color-green: #1A6B42;
  --color-green-text: #ffffff;
  --color-text: #1C1814;
  --color-dim: #6B5D4A;
  --color-muted: #A8957A;
  --color-input: #EDE4D3;
  --color-surface: #F0E8D8;
  --color-nav: #FBF6EC;
  --color-nav-blur: rgba(251,246,236,0.96);
  --color-green-05: rgba(26,107,66,0.05);
  --color-green-10: rgba(26,107,66,0.10);
  --color-green-15: rgba(26,107,66,0.15);
  --color-green-20: rgba(26,107,66,0.20);
  --color-green-30: rgba(26,107,66,0.30);
  --color-green-40: rgba(26,107,66,0.40);
  --color-green-50: rgba(26,107,66,0.50);
  --color-green-60: rgba(26,107,66,0.60);
}`,
  `[data-theme="light"] {
  --color-bg: #F7F7F7;
  --color-card: #FFFFFF;
  --color-border: #E8E8E8;
  --color-green: #5DD879;
  --color-green-text: #ffffff;
  --color-text: #111111;
  --color-dim: #555555;
  --color-muted: #999999;
  --color-input: #F0F0F0;
  --color-surface: #111111;
  --color-nav: #FFFFFF;
  --color-nav-blur: rgba(255,255,255,0.95);
  --color-green-05: rgba(93,216,121,0.05);
  --color-green-10: rgba(93,216,121,0.10);
  --color-green-15: rgba(93,216,121,0.15);
  --color-green-20: rgba(93,216,121,0.20);
  --color-green-30: rgba(93,216,121,0.30);
  --color-green-40: rgba(93,216,121,0.40);
  --color-green-50: rgba(93,216,121,0.50);
  --color-green-60: rgba(93,216,121,0.60);
}`
);

// Update light mode body background
globals = globals.replace(
  `[data-theme="light"] body {
  background-color: #F4EDE0;
  background-image:
    radial-gradient(ellipse 80% 60% at 15% 10%, rgba(139, 100, 40, 0.10) 0%, transparent 55%),
    radial-gradient(ellipse 60% 50% at 88% 18%, rgba(180, 130, 60, 0.09) 0%, transparent 50%),
    radial-gradient(ellipse 70% 55% at 80% 88%, rgba(100, 80, 40, 0.07) 0%, transparent 55%),
    radial-gradient(ellipse 50% 40% at 12% 85%, rgba(160, 120, 60, 0.06) 0%, transparent 55%),
    linear-gradient(160deg, #F7F0E2 0%, #EFE5CE 40%, #F4EDE0 100%),
    url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.025'/%3E%3C/svg%3E");
  background-size: cover, cover, cover, cover, cover, 512px 512px;
}`,
  `[data-theme="light"] body {
  background-color: #F7F7F7;
  background-image: none;
}`
);

// Update light mode body::before
globals = globals.replace(
  `[data-theme="light"] body::before {
  background-image:
    radial-gradient(circle at 20% 30%, rgba(180, 140, 80, 0.06) 0%, transparent 40%),
    radial-gradient(circle at 75% 70%, rgba(139, 92, 246, 0.03) 0%, transparent 35%);
}`,
  `[data-theme="light"] body::before {
  display: none;
}`
);

fs.writeFileSync('app/globals.css', globals, 'utf8');
console.log('Done! Light mode palette updated.');
