const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

const decorative = `
        {/* Left syringe */}
        <div style={{position:'absolute',left:'-10px',top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',opacity:0.5}}>
          <span style={{fontSize:'36px',transform:'rotate(45deg)',display:'block'}}>💉</span>
          <span style={{fontSize:'11px',color:'#39ff14',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed'}}>BPC-157</span>
        </div>

        {/* Right syringe */}
        <div style={{position:'absolute',right:'-10px',top:'50%',transform:'translateY(-50%)',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px',opacity:0.5}}>
          <span style={{fontSize:'36px',transform:'rotate(-45deg)',display:'block'}}>💉</span>
          <span style={{fontSize:'11px',color:'#6c63ff',fontWeight:'700',letterSpacing:'1px',writingMode:'vertical-rl',textOrientation:'mixed'}}>GLP-1</span>
        </div>

        {/* Background rings */}
        <div style={{position:'absolute',inset:0,display:'flex',justifyContent:'center',alignItems:'center',pointerEvents:'none',zIndex:0}}>
          <svg width="600" height="400" viewBox="0 0 600 400" style={{opacity:0.18}}>
            {/* Mood ring - blue */}
            <g transform="translate(120, 120)">
              <circle cx="0" cy="0" r="55" fill="none" stroke="#1e1e2e" strokeWidth="7"/>
              <circle cx="0" cy="0" r="55" fill="none" stroke="#6c63ff" strokeWidth="7" strokeDasharray="345" strokeDashoffset="69" strokeLinecap="round" transform="rotate(-90)"/>
              <text x="0" y="0" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="16" fontWeight="800">4.6</text>
              <text x="0" y="18" textAnchor="middle" dominantBaseline="middle" fill="#6c63ff" fontSize="9" fontWeight="600">MOOD</text>
            </g>
            {/* Energy ring - amber */}
            <g transform="translate(260, 80)">
              <circle cx="0" cy="0" r="45" fill="none" stroke="#1e1e2e" strokeWidth="6"/>
              <circle cx="0" cy="0" r="45" fill="none" stroke="#f59e0b" strokeWidth="6" strokeDasharray="283" strokeDashoffset="71" strokeLinecap="round" transform="rotate(-90)"/>
              <text x="0" y="0" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="13" fontWeight="800">3.8</text>
              <text x="0" y="15" textAnchor="middle" dominantBaseline="middle" fill="#f59e0b" fontSize="8" fontWeight="600">ENERGY</text>
            </g>
            {/* Sleep ring - purple */}
            <g transform="translate(420, 130)">
              <circle cx="0" cy="0" r="50" fill="none" stroke="#1e1e2e" strokeWidth="6"/>
              <circle cx="0" cy="0" r="50" fill="none" stroke="#8b5cf6" strokeWidth="6" strokeDasharray="314" strokeDashoffset="88" strokeLinecap="round" transform="rotate(-90)"/>
              <text x="0" y="0" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="14" fontWeight="800">7.5h</text>
              <text x="0" y="16" textAnchor="middle" dominantBaseline="middle" fill="#8b5cf6" fontSize="8" fontWeight="600">SLEEP</text>
            </g>
            {/* Days ring - green */}
            <g transform="translate(200, 280)">
              <circle cx="0" cy="0" r="42" fill="none" stroke="#1e1e2e" strokeWidth="6"/>
              <circle cx="0" cy="0" r="42" fill="none" stroke="#39ff14" strokeWidth="6" strokeDasharray="264" strokeDashoffset="38" strokeLinecap="round" transform="rotate(-90)"/>
              <text x="0" y="0" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="13" fontWeight="800">6/7</text>
              <text x="0" y="14" textAnchor="middle" dominantBaseline="middle" fill="#39ff14" fontSize="8" fontWeight="600">STREAK</text>
            </g>
            {/* Small accent ring */}
            <g transform="translate(380, 290)">
              <circle cx="0" cy="0" r="28" fill="none" stroke="#1e1e2e" strokeWidth="5"/>
              <circle cx="0" cy="0" r="28" fill="none" stroke="#6c63ff" strokeWidth="5" strokeDasharray="176" strokeDashoffset="53" strokeLinecap="round" transform="rotate(-90)"/>
              <text x="0" y="0" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="10" fontWeight="800">4.2</text>
              <text x="0" y="12" textAnchor="middle" dominantBaseline="middle" fill="#6c63ff" fontSize="7" fontWeight="600">AVG</text>
            </g>
          </svg>
        </div>`;

content = content.replace(
  "      {/* Hero */}\n      <section style={{padding:'80px 24px 60px',maxWidth:'640px',margin:'0 auto',textAlign:'center',position:'relative'}}>",
  "      {/* Hero */}\n      <section style={{padding:'80px 24px 60px',maxWidth:'640px',margin:'0 auto',textAlign:'center',position:'relative',overflow:'hidden'}}>\n" + decorative
);

// Make hero text sit above the rings
content = content.replace(
  "        <div style={{display:'inline-block',background:'rgba(108,99,255,0.15)'",
  "        <div style={{position:'relative',zIndex:1}}>\n        <div style={{display:'inline-block',background:'rgba(108,99,255,0.15)'"
);

content = content.replace(
  "        <a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'800',padding:'16px 36px',borderRadius:'8px',fontSize:'16px',letterSpacing:'0.5px'}}>Get early access</a>\n          <a href='/calculator' style={{background:'transparent',color:'#8b8ba7',textDecoration:'none',fontWeight:'600',padding:'16px 24px',borderRadius:'8px',fontSize:'16px',border:'1px solid #1e1e2e'}}>Try the calculator →</a>\n        </div>\n      </section>",
  "        <a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'800',padding:'16px 36px',borderRadius:'8px',fontSize:'16px',letterSpacing:'0.5px'}}>Get early access</a>\n          <a href='/calculator' style={{background:'transparent',color:'#8b8ba7',textDecoration:'none',fontWeight:'600',padding:'16px 24px',borderRadius:'8px',fontSize:'16px',border:'1px solid #1e1e2e'}}>Try the calculator →</a>\n        </div>\n        </div>\n      </section>"
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
