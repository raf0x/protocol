const fs = require('fs');
const content = `export default function GamePage() {
  return (
    <div style={{width:'100vw',height:'100vh',background:'#0a0a1a',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
      <div style={{width:'100%',maxWidth:'800px',padding:'0 8px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px',padding:'0 4px'}}>
          <a href="/protocol" style={{color:'#2d5a2d',fontSize:'13px',textDecoration:'none'}}>Back to app</a>
          <span style={{color:'#39ff14',fontSize:'13px',fontFamily:'Courier New'}}>TIME DODGE</span>
        </div>
        <iframe
          src="/timedodge.html"
          style={{
            width:'100%',
            height:'80vh',
            border:'1px solid #1a1a1a',
            borderRadius:'8px',
            display:'block',
          }}
        />
        <p style={{color:'#2d5a2d',fontSize:'11px',textAlign:'center',marginTop:'8px',fontFamily:'Courier New'}}>
          Arrow keys or WASD to move — stop moving to freeze time
        </p>
      </div>
    </div>
  )
}`;
fs.writeFileSync('app/game/page.tsx', content, 'utf8');
console.log('Done');
