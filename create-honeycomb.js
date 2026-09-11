const fs = require('fs');

const honeycomb = `'use client'

export default function PeptideHoneycomb() {
  const cells = [
    { name: 'Retatrutide', color: '#39ff14', textColor: '#000' },
    { name: 'Semaglutide', color: '#39ff14', textColor: '#000' },
    { name: 'Tirzepatide', color: '#39ff14', textColor: '#000' },
    { name: 'Liraglutide', color: '#39ff14', textColor: '#000' },
    { name: 'Irasploritide', color: '#39ff14', textColor: '#000' },
    { name: 'AOD-9604', color: '#39ff14', textColor: '#000' },
    { name: 'BPC-157', color: '#06b6d4', textColor: '#000' },
    { name: 'TB-500', color: '#06b6d4', textColor: '#000' },
    { name: 'Pentadeca', color: '#06b6d4', textColor: '#000' },
    { name: 'KPV', color: '#06b6d4', textColor: '#000' },
    { name: 'LL-37', color: '#06b6d4', textColor: '#000' },
    { name: 'Thymosin A1', color: '#06b6d4', textColor: '#000' },
    { name: 'CJC-1295', color: '#8b5cf6', textColor: '#fff' },
    { name: 'Ipamorelin', color: '#8b5cf6', textColor: '#fff' },
    { name: 'GHRP-6', color: '#8b5cf6', textColor: '#fff' },
    { name: 'Sermorelin', color: '#8b5cf6', textColor: '#fff' },
    { name: 'Tesamorelin', color: '#8b5cf6', textColor: '#fff' },
    { name: 'Hexarelin', color: '#8b5cf6', textColor: '#fff' },
    { name: 'GHK-Cu', color: '#f59e0b', textColor: '#000' },
    { name: 'Epithalon', color: '#f59e0b', textColor: '#000' },
    { name: 'Selank', color: '#f59e0b', textColor: '#000' },
    { name: 'Semax', color: '#f59e0b', textColor: '#000' },
    { name: 'Dihexa', color: '#f59e0b', textColor: '#000' },
    { name: 'Pinealon', color: '#f59e0b', textColor: '#000' },
    { name: 'HCG', color: '#f97316', textColor: '#000' },
    { name: 'IGF-1', color: '#f97316', textColor: '#000' },
    { name: 'MGF', color: '#f97316', textColor: '#000' },
    { name: 'PT-141', color: '#f97316', textColor: '#000' },
    { name: 'Kisspeptin', color: '#f97316', textColor: '#000' },
    { name: 'Follistatin', color: '#f97316', textColor: '#000' },
    { name: 'Melanotan II', color: '#f43f5e', textColor: '#fff' },
    { name: 'MOTS-C', color: '#f43f5e', textColor: '#fff' },
    { name: 'Humanin', color: '#f43f5e', textColor: '#fff' },
    { name: 'SS-31', color: '#f43f5e', textColor: '#fff' },
    { name: 'MDS', color: '#f43f5e', textColor: '#fff' },
    { name: 'Foxo4-DRI', color: '#f43f5e', textColor: '#fff' },
  ]

  const hexW = 88
  const hexH = 100
  const cols = 6
  const rows = Math.ceil(cells.length / cols)
  const svgW = cols * hexW + hexW * 0.5 + 10
  const svgH = rows * (hexH * 0.75) + hexH * 0.25 + 10

  function hexPoints(cx: number, cy: number, r: number) {
    return Array.from({ length: 6 }, (_, i) => {
      const angle = (Math.PI / 180) * (60 * i - 30)
      return (cx + r * Math.cos(angle)).toFixed(1) + ',' + (cy + r * Math.sin(angle)).toFixed(1)
    }).join(' ')
  }

  const positioned = cells.map((cell, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const cx = col * hexW + (row % 2 === 1 ? hexW * 0.5 : 0) + hexW * 0.5 + 5
    const cy = row * (hexH * 0.75) + hexH * 0.5 + 5
    return { ...cell, cx, cy }
  })

  return (
    <div style={{overflowX:'auto',width:'100%'}}>
      <svg width={svgW} height={svgH} viewBox={'0 0 ' + svgW + ' ' + svgH} style={{display:'block',margin:'0 auto',minWidth:'400px'}}>
        {positioned.map((cell, i) => (
          <g key={i}>
            <polygon
              points={hexPoints(cell.cx, cell.cy, hexW * 0.48)}
              fill={cell.color}
              opacity={0.85}
              stroke="rgba(0,0,0,0.15)"
              strokeWidth="1"
            />
            <polygon
              points={hexPoints(cell.cx, cell.cy - 4, hexW * 0.28)}
              fill="rgba(255,255,255,0.12)"
            />
            <text
              x={cell.cx}
              y={cell.cy + 4}
              textAnchor="middle"
              fontSize={cell.name.length > 9 ? '8' : '9'}
              fontWeight="800"
              fill={cell.textColor}
              fontFamily="Inter, sans-serif"
              style={{userSelect:'none'}}
            >
              {cell.name}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
`;

fs.writeFileSync('components/PeptideHoneycomb.tsx', honeycomb, 'utf8');
console.log('Done! PeptideHoneycomb created.');
