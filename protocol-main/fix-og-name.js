const fs = require('fs');

// 1. Update the share URL in calculator to include compound name
let calc = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// Add compound name state
calc = calc.replace(
  "  const [showCustomWater, setShowCustomWater] = useState(false)",
  "  const [showCustomWater, setShowCustomWater] = useState(false)\n  const [compoundLabel, setCompoundLabel] = useState('')"
);

// Update getShareUrl to include name
calc = calc.replace(
  "    return window.location.origin + '/calculator?dose=' + activeDose + '&vial=' + activeStrength + '&water=' + activeWater",
  "    return window.location.origin + '/calculator?dose=' + activeDose + '&vial=' + activeStrength + '&water=' + activeWater + (compoundLabel ? '&name=' + encodeURIComponent(compoundLabel) : '')"
);

// Add compound name input right above the share/save buttons
calc = calc.replace(
  "              <div style={{display:'flex',gap:'8px',marginTop:'16px'}}>",
  "              <div style={{marginTop:'16px'}}>\n                <input value={compoundLabel} onChange={e => setCompoundLabel(e.target.value)} placeholder='Compound name (optional, shown when shared)' style={{width:'100%',background:'#0a0a0f',border:'1px solid '+bd,borderRadius:'6px',padding:'8px 10px',color:'white',fontSize:'12px',boxSizing:'border-box',marginBottom:'8px'}} />\n              </div>\n              <div style={{display:'flex',gap:'8px'}}>"
);

// Read name from URL params on load
calc = calc.replace(
  "    const w = params.get('water')",
  "    const w = params.get('water')\n    const n = params.get('name')\n    if (n) setCompoundLabel(decodeURIComponent(n))"
);

fs.writeFileSync('app/calculator/page.tsx', calc, 'utf8');
console.log('Calculator updated');

// 2. Update OG image to show compound name
let og = fs.readFileSync('app/api/og/route.tsx', 'utf8');
og = og.replace(
  "  const dose = parseFloat(searchParams.get('dose') || '0')",
  "  const name = searchParams.get('name') || ''\n  const dose = parseFloat(searchParams.get('dose') || '0')"
);
og = og.replace(
  "          <span style={{fontSize:'20px',color:'#3d3d5c'}}>Peptide Calculator</span>",
  "          <span style={{fontSize:'20px',color:'#3d3d5c'}}>{name || 'Peptide Calculator'}</span>"
);
og = og.replace(
  "              <span style={{fontSize:'14px',color:'#39ff14',letterSpacing:'2px',marginBottom:'8px'}}>DRAW SYRINGE TO</span>",
  "              {name && <span style={{fontSize:'18px',color:'#8b8ba7',marginBottom:'8px'}}>{name}</span>}\n              <span style={{fontSize:'14px',color:'#39ff14',letterSpacing:'2px',marginBottom:'8px'}}>DRAW SYRINGE TO</span>"
);

fs.writeFileSync('app/api/og/route.tsx', og, 'utf8');
console.log('OG image updated');
console.log('All done');
