const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// Add syringe fill animation to existing CSS block
content = content.replace(
  `@keyframes ctaPulse {
    0%,100% { box-shadow: 0 0 0px rgba(57,255,20,0.4); }
    50% { box-shadow: 0 0 30px rgba(57,255,20,0.6); }
  }`,
  `@keyframes ctaPulse {
    0%,100% { box-shadow: 0 0 0px rgba(57,255,20,0.4); }
    50% { box-shadow: 0 0 30px rgba(57,255,20,0.6); }
  }
  @keyframes syringeFill {
    0%     { clip-path: inset(0 100% 0 0); }
    55%    { clip-path: inset(0 0% 0 0); }
    80%    { clip-path: inset(0 0% 0 0); }
    100%   { clip-path: inset(0 100% 0 0); }
  }
  @keyframes syringeFloat {
    0%,100% { transform: translateY(-50%) rotate(170deg) translateX(0px); }
    55%     { transform: translateY(-50%) rotate(170deg) translateX(12px); }
    80%     { transform: translateY(-50%) rotate(170deg) translateX(12px); }
  }`
);

// Replace hero h1 with animated version
content = content.replace(
  `<h1 style={{fontSize:'clamp(36px,8vw,64px)',fontWeight:'900',lineHeight:'1.1',marginBottom:'20px',letterSpacing:'-1px'}}>Stop guessing your protocol.<br/><span style={{color:'#39ff14'}}>Start knowing what works.</span></h1>`,
  `<div style={{position:'relative',marginBottom:'24px',display:'inline-block'}}>
            <span style={{position:'absolute',left:'-32px',top:'50%',fontSize:'clamp(28px,6vw,44px)',animation:'syringeFloat 4s ease-in-out infinite',display:'block',lineHeight:1}}>??</span>
            <h1 style={{fontSize:'clamp(48px,13vw,88px)',fontWeight:'900',lineHeight:'1',letterSpacing:'-3px',WebkitTextStroke:'2px #39ff14',color:'transparent',margin:0,display:'block',userSelect:'none'}}>Protocol</h1>
            <h1 aria-hidden='true' style={{fontSize:'clamp(48px,13vw,88px)',fontWeight:'900',lineHeight:'1',letterSpacing:'-3px',color:'#39ff14',position:'absolute',top:0,left:0,right:0,margin:0,display:'block',animation:'syringeFill 4s ease-in-out infinite',clipPath:'inset(0 100% 0 0)',textShadow:'0 0 30px rgba(57,255,20,0.5)'}}>Protocol</h1>
          </div>
          <p style={{fontSize:'clamp(16px,4vw,22px)',fontWeight:'700',color:'white',marginBottom:'12px',lineHeight:'1.3'}}>Stop guessing your protocol.</p>
          <p style={{fontSize:'clamp(16px,4vw,22px)',fontWeight:'700',color:'#39ff14',marginBottom:'20px',lineHeight:'1.3'}}>Start knowing what works.</p>`
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done! Syringe animation added.');
