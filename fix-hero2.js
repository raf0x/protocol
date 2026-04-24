const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

const oldHero = `<div style={{position:'relative',marginBottom:'24px',display:'inline-block'}}>
            <span style={{position:'absolute',left:'-32px',top:'50%',fontSize:'clamp(28px,6vw,44px)',animation:'syringeFloat 4s ease-in-out infinite',display:'block',lineHeight:1}}>??</span>
            <h1 style={{fontSize:'clamp(48px,13vw,88px)',fontWeight:'900',lineHeight:'1',letterSpacing:'-3px',WebkitTextStroke:'2px #39ff14',color:'transparent',margin:0,display:'block',userSelect:'none'}}>Protocol</h1>
            <h1 aria-hidden='true' style={{fontSize:'clamp(48px,13vw,88px)',fontWeight:'900',lineHeight:'1',letterSpacing:'-3px',color:'#39ff14',position:'absolute',top:0,left:0,right:0,margin:0,display:'block',animation:'syringeFill 4s ease-in-out infinite',clipPath:'inset(0 100% 0 0)',textShadow:'0 0 30px rgba(57,255,20,0.5)'}}>Protocol</h1>
          </div>
          <p style={{fontSize:'clamp(16px,4vw,22px)',fontWeight:'700',color:'white',marginBottom:'12px',lineHeight:'1.3'}}>Stop guessing your protocol.</p>
          <p style={{fontSize:'clamp(16px,4vw,22px)',fontWeight:'700',color:'#39ff14',marginBottom:'20px',lineHeight:'1.3'}}>Start knowing what works.</p>`;

const newHero = `<div style={{marginBottom:'28px'}}>
            <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',gap:'0px',position:'relative'}}>
              <span style={{fontSize:'clamp(32px,7vw,52px)',display:'block',lineHeight:1,marginRight:'8px',animation:'syringeFloat 4s ease-in-out infinite',flexShrink:0}}>??</span>
              <div style={{position:'relative',display:'inline-block'}}>
                <h1 style={{fontSize:'clamp(52px,14vw,96px)',fontWeight:'900',lineHeight:'1',letterSpacing:'-3px',WebkitTextStroke:'2px #39ff14',color:'transparent',margin:0,display:'block',userSelect:'none',whiteSpace:'nowrap'}}>Protocol</h1>
                <h1 aria-hidden='true' style={{fontSize:'clamp(52px,14vw,96px)',fontWeight:'900',lineHeight:'1',letterSpacing:'-3px',color:'#39ff14',position:'absolute',top:0,left:0,margin:0,display:'block',animation:'syringeFill 4s ease-in-out infinite',clipPath:'inset(0 100% 0 0)',textShadow:'0 0 40px rgba(57,255,20,0.6)',whiteSpace:'nowrap'}}>Protocol</h1>
              </div>
            </div>
          </div>
          <p style={{fontSize:'clamp(16px,4vw,22px)',fontWeight:'700',color:'white',marginBottom:'10px',lineHeight:'1.3'}}>Stop guessing your protocol.</p>
          <p style={{fontSize:'clamp(16px,4vw,22px)',fontWeight:'700',color:'#39ff14',marginBottom:'20px',lineHeight:'1.3'}}>Start knowing what works.</p>`;

if (content.includes(oldHero)) {
  content = content.replace(oldHero, newHero);
  fs.writeFileSync('app/page.tsx', content, 'utf8');
  console.log('Done!');
} else {
  console.log('NOT FOUND');
}
