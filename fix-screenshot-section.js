const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

const screenshotSection = `      {/* Product screenshot */}
      <section style={{padding:'20px 24px 60px',maxWidth:'480px',margin:'0 auto',textAlign:'center'}}>
        <p className='scroll-hidden' style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'20px'}}>SEE YOUR PROGRESS</p>
        <div className='scroll-hidden stagger-1' style={{borderRadius:'24px',overflow:'hidden',border:'1px solid #1e1e2e',boxShadow:'0 20px 60px rgba(108,99,255,0.15)',background:'#12121a'}}>
          <img src='/journal-screenshot.png' alt='Protocol Journal showing weight tracking, mood/energy/sleep charts, and weekly stats' style={{width:'100%',display:'block'}} />
        </div>
        <p className='scroll-hidden stagger-2' style={{fontSize:'14px',color:'#8b8ba7',marginTop:'16px',lineHeight:'1.6'}}>Real data. Real trends. Real insights.</p>
      </section>

`;

// Insert after the hero section closes and before the problem section
content = content.replace(
  `      </section>

      {/* Problem */}`,
  `      </section>

${screenshotSection}      {/* Problem */}`
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
