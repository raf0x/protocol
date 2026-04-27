'use client'
import { useState } from 'react'

const CELLS = [
  { name: 'Retatrutide', cat: 'glp1' },
  { name: 'Semaglutide', cat: 'glp1' },
  { name: 'Tirzepatide', cat: 'glp1' },
  { name: 'Liraglutide', cat: 'glp1' },
  { name: 'Irasploritide', cat: 'glp1' },
  { name: 'AOD-9604', cat: 'glp1' },
  { name: 'BPC-157', cat: 'repair' },
  { name: 'TB-500', cat: 'repair' },
  { name: 'Pentadeca', cat: 'repair' },
  { name: 'KPV', cat: 'repair' },
  { name: 'LL-37', cat: 'repair' },
  { name: 'Thymosin A1', cat: 'repair' },
  { name: 'CJC-1295', cat: 'gh' },
  { name: 'Ipamorelin', cat: 'gh' },
  { name: 'GHRP-6', cat: 'gh' },
  { name: 'Sermorelin', cat: 'gh' },
  { name: 'Tesamorelin', cat: 'gh' },
  { name: 'Hexarelin', cat: 'gh' },
  { name: 'GHK-Cu', cat: 'longevity' },
  { name: 'Epithalon', cat: 'longevity' },
  { name: 'Selank', cat: 'longevity' },
  { name: 'Semax', cat: 'longevity' },
  { name: 'Dihexa', cat: 'longevity' },
  { name: 'Pinealon', cat: 'longevity' },
  { name: 'HCG', cat: 'hormone' },
  { name: 'IGF-1', cat: 'hormone' },
  { name: 'MGF', cat: 'hormone' },
  { name: 'PT-141', cat: 'hormone' },
  { name: 'Kisspeptin', cat: 'hormone' },
  { name: 'Follistatin', cat: 'hormone' },
  { name: 'Melanotan II', cat: 'antiage' },
  { name: 'MOTS-C', cat: 'antiage' },
  { name: 'Humanin', cat: 'antiage' },
  { name: 'SS-31', cat: 'antiage' },
  { name: 'MDS', cat: 'antiage' },
  { name: 'Foxo4-DRI', cat: 'antiage' },
]

const CAT_COLOR: Record<string, string> = {
  glp1: '#39ff14',
  repair: '#06b6d4',
  gh: '#a78bfa',
  longevity: '#fbbf24',
  hormone: '#fb923c',
  antiage: '#f87171',
}

const CAT_LABEL: Record<string, string> = {
  glp1: 'GLP-1',
  repair: 'Repair',
  gh: 'GH Peptides',
  longevity: 'Longevity',
  hormone: 'Hormones',
  antiage: 'Anti-Aging',
}

export default function PeptideHoneycomb() {
  const [hovered, setHovered] = useState<number | null>(null)
  const cols = 4
  const hexR = 38
  const hexW = hexR * 2 * 0.866
  const hexH = hexR * 2
  const colSpacing = hexW + 4
  const rowSpacing = hexH * 0.76
  const rows = Math.ceil(CELLS.length / cols)
  const svgW = cols * colSpacing + hexW * 0.5 + 8
  const svgH = rows * rowSpacing + hexH * 0.28 + 8

  function hexPoints(cx: number, cy: number, r: number) {
    return Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i - 30)
      return (cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2)
    }).join(' ')
  }

  const positioned = CELLS.map((cell, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const cx = col * colSpacing + (row % 2 === 1 ? colSpacing * 0.5 : 0) + hexR + 4
    const cy = row * rowSpacing + hexR + 4
    return { ...cell, cx, cy, idx }
  })

  return (
    <div style={{width:'100%',overflowX:'auto',WebkitOverflowScrolling:'touch'}}>
      <style>{`
        .hex-cell { transition: transform 0.18s cubic-bezier(0.34,1.56,0.64,1), filter 0.18s ease; cursor: default; }
        .hex-cell:hover { transform: translateY(-6px); }
      `}</style>
      <div style={{minWidth: svgW + 'px', maxWidth:'100%'}}>
        <svg width='100%' viewBox={'0 0 ' + svgW + ' ' + svgH} style={{display:'block',margin:'0 auto'}}>
          <defs>
            <filter id='hex-shadow' x='-20%' y='-20%' width='140%' height='140%'>
              <feDropShadow dx='0' dy='3' stdDeviation='3' floodOpacity='0.4'/>
            </filter>
          </defs>
          {positioned.map((cell) => {
            const color = CAT_COLOR[cell.cat]
            const isHov = hovered === cell.idx
            return (
              <g
                key={cell.idx}
                className='hex-cell'
                onMouseEnter={() => setHovered(cell.idx)}
                onMouseLeave={() => setHovered(null)}
                style={{filter: isHov ? 'drop-shadow(0 6px 12px ' + color + '55)' : 'none'}}
              >
                <polygon
                  points={hexPoints(cell.cx, cell.cy, hexR - 1)}
                  fill='#0d0d1a'
                  stroke={color}
                  strokeWidth={isHov ? '1.5' : '0.8'}
                  opacity={isHov ? 1 : 0.75}
                />
                <polygon
                  points={hexPoints(cell.cx, cell.cy - hexR * 0.35, hexR * 0.45)}
                  fill='rgba(255,255,255,0.03)'
                />
                <text
                  x={cell.cx}
                  y={cell.cy + (cell.name.length > 8 ? -2 : 4)}
                  textAnchor='middle'
                  fontSize={cell.name.length > 10 ? '6.5' : cell.name.length > 7 ? '7.5' : '8.5'}
                  fontWeight='700'
                  fill={isHov ? color : 'rgba(255,255,255,0.7)'}
                  fontFamily='Inter,system-ui,sans-serif'
                  style={{userSelect:'none',transition:'fill 0.15s'}}
                >
                  {cell.name.length > 10 ? (
                    <>
                      <tspan x={cell.cx} dy='0'>{cell.name.split(' ')[0]}</tspan>
                      <tspan x={cell.cx} dy='9'>{cell.name.split(' ').slice(1).join(' ')}</tspan>
                    </>
                  ) : cell.name}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:'12px',justifyContent:'center',marginTop:'20px',padding:'0 16px'}}>
        {Object.entries(CAT_LABEL).map(([cat, label]) => (
          <div key={cat} style={{display:'flex',alignItems:'center',gap:'5px'}}>
            <div style={{width:'8px',height:'8px',borderRadius:'2px',background:CAT_COLOR[cat]}} />
            <span style={{fontSize:'11px',color:'#8b8ba7',fontWeight:'600'}}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}