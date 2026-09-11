const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');
const lines = content.split('\n');

const newButtons = `        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'12px'}}>
          <a href='/demo' style={{background:'var(--color-green)',color:'var(--color-green-text)',textDecoration:'none',fontWeight:'800',padding:'16px 48px',borderRadius:'8px',fontSize:'18px',letterSpacing:'0.5px',textAlign:'center',width:'100%',maxWidth:'320px',boxSizing:'border-box',display:'block'}}>See it in action \u2192</a>
          <div style={{display:'flex',gap:'12px',justifyContent:'center',flexWrap:'wrap'}}>
            <a href='/auth/login' style={{background:'var(--color-text)',color:'var(--color-bg)',textDecoration:'none',fontWeight:'800',padding:'12px 24px',borderRadius:'8px',fontSize:'14px'}}>Get early access</a>
            <a href='/calculator' style={{background:'transparent',color:'#8b8ba7',textDecoration:'none',fontWeight:'600',padding:'12px 24px',borderRadius:'8px',fontSize:'14px',border:'1px solid #1e1e2e'}}>Try the calculator \u2192</a>
          </div>
        </div>`;

// Replace lines 145-149 (0-indexed 144-148)
const result = [...lines.slice(0, 144), newButtons, ...lines.slice(149)];
fs.writeFileSync('app/page.tsx', result.join('\n'), 'utf8');
console.log('Done!');
