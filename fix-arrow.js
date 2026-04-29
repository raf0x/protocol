const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Find the weight change tile and add arrow
content = content.replace(
  `<div style={{fontSize:'20px',fontWeight:'900',color:tl !== null ? (parseFloat(tl) > 0 ? g : '#ff6b6b') : g}}>{tl !== null ? (parseFloat(tl) > 0 ? '-'+Math.abs(parseFloat(tl)) : '+'+Math.abs(parseFloat(tl)))+' lbs' : '\u2014'}</div>`,
  `<div style={{fontSize:'20px',fontWeight:'900',color:tl !== null ? (parseFloat(tl) > 0 ? g : '#ff6b6b') : g}}>
    {tl !== null ? (
      <>
        <span style={{fontSize:'14px',marginRight:'2px'}}>{parseFloat(tl) > 0 ? '\u2193' : '\u2191'}</span>
        {Math.abs(parseFloat(tl))} lbs
      </>
    ) : '\u2014'}
  </div>`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Trend arrow added.');
