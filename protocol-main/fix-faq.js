const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

const faqSection = `      {/* FAQ */}
      <section style={{padding:'60px 24px',maxWidth:'640px',margin:'0 auto'}}>
        <p className='scroll-hidden' style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'24px',textAlign:'center'}}>QUESTIONS</p>
        {[
          { q: 'Is this medical advice?', a: 'No. Protocol is a personal tracking tool. It does not recommend doses, suggest compounds, or provide medical guidance. Always consult a qualified healthcare provider.' },
          { q: 'Is my data private?', a: 'Yes. Your protocols, journal entries, and health data are visible only to you. We never sell, share, or use your data for advertising. Period.' },
          { q: 'What can I track?', a: 'Compounds with dose phases, injection schedules, mood, energy, sleep, hunger, weight, and discomfort. The app shows insights and trends over time.' },
          { q: 'Does it work on iPhone?', a: 'Yes. Protocol is a Progressive Web App — add it to your home screen from Safari and it works like a native app. No App Store needed.' },
          { q: 'Is it free?', a: 'Free during early access. No credit card required.' },
        ].map((item, i) => (
          <div key={i} className={'scroll-hidden stagger-' + Math.min(i + 1, 4)} style={{borderBottom:'1px solid #1e1e2e',padding:'16px 0'}}>
            <h3 style={{fontSize:'15px',fontWeight:'700',color:'white',marginBottom:'8px'}}>{item.q}</h3>
            <p style={{fontSize:'14px',color:'#8b8ba7',lineHeight:'1.6',margin:0}}>{item.a}</p>
          </div>
        ))}
      </section>

`;

// Insert before the Final CTA
content = content.replace(
  "      {/* Final CTA */}",
  faqSection + "      {/* Final CTA */}"
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
