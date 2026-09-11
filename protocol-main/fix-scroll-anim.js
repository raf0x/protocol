const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// Add scroll animation styles and logic after the imports
content = content.replace(
  "export default function Home() {",
  `const scrollAnimStyles = \`
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(40px) blur(8px); }
    to { opacity: 1; transform: translateY(0) blur(0); }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes ringPulse {
    0% { filter: drop-shadow(0 0 0px #39ff14); }
    50% { filter: drop-shadow(0 0 12px #39ff14); }
    100% { filter: drop-shadow(0 0 4px #39ff14); }
  }
  @keyframes checkFlash {
    0% { color: #39ff14; transform: scale(1); }
    50% { color: #fff; transform: scale(1.4); }
    100% { color: #39ff14; transform: scale(1); }
  }
  @keyframes glowBorder {
    from { box-shadow: 0 0 0px rgba(108,99,255,0); border-color: #1e1e2e; }
    to { box-shadow: 0 0 20px rgba(108,99,255,0.3); border-color: rgba(108,99,255,0.5); }
  }
  @keyframes badgeShimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes ctaPulse {
    0%,100% { box-shadow: 0 0 0px rgba(57,255,20,0.4); }
    50% { box-shadow: 0 0 30px rgba(57,255,20,0.6); }
  }
  .scroll-hidden { opacity: 0; transform: translateY(40px); filter: blur(4px); transition: opacity 0.7s ease, transform 0.7s ease, filter 0.7s ease, box-shadow 0.7s ease, border-color 0.7s ease; }
  .scroll-visible { opacity: 1; transform: translateY(0); filter: blur(0); }
  .scroll-visible.glow-card { box-shadow: 0 0 24px rgba(108,99,255,0.25); border-color: rgba(108,99,255,0.4) !important; }
  .stagger-1 { transition-delay: 0.1s; }
  .stagger-2 { transition-delay: 0.25s; }
  .stagger-3 { transition-delay: 0.4s; }
  .stagger-4 { transition-delay: 0.55s; }
  .ring-animate { animation: ringPulse 2s ease-in-out 0.5s 2; }
  .badge-shimmer {
    background: linear-gradient(90deg, rgba(108,99,255,0.2) 0%, rgba(167,139,250,0.5) 50%, rgba(108,99,255,0.2) 100%);
    background-size: 200% auto;
    animation: badgeShimmer 3s linear infinite;
  }
  .cta-pulse { animation: ctaPulse 2s ease-in-out infinite; }
\`;

export default function Home() {`
);

// Add useEffect for IntersectionObserver after the checking state
content = content.replace(
  "  if (checking) return <main style={{minHeight:'100vh',background:'#0a0a0f'}} />",
  `  useEffect(() => {
    if (checking) return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('scroll-visible')
          if (entry.target.classList.contains('glow-card')) {
            entry.target.classList.add('glow-card')
          }
        }
      })
    }, { threshold: 0.15 })
    document.querySelectorAll('.scroll-hidden').forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [checking])

  if (checking) return <main style={{minHeight:'100vh',background:'#0a0a0f'}} />`
);

// Add style tag at top of returned JSX
content = content.replace(
  "    <main style={{minHeight:'100vh',background:'#0a0a0f',color:'white',fontFamily:'Inter,sans-serif',overflowX:'hidden'}}>",
  `    <main style={{minHeight:'100vh',background:'#0a0a0f',color:'white',fontFamily:'Inter,sans-serif',overflowX:'hidden'}}>
      <style dangerouslySetInnerHTML={{__html: scrollAnimStyles}} />`
);

// Add ring-animate class to SVG rings
content = content.replace(
  "          <svg width='500' height='120' viewBox='0 0 500 120' style={{opacity:0.22}}>",
  "          <svg width='500' height='120' viewBox='0 0 500 120' style={{opacity:0.22}} className='ring-animate'>"
);

// Update EARLY ACCESS badge to shimmer
content = content.replace(
  "          <div style={{display:'inline-block',background:'rgba(108,99,255,0.2)',border:'1px solid rgba(108,99,255,0.5)',borderRadius:'24px',padding:'10px 24px',fontSize:'15px',color:'#a78bfa',fontWeight:'800',marginBottom:'28px',letterSpacing:'2px'}}>EARLY ACCESS</div>",
  "          <div className='badge-shimmer' style={{display:'inline-block',border:'1px solid rgba(108,99,255,0.5)',borderRadius:'24px',padding:'10px 24px',fontSize:'15px',color:'#a78bfa',fontWeight:'800',marginBottom:'28px',letterSpacing:'2px'}}>EARLY ACCESS</div>"
);

// Add scroll-hidden to problem section
content = content.replace(
  "      <section style={{padding:'60px 24px',maxWidth:'640px',margin:'0 auto',textAlign:'center'}}>\n        <p style={{fontSize:'13px',color:'#3d3d5c'",
  "      <section style={{padding:'60px 24px',maxWidth:'640px',margin:'0 auto',textAlign:'center'}}>\n        <p className='scroll-hidden' style={{fontSize:'13px',color:'#3d3d5c'"
);
content = content.replace(
  "        <h2 style={{fontSize:'28px',fontWeight:'800',marginBottom:'16px',lineHeight:'1.3'}}>Most health apps weren't built for this.</h2>\n        <p style={{fontSize:'16px',color:'#8b8ba7'",
  "        <h2 className='scroll-hidden stagger-1' style={{fontSize:'28px',fontWeight:'800',marginBottom:'16px',lineHeight:'1.3'}}>Most health apps weren't built for this.</h2>\n        <p className='scroll-hidden stagger-2' style={{fontSize:'16px',color:'#8b8ba7'"
);

// Add scroll-hidden glow-card to feature cards
content = content.replace(
  "          <div style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',padding:'28px'}}>\n            <div style={{fontSize:'28px',marginBottom:'12px'}}>📓</div>",
  "          <div className='scroll-hidden glow-card' style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',padding:'28px'}}>\n            <div style={{fontSize:'28px',marginBottom:'12px'}}>📓</div>"
);
content = content.replace(
  "          <div style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',padding:'28px'}}>\n            <div style={{fontSize:'28px',marginBottom:'12px'}}>⚗️</div>",
  "          <div className='scroll-hidden glow-card stagger-1' style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',padding:'28px'}}>\n            <div style={{fontSize:'28px',marginBottom:'12px'}}>⚗️</div>"
);
content = content.replace(
  "          <div style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',padding:'28px'}}>\n            <div style={{fontSize:'28px',marginBottom:'12px'}}>👥</div>",
  "          <div className='scroll-hidden glow-card stagger-2' style={{background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'12px',padding:'28px'}}>\n            <div style={{fontSize:'28px',marginBottom:'12px'}}>👥</div>"
);

// Add scroll animations to privacy section
content = content.replace(
  "        <h2 style={{fontSize:'28px',fontWeight:'800',marginBottom:'16px'}}>Privacy isn't a feature.<br/>It's the foundation.</h2>",
  "        <h2 className='scroll-hidden' style={{fontSize:'28px',fontWeight:'800',marginBottom:'16px'}}>Privacy isn't a feature.<br/>It's the foundation.</h2>"
);
content = content.replace(
  "        <p style={{fontSize:'16px',color:'#8b8ba7',lineHeight:'1.7',maxWidth:'480px',margin:'0 auto 32px'}}>Your protocols",
  "        <p className='scroll-hidden stagger-1' style={{fontSize:'16px',color:'#8b8ba7',lineHeight:'1.7',maxWidth:'480px',margin:'0 auto 32px'}}>Your protocols"
);

// Add cta-pulse to final CTA button
content = content.replace(
  "        <a href='/auth/login' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'800',padding:'18px 48px',borderRadius:'8px',fontSize:'18px',display:'inline-block'}}>Get started free</a>",
  "        <a href='/auth/login' className='cta-pulse scroll-hidden' style={{background:'#39ff14',color:'#000000',textDecoration:'none',fontWeight:'800',padding:'18px 48px',borderRadius:'8px',fontSize:'18px',display:'inline-block'}}>Get started free</a>"
);

// Add scroll-hidden to final CTA heading
content = content.replace(
  "        <h2 style={{fontSize:'32px',fontWeight:'900',marginBottom:'16px',lineHeight:'1.2'}}>Start tracking what<br/>",
  "        <h2 className='scroll-hidden' style={{fontSize:'32px',fontWeight:'900',marginBottom:'16px',lineHeight:'1.2'}}>Start tracking what<br/>"
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
