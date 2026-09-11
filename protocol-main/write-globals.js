const fs = require('fs');
const content = `@tailwind base;
@tailwind components;
@tailwind utilities;

/* -- Theme tokens -- */
:root {
  --color-bg: #0a0a0f;
  --color-card: #12121a;
  --color-border: #1e1e2e;
  --color-green: #39ff14;
  --color-text: #ffffff;
  --color-dim: #8b8ba7;
  --color-muted: #3d3d5c;
  --color-input: #0a0a0f;
  --color-surface: #1a1a2e;
  --color-nav: #0a0a0f;
  --color-nav-blur: rgba(10,10,15,0.9);
}

[data-theme="light"] {
  --color-bg: #f5f4f0;
  --color-card: #ffffff;
  --color-border: #e0dfd8;
  --color-green: #39ff14;
  --color-text: #1a1714;
  --color-dim: #6b6a7a;
  --color-muted: #b0afba;
  --color-input: #eeecea;
  --color-surface: #f4f3ef;
  --color-nav: #ffffff;
  --color-nav-blur: rgba(245,244,240,0.92);
}

body {
  background-color: #0c0c14;
  background-image:
    radial-gradient(ellipse 80% 50% at 15% 10%, rgba(139, 92, 246, 0.16) 0%, transparent 55%),
    radial-gradient(ellipse 60% 45% at 90% 20%, rgba(251, 191, 36, 0.13) 0%, transparent 50%),
    radial-gradient(ellipse 70% 55% at 85% 85%, rgba(139, 92, 246, 0.12) 0%, transparent 55%),
    radial-gradient(ellipse 80% 60% at 10% 90%, rgba(251, 191, 36, 0.10) 0%, transparent 55%),
    radial-gradient(ellipse 50% 40% at 50% 50%, rgba(167, 139, 250, 0.07) 0%, transparent 60%),
    linear-gradient(180deg, #0c0c14 0%, #0f0d18 50%, #0c0c14 100%),
    url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
  background-attachment: fixed;
  background-size: cover, cover, cover, cover, cover, cover, 512px 512px;
  min-height: 100vh;
  position: relative;
}

body::before {
  content: '';
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(251, 191, 36, 0.07) 0%, transparent 40%),
    radial-gradient(circle at 75% 70%, rgba(139, 92, 246, 0.05) 0%, transparent 35%);
  pointer-events: none;
  z-index: 0;
  animation: ambientDrift 30s ease-in-out infinite alternate;
}

[data-theme="light"] body {
  background-color: #f5f4f0;
  background-image:
    radial-gradient(ellipse 80% 50% at 15% 10%, rgba(139, 92, 246, 0.05) 0%, transparent 55%),
    radial-gradient(ellipse 60% 45% at 90% 20%, rgba(251, 191, 36, 0.07) 0%, transparent 50%),
    radial-gradient(ellipse 50% 40% at 50% 50%, rgba(167, 139, 250, 0.03) 0%, transparent 60%),
    linear-gradient(180deg, #f5f4f0 0%, #f0efe8 50%, #f5f4f0 100%);
  background-attachment: fixed;
  background-size: cover, cover, cover, cover;
}

[data-theme="light"] body::before {
  background-image:
    radial-gradient(circle at 20% 30%, rgba(251, 191, 36, 0.04) 0%, transparent 40%),
    radial-gradient(circle at 75% 70%, rgba(139, 92, 246, 0.03) 0%, transparent 35%);
}

@keyframes ambientDrift {
  0% { transform: translate(0, 0); opacity: 0.7; }
  50% { transform: translate(10px, -15px); opacity: 1; }
  100% { transform: translate(-8px, 10px); opacity: 0.8; }
}
`;
fs.writeFileSync('app/globals.css', content, 'utf8');
console.log('Done! globals.css saved.');
