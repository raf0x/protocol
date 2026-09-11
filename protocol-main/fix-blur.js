const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');
content = content.replace(
  "  @keyframes fadeSlideUp {\n    from { opacity: 0; transform: translateY(40px) blur(8px); }\n    to { opacity: 1; transform: translateY(0) blur(0); }\n  }",
  "  @keyframes fadeSlideUp {\n    from { opacity: 0; transform: translateY(40px); }\n    to { opacity: 1; transform: translateY(0); }\n  }"
);
content = content.replace(
  "  .scroll-hidden { opacity: 0; transform: translateY(40px); filter: blur(4px); transition: opacity 0.7s ease, transform 0.7s ease, filter 0.7s ease, box-shadow 0.7s ease, border-color 0.7s ease; }",
  "  .scroll-hidden { opacity: 0; transform: translateY(40px); transition: opacity 0.7s ease, transform 0.7s ease, box-shadow 0.7s ease, border-color 0.7s ease; }"
);
content = content.replace(
  "  .scroll-visible { opacity: 1; transform: translateY(0); filter: blur(0); }",
  "  .scroll-visible { opacity: 1; transform: translateY(0); }"
);
fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
