const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// Replace left syringe with scrolling ticker
content = content.replace(
  `        {/* Left syringe */}
        <div style={{position:'absolute',left:'-10px',top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',opacity:0.5}}>
          <span style={{fontSize:'36px',transform:'rotate(135deg)',display:'block'}}>💉</span>
          <span style={{fontSize:'11px',color:'#39ff14',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed'}}>BPC-157</span>
        </div>`,
  `        {/* Left ticker */}
        <div style={{position:'absolute',left:'0px',top:'0',bottom:'0',width:'60px',overflow:'hidden',opacity:0.4,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <style>{'@keyframes tickerDown{0%{transform:translateY(-50%)}100%{transform:translateY(0%)}}'}</style>
          <div style={{animation:'tickerDown 8s linear infinite',display:'flex',flexDirection:'column',gap:'20px',alignItems:'center'}}>
            {['BPC-157','TB-500','CJC-1295','AOD-9604','GHK-Cu','Ipamorelin','BPC-157','TB-500','CJC-1295','AOD-9604','GHK-Cu','Ipamorelin'].map((name,i) => (
              <span key={i} style={{fontSize:'10px',color:'#39ff14',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed',whiteSpace:'nowrap'}}>{name}</span>
            ))}
          </div>
        </div>`
);

// Replace right syringe with scrolling ticker
content = content.replace(
  `        {/* Right syringe */}
        <div style={{position:'absolute',right:'-10px',top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',opacity:0.5}}>
          <span style={{fontSize:'36px',transform:'rotate(135deg)',display:'block'}}>💉</span>
          <span style={{fontSize:'11px',color:'#39ff14',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed'}}>GLP-1</span>
        </div>`,
  `        {/* Right ticker */}
        <div style={{position:'absolute',right:'0px',top:'0',bottom:'0',width:'60px',overflow:'hidden',opacity:0.4,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <style>{'@keyframes tickerDown2{0%{transform:translateY(-50%)}100%{transform:translateY(0%)}}'}</style>
          <div style={{animation:'tickerDown2 10s linear infinite',display:'flex',flexDirection:'column',gap:'20px',alignItems:'center'}}>
            {['GLP-1','Tirzepatide','Semaglutide','Retatrutide','TRT','HCG','GLP-1','Tirzepatide','Semaglutide','Retatrutide','TRT','HCG'].map((name,i) => (
              <span key={i} style={{fontSize:'10px',color:'#39ff14',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed',whiteSpace:'nowrap'}}>{name}</span>
            ))}
          </div>
        </div>`
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
