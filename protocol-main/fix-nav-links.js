const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

content = content.replace(
  "        <span style={{fontSize:'20px',fontWeight:'800',color:'#39ff14',letterSpacing:'2px'}}>PROTOCOL</span>\n        <a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'700',padding:'8px 20px',borderRadius:'6px',fontSize:'14px'}}>Sign in</a>",
  `        <span style={{fontSize:'20px',fontWeight:'800',color:'#39ff14',letterSpacing:'2px'}}>PROTOCOL</span>
        <div style={{display:'flex',alignItems:'center',gap:'16px'}}>
          <a href='#features' style={{color:'#8b8ba7',textDecoration:'none',fontSize:'13px',fontWeight:'500'}}>Features</a>
          <a href='/calculator' style={{color:'#8b8ba7',textDecoration:'none',fontSize:'13px',fontWeight:'500'}}>Calculator</a>
          <a href='#faq' style={{color:'#8b8ba7',textDecoration:'none',fontSize:'13px',fontWeight:'500'}}>FAQ</a>
          <a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'700',padding:'8px 20px',borderRadius:'6px',fontSize:'14px'}}>Sign in</a>
        </div>`
);

// Add id anchors to sections
content = content.replace(
  "        <p style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'40px',textAlign:'center'}}>WHAT YOU GET</p>",
  "        <p id='features' style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'40px',textAlign:'center',scrollMarginTop:'80px'}}>WHAT YOU GET</p>"
);

content = content.replace(
  "        <p className='scroll-hidden' style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'24px',textAlign:'center'}}>QUESTIONS</p>",
  "        <p id='faq' className='scroll-hidden' style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'24px',textAlign:'center',scrollMarginTop:'80px'}}>QUESTIONS</p>"
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
