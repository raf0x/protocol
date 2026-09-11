const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Fix 1: center text vertically in weight tiles
content = content.replace(
  `<div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{lw ? lw+' lbs' : '\u2014'}</div><div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>CURRENT WEIGHT</div></div>`,
  `<div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:'#f59e0b'}}>{lw ? lw+' lbs' : '\u2014'}</div><div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>CURRENT WEIGHT</div></div>`
);

content = content.replace(
  `<div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:tl !== null ? (parseFloat(tl) > 0 ? g : '#ff6b6b') : g}}>{tl !== null ? (parseFloat(tl) > 0 ? '-'+Math.abs(parseFloat(tl)) : '+'+Math.abs(parseFloat(tl)))+' lbs' : '\u2014'}</div><div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>WEIGHT CHANGE</div></div>`,
  `<div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'12px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}><div style={{fontSize:'20px',fontWeight:'900',color:tl !== null ? (parseFloat(tl) > 0 ? g : '#ff6b6b') : g}}>{tl !== null ? (parseFloat(tl) > 0 ? '-'+Math.abs(parseFloat(tl)) : '+'+Math.abs(parseFloat(tl)))+' lbs' : '\u2014'}</div><div style={{fontSize:'10px',color:dg,marginTop:'2px',letterSpacing:'1px',fontWeight:'600'}}>WEIGHT CHANGE</div></div>`
);

// Fix 2: remove tile border from rings, float freely, bigger
content = content.replace(
  `<div style={{background:cb,border:'1px solid '+bd,borderRadius:'10px',padding:'10px',display:'flex',alignItems:'center',justifyContent:'center'}}>`,
  `<div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>`
);

// Make rings bigger: 54px -> 64px
content = content.replace(/width:'54px',height:'54px',borderRadius:'50%',border:'3px solid '/g, `width:'64px',height:'64px',borderRadius:'50%',border:'3px solid '`);
content = content.replace(/width:'54px',height:'54px'\}/g, `width:'64px',height:'64px'}`);

// Bigger font inside rings
content = content.replace(
  `fontSize:'9px',fontWeight:'800',color:'white',textAlign:'center',lineHeight:'1.2',letterSpacing:'0.2px'`,
  `fontSize:'10px',fontWeight:'800',color:'white',textAlign:'center',lineHeight:'1.2',letterSpacing:'0.2px'`
);
content = content.replace(
  `fontSize:'9px',fontWeight:'600',color:rc,textAlign:'center',lineHeight:'1.2'`,
  `fontSize:'10px',fontWeight:'600',color:rc,textAlign:'center',lineHeight:'1.2'`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
