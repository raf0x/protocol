const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');
content = content.replace(
  `<a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'800',padding:'16px 36px',borderRadius:'8px',fontSize:'16px',letterSpacing:'0.5px'}}>Get early access</a>`,
  `<a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'800',padding:'16px 36px',borderRadius:'8px',fontSize:'16px',letterSpacing:'0.5px'}}>Get early access</a>
            <a href='/demo' style={{background:'rgba(255,255,255,0.06)',color:'white',textDecoration:'none',fontWeight:'700',padding:'16px 28px',borderRadius:'8px',fontSize:'16px',border:'1px solid rgba(255,255,255,0.15)'}}>See it in action \u2192</a>`
);
fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done!');
