const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// Remove the broken syringe emoji span entirely
content = content.replace(
  `<span style={{fontSize:'clamp(32px,7vw,52px)',display:'block',lineHeight:1,marginRight:'8px',animation:'syringeFloat 4s ease-in-out infinite',flexShrink:0}}>\ud83d\udc89</span>`,
  ``
);

// Also remove the syringeFloat animation since we no longer need it
content = content.replace(
  `  @keyframes syringeFloat {
    0%,100% { transform: translateY(-50%) rotate(170deg) translateX(0px); }
    55%     { transform: translateY(-50%) rotate(170deg) translateX(12px); }
    80%     { transform: translateY(-50%) rotate(170deg) translateX(12px); }
  }`,
  ``
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done!');
