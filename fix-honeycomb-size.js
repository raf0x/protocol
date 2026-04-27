const fs = require('fs');
let content = fs.readFileSync('components/PeptideHoneycomb.tsx', 'utf8');

content = content.replace(
  `<svg width='100%' viewBox={'0 0 ' + svgW + ' ' + svgH} style={{display:'block',margin:'0 auto'}}>`,
  `<svg width='100%' viewBox={'0 0 ' + svgW + ' ' + svgH} style={{display:'block',margin:'0 auto',maxWidth: svgW + 'px'}}>`
);

content = content.replace(
  `<div style={{minWidth: svgW + 'px', maxWidth:'100%'}}>`,
  `<div style={{minWidth: Math.min(svgW, 420) + 'px', maxWidth: svgW + 'px', margin:'0 auto'}}>`
);

fs.writeFileSync('components/PeptideHoneycomb.tsx', content, 'utf8');
console.log('Done!');
