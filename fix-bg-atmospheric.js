const fs = require('fs');
const css = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0a0a0f;
  background-image:
    radial-gradient(ellipse 80% 50% at 15% 10%, rgba(139, 92, 246, 0.18) 0%, transparent 55%),
    radial-gradient(ellipse 60% 45% at 90% 20%, rgba(108, 99, 255, 0.15) 0%, transparent 50%),
    radial-gradient(ellipse 70% 55% at 85% 85%, rgba(6, 182, 212, 0.1) 0%, transparent 55%),
    radial-gradient(ellipse 80% 60% at 10% 90%, rgba(57, 255, 20, 0.07) 0%, transparent 55%),
    radial-gradient(ellipse 50% 40% at 50% 50%, rgba(167, 139, 250, 0.08) 0%, transparent 60%),
    linear-gradient(180deg, #0a0a0f 0%, #0d0d18 50%, #0a0a0f 100%),
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
    radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.06) 0%, transparent 40%),
    radial-gradient(circle at 75% 70%, rgba(57, 255, 20, 0.04) 0%, transparent 35%);
  pointer-events: none;
  z-index: 0;
  animation: ambientDrift 30s ease-in-out infinite alternate;
}

@keyframes ambientDrift {
  0% { transform: translate(0, 0); opacity: 0.7; }
  50% { transform: translate(10px, -15px); opacity: 1; }
  100% { transform: translate(-8px, 10px); opacity: 0.8; }
}
`;
fs.writeFileSync('app/globals.css', css, 'utf8');
console.log('Done');
