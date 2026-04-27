'use client'
import { useState, useEffect } from 'react'

const CELLS = [
  { name: 'Retatrutide', cat: 'glp1' },
  { name: 'Semaglutide', cat: 'glp1' },
  { name: 'Tirzepatide', cat: 'glp1' },
  { name: 'Liraglutide', cat: 'glp1' },
  { name: 'AOD-9604', cat: 'glp1' },
  { name: 'BPC-157', cat: 'repair' },
  { name: 'TB-500', cat: 'repair' },
  { name: 'KPV', cat: 'repair' },
  { name: 'LL-37', cat: 'repair' },
  { name: 'Thymosin A1', cat: 'repair' },
  { name: 'CJC-1295', cat: 'gh' },
  { name: 'Ipamorelin', cat: 'gh' },
  { name: 'GHRP-6', cat: 'gh' },
  { name: 'Sermorelin', cat: 'gh' },
  { name: 'Tesamorelin', cat: 'gh' },
  { name: 'GHK-Cu', cat: 'longevity' },
  { name: 'Epithalon', cat: 'longevity' },
  { name: 'Selank', cat: 'longevity' },
  { name: 'Semax', cat: 'longevity' },
  { name: 'Pinealon', cat: 'longevity' },
  { name: 'HCG', cat: 'hormone' },
  { name: 'IGF-1', cat: 'hormone' },
  { name: 'PT-141', cat: 'hormone' },
  { name: 'Follistatin', cat: 'hormone' },
  { name: 'Kisspeptin', cat: 'hormone' },
  { name: 'Melanotan I', cat: 'antiage' },
  { name: 'Melanotan II', cat: 'antiage' },
  { name: 'MOTS-C', cat: 'antiage' },
  { name: 'Humanin', cat: 'antiage' },
  { name: 'SS-31', cat: 'antiage' },
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
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    function check() { setIsMobile(window.innerWidth < 600) }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const cols = isMobile ? 4 : 5
  const hexR = isMobile ? 40 : 52
  const colSpacing = hexR * 1.78
  const rowSpacing = hexR * 1.56
  const rows = Math.ceil(CELLS.length / cols)
  const svgW = cols * colSpacing + colSpacing * 0.5 + 16
  const svgH = rows * rowSpacing + hexR * 0.6 + 16

  function hexPoints(cx: number, cy: number, r: number) {
    return Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 180) * (60 * i - 30)
      return (cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2)
    }).join(' ')
  }

  const positioned = CELLS.map((cell, idx) => {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const cx = col * colSpacing + (row % 2 === 1 ? colSpacing * 0.5 : 0) + hexR + 8
    const cy = row * rowSpacing + hexR + 8
    return { ...cell, cx, cy, idx }
  })

  return (
    <div style={{width:'100%',padding:'0 8px',boxSizing:'border-box'}}>
      <style>{`
        .hex-cell { transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), filter 0.2s ease; cursor: default; }
        .hex-cell:hover { transform: translateY(-8px); }
      `}</style>
      <svg
        width='100%'
        viewBox={'0 0 ' + svgW + ' ' + svgH}
        style={{display:'block',margin:'0 auto'}}
        preserveAspectRatio='xMidYMid meet'
      >
        {positioned.map((cell) => {
          const color = CAT_COLOR[cell.cat]
          const isHov = hovered === cell.idx
          const parts = cell.name.split(' ')
          const line1 = parts[0]
          const line2 = parts.slice(1).join(' ')
          const fontSize = isMobile ? (cell.name.length > 9 ? '6.5' : '7.5') : (cell.name.length > 9 ? '8' : '9.5')
          return (
            <g
              key={cell.idx}
              className='hex-cell'
              onMouseEnter={() => setHovered(cell.idx)}
              onMouseLeave={() => setHovered(null)}
              style={{filter: isHov ? 'drop-shadow(0 8px 16px ' + color + '66)' : 'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'}}
            >
              <polygon
                points={hexPoints(cell.cx, cell.cy, hexR - 1.5)}
                fill='#0d0d1a'
                stroke={color}
                strokeWidth={isHov ? '2' : '1'}
                opacity={isHov ? 1 : 0.7}
              />
              <polygon
                points={hexPoints(cell.cx, cell.cy - hexR * 0.3, hexR * 0.5)}
                fill='rgba(255,255,255,0.04)'
              />
              {line2 ? (
                <>
                  <text x={cell.cx} y={cell.cy - 3} textAnchor='middle' fontSize={fontSize} fontWeight='700' fill={isHov ? color : 'rgba(255,255,255,0.75)'} fontFamily='Inter,system-ui,sans-serif' style={{userSelect:'none',transition:'fill 0.15s'}}>{line1}</text>
                  <text x={cell.cx} y={cell.cy + parseFloat(fontSize) + 4} textAnchor='middle' fontSize={fontSize} fontWeight='700' fill={isHov ? color : 'rgba(255,255,255,0.75)'} fontFamily='Inter,system-ui,sans-serif' style={{userSelect:'none',transition:'fill 0.15s'}}>{line2}</text>
                </>
              ) : (
                <text x={cell.cx} y={cell.cy + 4} textAnchor='middle' fontSize={fontSize} fontWeight='700' fill={isHov ? color : 'rgba(255,255,255,0.75)'} fontFamily='Inter,system-ui,sans-serif' style={{userSelect:'none',transition:'fill 0.15s'}}>{line1}</text>
              )}
            </g>
          )
        })}
      </svg>
      <div style={{display:'flex',flexWrap:'wrap',gap:'12px',justifyContent:'center',marginTop:'20px',padding:'0 8px'}}>
        {Object.entries(CAT_LABEL).map(([cat, label]) => (
          <div key={cat} style={{display:'flex',alignItems:'center',gap:'5px'}}>
            <div style={{width:'7px',height:'7px',borderRadius:'2px',background:CAT_COLOR[cat],opacity:0.8}} />
            <span style={{fontSize:'11px',color:'#8b8ba7',fontWeight:'600',letterSpacing:'0.5px'}}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}