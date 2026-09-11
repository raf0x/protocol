const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');

// Fix 1: vial % text - use contrast color based on fill
content = content.replace(
  `<text x={W/2} y={bodyY + bodyH * 0.42 + 16} textAnchor='middle' fontSize='12' fontWeight='900' fill='white' fontFamily='Inter,system-ui,sans-serif'>{Math.round(fill*100)}%</text>`,
  `<text x={W/2} y={bodyY + bodyH * 0.42 + 16} textAnchor='middle' fontSize='12' fontWeight='900' fill={fill > 0.4 ? '#000000' : 'white'} fontFamily='Inter,system-ui,sans-serif'>{Math.round(fill*100)}%</text>`
);

// Fix 2: all the faint rgba white labels inside hero card - make them use proper opacity
content = content.split("color:'rgba(255,255,255,0.3)'").join("color:'rgba(255,255,255,0.6)'");
content = content.split("color:'rgba(255,255,255,0.4)'").join("color:'rgba(255,255,255,0.65)'");
content = content.split("color:'rgba(255,255,255,0.5)'").join("color:'rgba(255,255,255,0.75)'");
content = content.split("strokeOpacity='0.5'").join("strokeOpacity='0.7'");

// Fix 3: progress bar more visible
content = content.replace(
  `background:'rgba(255,255,255,0.08)'`,
  `background:'rgba(255,255,255,0.15)'`
);

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', content, 'utf8');
console.log('Hero card fixed');

// Fix 4: rings more visible in light mode - add box shadow to inactive rings in StatsBar
let statsbar = fs.readFileSync('components/dashboard/StatsBar.tsx', 'utf8');
statsbar = statsbar.replace(
  `background:isActive?rc+'44':cb`,
  `background:isActive?rc+'44':'var(--color-card)'`
);
statsbar = statsbar.replace(
  `boxShadow:isActive?'0 0 18px '+rc+', 0 0 6px '+rc:'none'`,
  `boxShadow:isActive?'0 0 18px '+rc+', 0 0 6px '+rc:'0 2px 8px rgba(0,0,0,0.1)'`
);
fs.writeFileSync('components/dashboard/StatsBar.tsx', statsbar, 'utf8');
console.log('StatsBar rings fixed');
