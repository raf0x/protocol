const fs = require('fs');

// 1. Simplify calculator - just save to localStorage and navigate
let calc = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// Replace the entire saveToProtocol function
calc = calc.replace(
  /  async function saveToProtocol\(\) \{[\s\S]*?\} catch \(e\) \{ console\.error\(e\); setSavingProtocol\(false\) \}\n  \}/,
  `  function saveToProtocol() {
    if (!compoundLabel.trim()) return
    localStorage.setItem('pendingProtocol', JSON.stringify({
      name: compoundLabel.trim(),
      dose: activeDose,
      vial: activeStrength,
      water: activeWater
    }))
    window.location.href = '/protocol'
  }`
);

// Remove all the save flow UI - replace with simple inline flow
// Remove showSaveFlow, isLoggedIn, savingProtocol, saveSuccess states usage in the UI
// Replace the complex save flow with a simple one
calc = calc.replace(
  /          \{hasAll && showSaveFlow && !saveSuccess && isLoggedIn && \([\s\S]*?\)}\n\n          \{hasAll && showSaveFlow && !isLoggedIn && \([\s\S]*?\)}\n\n          \{saveSuccess && \([\s\S]*?\)}/,
  `          {hasAll && showSaveFlow && (
            <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid '+bd}}>
              <span style={{fontSize:'11px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',display:'block',marginBottom:'8px'}}>ADD TO YOUR STACK</span>
              {!compoundLabel.trim() && <p style={{fontSize:'11px',color:mg,marginBottom:'8px'}}>Enter a compound name above first</p>}
              {compoundLabel.trim() && (
                <>
                  <p style={{fontSize:'12px',color:dg,marginBottom:'10px'}}>Creates: {compoundLabel} · {activeDose}mg · {activeStrength}mg vial · {activeWater}mL BAC · Weekly</p>
                  <div style={{display:'flex',gap:'8px'}}>
                    <button onClick={() => setShowSaveFlow(false)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'6px',padding:'10px',fontSize:'13px',cursor:'pointer'}}>Cancel</button>
                    <button onClick={saveToProtocol} style={{flex:2,background:g,color:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'13px',fontWeight:'700',cursor:'pointer'}}>Create Protocol</button>
                  </div>
                </>
              )}
            </div>
          )}`
);

// Remove unused states
calc = calc.replace("  const [isLoggedIn, setIsLoggedIn] = useState(false)\n", "");
calc = calc.replace("  const [savingProtocol, setSavingProtocol] = useState(false)\n", "");
calc = calc.replace("  const [saveSuccess, setSaveSuccess] = useState(false)\n", "");
calc = calc.replace("  const [userId, setUserId] = useState('')\n", "");
calc = calc.replace("    setIsLoggedIn(true)\n", "");

fs.writeFileSync('app/calculator/page.tsx', calc, 'utf8');
console.log('Calculator simplified');

// 2. Update Dashboard to check localStorage for pending protocol
let dash = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add pending protocol check in the existing useEffect
dash = dash.replace(
  "    const params = new URLSearchParams(window.location.search)\n    if (params.get('newprotocol') === '1') {\n      setPrefillDose(params.get('dose') || '')\n      setPrefillVial(params.get('vial') || '')\n      setPrefillWater(params.get('water') || '')\n      setShowNewProtocol(true)\n      window.history.replaceState({}, '', '/protocol')\n    }",
  `    const pending = localStorage.getItem('pendingProtocol')
    if (pending) {
      try {
        const p = JSON.parse(pending)
        setNewName(p.name || '')
        setPrefillDose(p.dose?.toString() || '')
        setPrefillVial(p.vial?.toString() || '')
        setPrefillWater(p.water?.toString() || '')
        setShowNewProtocol(true)
        localStorage.removeItem('pendingProtocol')
      } catch(e) { localStorage.removeItem('pendingProtocol') }
    }`
);

fs.writeFileSync('app/protocol/page.tsx', dash, 'utf8');
console.log('Dashboard updated');
console.log('All done');
