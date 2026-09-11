const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// Replace the hero section opening with one that has decorative background elements
content = content.replace(
  "      {/* Hero */}\n      <section style={{padding:'80px 24px 60px',maxWidth:'640px',margin:'0 auto',textAlign:'center'}}>",
  `      {/* Hero */}
      <section style={{padding:'80px 24px 60px',maxWidth:'640px',margin:'0 auto',textAlign:'center',position:'relative'}}>
        {/* Decorative background rings */}
        <svg style={{position:'absolute',top:'-40px',right:'-60px',opacity:0.07,pointerEvents:'none'}} width="320" height="320" viewBox="0 0 320 320">
          <circle cx="160" cy="160" r="120" fill="none" stroke="#39ff14" strokeWidth="6" strokeDasharray="754" strokeDashoffset="188" strokeLinecap="round" transform="rotate(-90 160 160)" />
          <circle cx="160" cy="160" r="90" fill="none" stroke="#6c63ff" strokeWidth="4" strokeDasharray="565" strokeDashoffset="170" strokeLinecap="round" transform="rotate(-90 160 160)" />
          <circle cx="160" cy="160" r="60" fill="none" stroke="#39ff14" strokeWidth="3" strokeDasharray="377" strokeDashoffset="94" strokeLinecap="round" transform="rotate(-90 160 160)" />
        </svg>
        <svg style={{position:'absolute',bottom:'-20px',left:'-40px',opacity:0.06,pointerEvents:'none'}} width="240" height="240" viewBox="0 0 240 240">
          <circle cx="120" cy="120" r="100" fill="none" stroke="#6c63ff" strokeWidth="5" strokeDasharray="628" strokeDashoffset="200" strokeLinecap="round" transform="rotate(-90 120 120)" />
          <circle cx="120" cy="120" r="70" fill="none" stroke="#39ff14" strokeWidth="3" strokeDasharray="440" strokeDashoffset="110" strokeLinecap="round" transform="rotate(-90 120 120)" />
        </svg>
        {/* Ghost chart line */}
        <svg style={{position:'absolute',top:'30px',left:'-20px',opacity:0.05,pointerEvents:'none',width:'100%'}} height="120" viewBox="0 0 640 120" preserveAspectRatio="none">
          <polyline points="0,90 80,70 160,80 240,45 320,55 400,30 480,40 560,20 640,25" fill="none" stroke="#39ff14" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="0,100 80,85 160,90 240,65 320,72 400,50 480,58 560,40 640,45" fill="none" stroke="#6c63ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>`
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
