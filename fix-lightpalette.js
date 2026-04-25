const fs = require('fs');
let globals = fs.readFileSync('app/globals.css', 'utf8');

globals = globals.replace(
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
  --color-purple: #4A3F9F;
  --color-orange: #C4581A;
  --color-cyan: #0E7490;
  --color-red: #B91C1C;
}`
);

globals = globals.replace(
  `[data-theme="light"] body {
  background-color: #f0e9da;
  background-image:
    radial-gradient(ellipse 80% 50% at 15% 10%, rgba(180, 140, 80, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse 60% 45% at 90% 20%, rgba(200, 160, 90, 0.10) 0%, transparent 50%),
    radial-gradient(ellipse 50% 40% at 50% 50%, rgba(160, 130, 80, 0.06) 0%, transparent 60%),
    linear-gradient(180deg, #f0e9da 0%, #ece3cf 50%, #f0e9da 100%);
  background-attachment: fixed;
  background-size: cover, cover, cover, cover;
}`,
  `[data-theme="light"] body {
  background-color: #F4EDE0;
  background-image:
    radial-gradient(ellipse 80% 60% at 15% 10%, rgba(139, 100, 40, 0.10) 0%, transparent 55%),
    radial-gradient(ellipse 60% 50% at 88% 18%, rgba(180, 130, 60, 0.09) 0%, transparent 50%),
    radial-gradient(ellipse 70% 55% at 80% 88%, rgba(100, 80, 40, 0.07) 0%, transparent 55%),
    radial-gradient(ellipse 50% 40% at 12% 85%, rgba(160, 120, 60, 0.06) 0%, transparent 55%),
    linear-gradient(160deg, #F7F0E2 0%, #EFE5CE 40%, #F4EDE0 100%),
    url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.025'/%3E%3C/svg%3E");
  background-attachment: fixed;
  background-size: cover, cover, cover, cover, cover, 512px 512px;
}`
);

fs.writeFileSync('app/globals.css', globals, 'utf8');
console.log('Done! globals.css updated.');
