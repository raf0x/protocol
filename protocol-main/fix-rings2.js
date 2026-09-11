const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Fix 1: uncap rings from 4, expand to 6
content = content.replace(
  `}).slice(0,4);`,
  `}).slice(0,6);`
);

// Fix 2: expand padded array from 4 to next even number
content = content.replace(
  `const padded = [...items, ...Array(4-items.length).fill(null)];`,
  `const total = items.length <= 4 ? 4 : 6; const padded = [...items, ...Array(total-items.length).fill(null)];`
);

// Fix 3: hide scrollbar on tabs row
content = content.replace(
  `display:'flex',gap:'6px',marginBottom:'12px',overflowX:'auto',paddingBottom:'4px'`,
  `display:'flex',gap:'6px',marginBottom:'12px',overflowX:'auto',paddingBottom:'4px',scrollbarWidth:'none',msOverflowStyle:'none'`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
