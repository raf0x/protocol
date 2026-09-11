const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// Replace the whole inline-flex container with a simple centered div
content = content.replace(
  `<div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:'0px',position:'relative'}}>
              <span style={{fontSize:'clamp(32px,7vw,52px)',display:'block',lineHeight:1,marginRight:'8px',animation:'syringeFloat 4s ease-in-out infinite',flexShrink:0}}>??</span>
              <div style={{position:'relative',display:'inline-block'}}>`,
  `<div style={{display:'flex',justifyContent:'center'}}>
              <div style={{position:'relative',display:'inline-block'}}>`
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes("display:'flex',justifyContent:'center'") ? 'yes' : 'NO'));
