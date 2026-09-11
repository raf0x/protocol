const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');
const lines = content.split('\n');

lines[68] = `      <text x={W/2} y={bodyY + bodyH * 0.42 + 16} textAnchor='middle' fontSize='12' fontWeight='900' fill='white' fontFamily='Inter,system-ui,sans-serif'>{Math.round(fill*100)}%</text>`;

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', lines.join('\n'), 'utf8');
console.log('Done!');
