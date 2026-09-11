const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');

// Fix the percentage text inside the vial
content = content.replace(
  `<text x={W/2} y={bodyY + bodyH * 0.42 + 13} textAnchor='middle' fontSize='7' fontWeight='600' fill='rgba(255,255,255,0.4)' fontFamily='Inter,system-ui,sans-serif'>{Math.round(fill*100)}%</text>`,
  `<text x={W/2} y={bodyY + bodyH * 0.42 + 15} textAnchor='middle' fontSize='11' fontWeight='900' fill='white' fontFamily='Inter,system-ui,sans-serif' opacity='0.95'>{Math.round(fill*100)}%</text>`
);

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes("fontSize='11'") ? 'yes' : 'NO'));
