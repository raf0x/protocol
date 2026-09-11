const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');

const oldVial = `function DynamicVial({ name, color, fillPct }: { name: string; color: string; fillPct: number }) {
  const short = name.split('/')[0].split(' ')[0].slice(0, 8)
  const bodyTop = 18
  const bodyH = 62
  const fill = Math.max(0, Math.min(1, fillPct))
  const fillH = bodyH * fill
  const fillY = bodyTop + bodyH - fillH
  return (
    <svg width='72' height='110' viewBox='0 0 64 110' fill='none' xmlns='http://www.w3.org/2000/svg'>
      <rect x='20' y='0' width='24' height='14' rx='4' fill={color} opacity='0.9'/>
      <rect x='24' y='12' width='16' height='6' rx='2' fill={color} opacity='0.7'/>
      <rect x='12' y={bodyTop} width='40' height={bodyH} rx='8' fill='#1a1a2e' stroke={color} strokeWidth='1.5'/>
      {fillH > 0 && (
        <rect x='13.5' y={fillY} width='37' height={fillH} rx={fillH >= bodyH ? '6' : '0 0 6 6'} fill={color} opacity='0.35'/>
      )}
      <rect x='13.5' y={fillY} width='37' height='3' fill={color} opacity={fill > 0.05 ? 0.6 : 0}/>
      <rect x='16' y={bodyTop + 2} width='6' height='28' rx='3' fill='white' opacity='0.12'/>
      <text x='32' y='54' textAnchor='middle' fontSize='7' fontWeight='800' fill={color} fontFamily='Inter,sans-serif'>{short}</text>
      <rect x='12' y={bodyTop + bodyH - 4} width='40' height='4' rx='2' fill={color} opacity='0.2'/>
      {[0.25, 0.5, 0.75].map((tick) => (
        <line key={tick} x1='43' y1={bodyTop + bodyH * (1 - tick)} x2='51' y2={bodyTop + bodyH * (1 - tick)} stroke={color} strokeWidth='1.2' opacity='0.7'/>
      ))}
    </svg>
  )
}`;

const newVial = `function DynamicVial({ name, color, fillPct }: { name: string; color: string; fillPct: number }) {
  const short = name.split('/')[0].split('-')[0].split(' ')[0].slice(0, 7)
  const fill = Math.max(0, Math.min(1, fillPct))
  // Vial geometry
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
  return (
    <svg width={W} height={H} viewBox={\`0 0 \${W} \${H}\`} fill='none' xmlns='http://www.w3.org/2000/svg'>
      <defs>
        <linearGradient id={\`vg-\${short}\`} x1='0' y1='0' x2='1' y2='0'>
          <stop offset='0%' stopColor={color} stopOpacity='0.25'/>
          <stop offset='100%' stopColor={color} stopOpacity='0.08'/>
        </linearGradient>
        <linearGradient id={\`fill-\${short}\`} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor={color} stopOpacity='0.7'/>
          <stop offset='100%' stopColor={color} stopOpacity='0.4'/>
        </linearGradient>
        <clipPath id={\`clip-\${short}\`}>
          <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx='6'/>
        </clipPath>
      </defs>

      {/* Cap */}
      <rect x={(W - neckW - 8) / 2} y='2' width={neckW + 8} height={capH} rx='5' fill={color} opacity='0.9'/>
      <rect x={(W - neckW - 8) / 2} y='2' width={neckW + 8} height={capH} rx='5' fill='white' opacity='0.1'/>

      {/* Neck */}
      <rect x={(W - neckW) / 2} y={capH} width={neckW} height={neckH + 2} rx='3' fill={color} opacity='0.5'/>

      {/* Body background */}
      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx='6' fill='#0d0d1a' stroke={color} strokeWidth='1.2' strokeOpacity='0.5'/>

      {/* Liquid fill */}
      {fillH > 0 && (
        <rect x={bodyX} y={fillY} width={bodyW} height={fillH} clipPath={\`url(#clip-\${short})\`} fill={\`url(#fill-\${short})\`}/>
      )}

      {/* Liquid surface shimmer */}
      {fillH > 2 && (
        <rect x={bodyX + 1} y={fillY} width={bodyW - 2} height='2.5' fill={color} opacity='0.5' clipPath={\`url(#clip-\${short})\`}/>
      )}

      {/* Glass shine - left edge */}
      <rect x={bodyX + 3} y={bodyY + 4} width='5' height={bodyH - 12} rx='2.5' fill='white' opacity='0.07'/>

      {/* Tick marks */}
      {[0.25, 0.5, 0.75].map((tick) => {
        const ty = bodyY + bodyH * (1 - tick)
        return (
          <g key={tick}>
            <line x1={bodyX + bodyW - 2} y1={ty} x2={bodyX + bodyW + 7} y2={ty} stroke={color} strokeWidth='1.5' opacity='0.8'/>
          </g>
        )
      })}

      {/* Label */}
      <text x={W / 2} y={bodyY + bodyH * 0.42} textAnchor='middle' fontSize='8' fontWeight='800' fill={color} fontFamily='Inter,system-ui,sans-serif' opacity='0.9'>{short}</text>

      {/* Fill % label */}
      <text x={W / 2} y={bodyY + bodyH * 0.42 + 12} textAnchor='middle' fontSize='7' fontWeight='600' fill='rgba(255,255,255,0.4)' fontFamily='Inter,system-ui,sans-serif'>{Math.round(fill * 100)}%</text>

      {/* Bottom base */}
      <rect x={bodyX + 2} y={bodyY + bodyH - 2} width={bodyW - 4} height='4' rx='0 0 5 5' fill={color} opacity='0.15'/>
    </svg>
  )
}`;

content = content.replace(oldVial, newVial);

// Also fix the SVG container size
content = content.replace(
  `<div style={{marginLeft:'16px',flexShrink:0,filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.5))'}}>\n          <DynamicVial name={activeCompound.name} color={color} fillPct={fillPct} />`,
  `<div style={{marginLeft:'16px',flexShrink:0,filter:'drop-shadow(0 6px 20px rgba(0,0,0,0.6))'}}>\n          <DynamicVial name={activeCompound.name} color={color} fillPct={fillPct} />`
);

if (content.includes('function DynamicVial({ name, color, fillPct }') && content.includes('Glass shine')) {
  fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', content, 'utf8');
  console.log('Done! Vial redesigned.');
} else {
  console.log('NOT FOUND - rewrite failed');
}
