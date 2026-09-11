const fs = require('fs');
let content = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');

// Fix Edit buttons - black bg in light mode
content = content.split("background:'#0d0d1a'").join("background:'var(--color-surface)'");
content = content.split("background:'rgba(0,0,0,0.85)'").join("background:'rgba(0,0,0,0.8)'");

// Fix all remaining hardcoded dark backgrounds on buttons
content = content.replace(
  /background:'#[0-9a-f]{6}',border:'1px solid rgba\(255,255,255/g,
  "background:'var(--color-surface)',border:'1px solid var(--color-border"
);

// Fix vials in stock value color
content = content.replace(
  `color:count<=1?'#ff6b6b':count<=2?'#f59e0b':'rgba(255,255,255,0.8)'`,
  `color:count<=1?'#ff6b6b':count<=2?'#f59e0b':'var(--color-text)'`
);

// Fix Edit button text color
content = content.split("padding:'5px 8px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>\u2713</button>").join("padding:'5px 8px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>\u2713</button>");

fs.writeFileSync('components/dashboard/VialInventory.tsx', content, 'utf8');
console.log('Done!');
