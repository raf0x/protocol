const fs = require('fs');
const css = `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  background-color: #0a0a0f;
  background-image: 
    radial-gradient(ellipse at 20% 50%, rgba(108, 99, 255, 0.15) 0%, transparent 60%),
    radial-gradient(ellipse at 80% 20%, rgba(108, 99, 255, 0.1) 0%, transparent 50%),
    radial-gradient(ellipse at 60% 80%, rgba(57, 255, 20, 0.05) 0%, transparent 40%),
    url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E");
  background-attachment: fixed;
  min-height: 100vh;
}
`;
fs.writeFileSync('app/globals.css', css, 'utf8');
console.log('Done');
