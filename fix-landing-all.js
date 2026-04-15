const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// 1. Remove mood (blue) and avg (small purple) rings - keep energy, sleep, streak only
// Reposition 3 rings centered horizontally
content = content.replace(
  "            <g transform='translate(50, 60)'>\n              <circle cx='0' cy='0' r='32' fill='none' stroke='#1e1e2e' strokeWidth='5'/>\n              <circle cx='0' cy='0' r='32' fill='none' stroke='#6c63ff' strokeWidth='5' strokeDasharray='201' strokeDashoffset='40' strokeLinecap='round' transform='rotate(-90)'/>\n              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='11' fontWeight='800'>4.6</text>\n              <text x='0' y='11' textAnchor='middle' dominantBaseline='middle' fill='#6c63ff' fontSize='7' fontWeight='600'>MOOD</text>\n            </g>\n            <g transform='translate(140, 60)'>\n              <circle cx='0' cy='0' r='30' fill='none' stroke='#1e1e2e' strokeWidth='5'/>\n              <circle cx='0' cy='0' r='30' fill='none' stroke='#f59e0b' strokeWidth='5' strokeDasharray='188' strokeDashoffset='47' strokeLinecap='round' transform='rotate(-90)'/>\n              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='10' fontWeight='800'>3.8</text>\n              <text x='0' y='10' textAnchor='middle' dominantBaseline='middle' fill='#f59e0b' fontSize='7' fontWeight='600'>ENERGY</text>\n            </g>\n            <g transform='translate(250, 60)'>\n              <circle cx='0' cy='0' r='34' fill='none' stroke='#1e1e2e' strokeWidth='5'/>\n              <circle cx='0' cy='0' r='34' fill='none' stroke='#8b5cf6' strokeWidth='5' strokeDasharray='214' strokeDashoffset='60' strokeLinecap='round' transform='rotate(-90)'/>\n              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='11' fontWeight='800'>7.5h</text>\n              <text x='0' y='11' textAnchor='middle' dominantBaseline='middle' fill='#8b5cf6' fontSize='7' fontWeight='600'>SLEEP</text>\n            </g>\n            <g transform='translate(360, 60)'>\n              <circle cx='0' cy='0' r='30' fill='none' stroke='#1e1e2e' strokeWidth='5'/>\n              <circle cx='0' cy='0' r='30' fill='none' stroke='#39ff14' strokeWidth='5' strokeDasharray='188' strokeDashoffset='27' strokeLinecap='round' transform='rotate(-90)'/>\n              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='10' fontWeight='800'>6/7</text>\n              <text x='0' y='10' textAnchor='middle' dominantBaseline='middle' fill='#39ff14' fontSize='7' fontWeight='600'>STREAK</text>\n            </g>\n            <g transform='translate(450, 60)'>\n              <circle cx='0' cy='0' r='28' fill='none' stroke='#1e1e2e' strokeWidth='4'/>\n              <circle cx='0' cy='0' r='28' fill='none' stroke='#6c63ff' strokeWidth='4' strokeDasharray='176' strokeDashoffset='53' strokeLinecap='round' transform='rotate(-90)'/>\n              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='9' fontWeight='800'>4.2</text>\n              <text x='0' y='10' textAnchor='middle' dominantBaseline='middle' fill='#6c63ff' fontSize='6' fontWeight='600'>AVG</text>\n            </g>",
  "            <g transform='translate(120, 60)'>\n              <circle cx='0' cy='0' r='30' fill='none' stroke='#1e1e2e' strokeWidth='5'/>\n              <circle cx='0' cy='0' r='30' fill='none' stroke='#f59e0b' strokeWidth='5' strokeDasharray='188' strokeDashoffset='47' strokeLinecap='round' transform='rotate(-90)'/>\n              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='10' fontWeight='800'>3.8</text>\n              <text x='0' y='10' textAnchor='middle' dominantBaseline='middle' fill='#f59e0b' fontSize='7' fontWeight='600'>ENERGY</text>\n            </g>\n            <g transform='translate(250, 60)'>\n              <circle cx='0' cy='0' r='34' fill='none' stroke='#1e1e2e' strokeWidth='5'/>\n              <circle cx='0' cy='0' r='34' fill='none' stroke='#8b5cf6' strokeWidth='5' strokeDasharray='214' strokeDashoffset='60' strokeLinecap='round' transform='rotate(-90)'/>\n              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='11' fontWeight='800'>7.5h</text>\n              <text x='0' y='11' textAnchor='middle' dominantBaseline='middle' fill='#8b5cf6' fontSize='7' fontWeight='600'>SLEEP</text>\n            </g>\n            <g transform='translate(380, 60)'>\n              <circle cx='0' cy='0' r='30' fill='none' stroke='#1e1e2e' strokeWidth='5'/>\n              <circle cx='0' cy='0' r='30' fill='none' stroke='#39ff14' strokeWidth='5' strokeDasharray='188' strokeDashoffset='27' strokeLinecap='round' transform='rotate(-90)'/>\n              <text x='0' y='-2' textAnchor='middle' dominantBaseline='middle' fill='white' fontSize='10' fontWeight='800'>6/7</text>\n              <text x='0' y='10' textAnchor='middle' dominantBaseline='middle' fill='#39ff14' fontSize='7' fontWeight='600'>STREAK</text>\n            </g>"
);

// 2. Move EARLY ACCESS badge higher - add more margin bottom
content = content.replace(
  "padding:'10px 24px',fontSize:'15px',color:'#a78bfa',fontWeight:'800',marginBottom:'28px'",
  "padding:'10px 24px',fontSize:'15px',color:'#a78bfa',fontWeight:'800',marginBottom:'80px'"
);

// 3 & 4. Narrow tickers so they don't touch text - reduce width and push further to edges
content = content.replace(
  "        <div style={{position:'absolute',left:'0px',top:'0',bottom:'0',width:'60px'",
  "        <div style={{position:'absolute',left:'0px',top:'0',bottom:'0',width:'44px'"
);
content = content.replace(
  "        <div style={{position:'absolute',right:'0px',top:'0',bottom:'0',width:'60px'",
  "        <div style={{position:'absolute',right:'0px',top:'0',bottom:'0',width:'44px'"
);

// Also add padding to hero content to keep text away from tickers
content = content.replace(
  "        <div style={{position:'relative',zIndex:1}}>",
  "        <div style={{position:'relative',zIndex:1,padding:'0 52px'}}>"
);

// 5. Fix syringe emoji - use unicode instead of emoji which may not render
// The syringe is already added - check if it's appearing by making it larger
content = content.replace(
  "            <span style={{fontSize:'20px',transform:'rotate(135deg)',display:'block',marginBottom:'4px'}}>💉</span>\n            {['BPC-157'",
  "            <span style={{fontSize:'22px',display:'block',marginBottom:'8px',transform:'rotate(180deg)'}}>💉</span>\n            {['BPC-157'"
);
content = content.replace(
  "            <span style={{fontSize:'20px',transform:'rotate(135deg)',display:'block',marginBottom:'4px'}}>💉</span>\n            {['GLP-1'",
  "            <span style={{fontSize:'22px',display:'block',marginBottom:'8px',transform:'rotate(180deg)'}}>💉</span>\n            {['GLP-1'"
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
