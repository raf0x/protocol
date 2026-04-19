const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

const comparisonSection = `      {/* Old Way vs Protocol */}
      <section className='scroll-hidden' style={{padding:'40px 24px 60px',maxWidth:'640px',margin:'0 auto'}}>
        <p style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'24px',textAlign:'center'}}>WHY PROTOCOL</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0',borderRadius:'12px',overflow:'hidden',border:'1px solid #1e1e2e'}}>
          <div style={{background:'#12121a',padding:'20px'}}>
            <p style={{fontSize:'13px',fontWeight:'700',color:'#ff6b6b',marginBottom:'14px'}}>The Old Way</p>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {['Guessing if it works','Forgetting doses','Spreadsheet chaos','No trends or insights','Scattered Reddit threads'].map(item => (
                <div key={item} style={{display:'flex',gap:'8px',alignItems:'center',fontSize:'12px',color:'#8b8ba7'}}>
                  <span style={{color:'#ff6b6b'}}>✕</span> {item}
                </div>
              ))}
            </div>
          </div>
          <div style={{background:'rgba(57,255,20,0.03)',padding:'20px',borderLeft:'1px solid #1e1e2e'}}>
            <p style={{fontSize:'13px',fontWeight:'700',color:'#39ff14',marginBottom:'14px'}}>With Protocol</p>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {['See what actually works','Injection reminders','Phase-based tracking','Real-time insights','Private community'].map(item => (
                <div key={item} style={{display:'flex',gap:'8px',alignItems:'center',fontSize:'12px',color:'#8b8ba7'}}>
                  <span style={{color:'#39ff14'}}>✓</span> {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

`;

// Insert before the Privacy section
content = content.replace(
  "      {/* Privacy */}",
  comparisonSection + "      {/* Privacy */}"
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
