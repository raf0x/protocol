const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// Remove the Background rings block entirely
const ringsBlock = `        {/* Background rings */}
        <div style={{position:'absolute',left:0,right:0,top:'130px',display:'flex',justifyContent:'center',pointerEvents:'none',zIndex:0}}>
          <svg width='500' height='120' viewBox='0 0 500 120' style={{opacity:0.22}} className='ring-animate'>
            <g transform='translate(120, 60)'>
              <circle cx='0' cy='0' r='30' fill='none' stroke='#1e1e2e' strokeWidth='5'/>
              <circle cx='0' cy='0' r='30' fill='none' stroke='#f59e0b' strokeWidth='5' strokeDasharray='188' strokeDashoffset='47' strokeLinecap='round' transform='rotate(-90)'/>
              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='10' fontWeight='800'>3.8</text>
              <text x='0' y='10' textAnchor='middle' dominantBaseline='middle' fill='#f59e0b' fontSize='7' fontWeight='600'>ENERGY</text>
            </g>
            <g transform='translate(250, 60)'>
              <circle cx='0' cy='0' r='34' fill='none' stroke='#1e1e2e' strokeWidth='5'/>
              <circle cx='0' cy='0' r='34' fill='none' stroke='#8b5cf6' strokeWidth='5' strokeDasharray='214' strokeDashoffset='60' strokeLinecap='round' transform='rotate(-90)'/>
              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='11' fontWeight='800'>7.5h</text>
              <text x='0' y='11' textAnchor='middle' dominantBaseline='middle' fill='#8b5cf6' fontSize='7' fontWeight='600'>SLEEP</text>
            </g>
            <g transform='translate(380, 60)'>
              <circle cx='0' cy='0' r='30' fill='none' stroke='#1e1e2e' strokeWidth='5'/>
              <circle cx='0' cy='0' r='30' fill='none' stroke='#39ff14' strokeWidth='5' strokeDasharray='188' strokeDashoffset='27' strokeLinecap='round' transform='rotate(-90)'/>
              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='10' fontWeight='800'>6/7</text>
              <text x='0' y='10' textAnchor='middle' dominantBaseline='middle' fill='#39ff14' fontSize='7' fontWeight='600'>STREAK</text>
            </g>
          </svg>
        </div>

`;

content = content.replace(ringsBlock, '');

// Reduce the EARLY ACCESS badge bottom margin from 80px to 28px (original) to close the gap
content = content.replace(
  "padding:'10px 24px',fontSize:'15px',color:'#a78bfa',fontWeight:'800',marginBottom:'80px'",
  "padding:'10px 24px',fontSize:'15px',color:'#a78bfa',fontWeight:'800',marginBottom:'28px'"
);

// Reduce hero section top padding to tighten things
content = content.replace(
  "      <section style={{padding:'80px 24px 60px',maxWidth:'640px',margin:'0 auto',textAlign:'center',position:'relative',overflow:'hidden'}}>",
  "      <section style={{padding:'60px 24px 40px',maxWidth:'640px',margin:'0 auto',textAlign:'center',position:'relative',overflow:'hidden'}}>"
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
