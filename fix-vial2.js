const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');

// Find where DynamicVial function starts and ends, replace entire function
const startMarker = 'function DynamicVial(';
const endMarker = '}\n\nconst RING_COLORS';
const start = content.indexOf(startMarker);
const end = content.indexOf(endMarker);

if (start === -1 || end === -1) {
  console.log('Markers not found. Start:', start, 'End:', end);
  // Show what is around that area
  const ringIdx = content.indexOf('RING_COLORS');
  console.log('Context around RING_COLORS:', content.slice(Math.max(0, ringIdx-200), ringIdx+50));
  process.exit(1);
}

const newVial = `function DynamicVial({ name, color, fillPct }: { name: string; color: string; fillPct: number }) {
  const short = name.split('/')[0].split('-')[0].split(' ')[0].slice(0, 7)
  const fill = Math.max(0, Math.min(1, fillPct))
  const W = 80
  const H = 160
  const capH = 18
  const neckH = 12
  const neckW = 28
  const bodyX = 10
  const bodyY = capH + neckH
  const bodyW = W - 20
  const bodyH = H - bodyY - 16
  const fillH = bodyH * fill
  const fillY = bodyY + bodyH - fillH
  const id = short.replace(/[^a-z0-9]/gi, '')
  return (
    <svg width={W} height={H} viewBox={\`0 0 \${W} \${H}\`} fill='none' xmlns='http://www.w3.org/2000/svg'>
      <defs>
        <linearGradient id={\`fill-\${id}\`} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor={color} stopOpacity='0.7'/>
          <stop offset='100%' stopColor={color} stopOpacity='0.35'/>
        </linearGradient>
        <clipPath id={\`clip-\${id}\`}>
          <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx='6'/>
        </clipPath>
      </defs>
      <rect x={(W - neckW - 8) / 2} y='2' width={neckW + 8} height={capH} rx='5' fill={color} opacity='0.9'/>
      <rect x={(W - neckW - 8) / 2} y='2' width={neckW + 8} height={capH} rx='5' fill='white' opacity='0.1'/>
      <rect x={(W - neckW) / 2} y={capH} width={neckW} height={neckH + 2} rx='3' fill={color} opacity='0.5'/>
      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx='6' fill='#0d0d1a' stroke={color} strokeWidth='1.2' strokeOpacity='0.5'/>
      {fillH > 0 && (
        <rect x={bodyX} y={fillY} width={bodyW} height={fillH} clipPath={\`url(#clip-\${id})\`} fill={\`url(#fill-\${id})\`}/>
      )}
      {fillH > 2 && (
        <rect x={bodyX + 1} y={fillY} width={bodyW - 2} height='2.5' fill={color} opacity='0.5' clipPath={\`url(#clip-\${id})\`}/>
      )}
      <rect
@'
const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');

// Find where DynamicVial function starts and ends, replace entire function
const startMarker = 'function DynamicVial(';
const endMarker = '}\n\nconst RING_COLORS';
const start = content.indexOf(startMarker);
const end = content.indexOf(endMarker);

if (start === -1 || end === -1) {
  console.log('Markers not found. Start:', start, 'End:', end);
  // Show what is around that area
  const ringIdx = content.indexOf('RING_COLORS');
  console.log('Context around RING_COLORS:', content.slice(Math.max(0, ringIdx-200), ringIdx+50));
  process.exit(1);
}

const newVial = `function DynamicVial({ name, color, fillPct }: { name: string; color: string; fillPct: number }) {
  const short = name.split('/')[0].split('-')[0].split(' ')[0].slice(0, 7)
  const fill = Math.max(0, Math.min(1, fillPct))
  const W = 80
  const H = 160
  const capH = 18
  const neckH = 12
  const neckW = 28
  const bodyX = 10
  const bodyY = capH + neckH
  const bodyW = W - 20
  const bodyH = H - bodyY - 16
  const fillH = bodyH * fill
  const fillY = bodyY + bodyH - fillH
  const id = short.replace(/[^a-z0-9]/gi, '')
  return (
    <svg width={W} height={H} viewBox={\`0 0 \${W} \${H}\`} fill='none' xmlns='http://www.w3.org/2000/svg'>
      <defs>
        <linearGradient id={\`fill-\${id}\`} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor={color} stopOpacity='0.7'/>
          <stop offset='100%' stopColor={color} stopOpacity='0.35'/>
        </linearGradient>
        <clipPath id={\`clip-\${id}\`}>
          <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx='6'/>
        </clipPath>
      </defs>
      <rect x={(W - neckW - 8) / 2} y='2' width={neckW + 8} height={capH} rx='5' fill={color} opacity='0.9'/>
      <rect x={(W - neckW - 8) / 2} y='2' width={neckW + 8} height={capH} rx='5' fill='white' opacity='0.1'/>
      <rect x={(W - neckW) / 2} y={capH} width={neckW} height={neckH + 2} rx='3' fill={color} opacity='0.5'/>
      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx='6' fill='#0d0d1a' stroke={color} strokeWidth='1.2' strokeOpacity='0.5'/>
      {fillH > 0 && (
        <rect x={bodyX} y={fillY} width={bodyW} height={fillH} clipPath={\`url(#clip-\${id})\`} fill={\`url(#fill-\${id})\`}/>
      )}
      {fillH > 2 && (
        <rect x={bodyX + 1} y={fillY} width={bodyW - 2} height='2.5' fill={color} opacity='0.5' clipPath={\`url(#clip-\${id})\`}/>
      )}
      <rect x={bodyX + 3} y={bodyY + 4} width='5' height={bodyH - 12} rx='2.5' fill='white' opacity='0.07'/>
      {[0.25, 0.5, 0.75].map((tick) => (
        <line key={tick} x1={bodyX + bodyW - 2} y1={bodyY + bodyH * (1 - tick)} x2={bodyX + bodyW + 7} y2={bodyY + bodyH * (1 - tick)} stroke={color} strokeWidth='1.5' opacity='0.8'/>
      ))}
      <text x={W / 2} y={bodyY + bodyH * 0.42} textAnchor='middle' fontSize='8' fontWeight='800' fill={color} fontFamily='Inter,system-ui,sans-serif' opacity='0.9'>{short}</text>
      <text x={W / 2} y={bodyY + bodyH * 0.42 + 12} textAnchor='middle' fontSize='7' fontWeight='600' fill='rgba(255,255,255,0.4)' fontFamily='Inter,system-ui,sans-serif'>{Math.round(fill * 100)}%</text>
      <rect x={bodyX + 2} y={bodyY + bodyH - 2} width={bodyW - 4} height='4' rx='2' fill={color} opacity='0.15'/>
    </svg>
  )
}

`;

const newContent = content.slice(0, start) + newVial + content.slice(end + 2);
fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', newContent, 'utf8');
console.log('Done! Vial rewritten. Size:', fs.statSync('components/dashboard/HeroProtocolCard.tsx').size);
