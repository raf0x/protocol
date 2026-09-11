const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// Remove all bridge-related states
content = content.replace("  const [showSaveFlow, setShowSaveFlow] = useState(false)\n", "");
content = content.replace("  const [saveSuccess, setSaveSuccess] = useState(false)\n", "");

// Remove the saveToProtocol function
content = content.replace(
  /  function saveToProtocol\(\) \{[\s\S]*?  \}\n/,
  ""
);

// Remove the entire save flow UI block and success block
content = content.replace(
  /          \{hasAll && showSaveFlow && \([\s\S]*?\)}\n\n          \{saveSuccess && \([\s\S]*?\)}\n/,
  ""
);

// Replace the save button with a simple signup prompt link
content = content.replace(
  "<button onClick={() => setShowSaveFlow(true)} style={{flex:1,background:g,color:'#000',border:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>Save to protocol →</button>",
  "<a href='/auth/login' style={{flex:1,background:g,color:'#000',textDecoration:'none',borderRadius:'6px',padding:'10px',fontSize:'12px',fontWeight:'700',textAlign:'center',display:'flex',alignItems:'center',justifyContent:'center'}}>Track this protocol →</a>"
);

// Remove localStorage pendingProtocol line if it exists
content = content.replace(/.*localStorage\.setItem\('pendingProtocol'.*\n/g, "");

fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
