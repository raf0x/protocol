const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// Make section headers bright white bold
content = content.split("fontSize:'13px',fontWeight:'700',color:dg,letterSpacing:'1px',marginBottom:'14px'").join("fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'14px'");

// Make RESULTS header bright white
content = content.replace(
  "fontSize:'13px',fontWeight:'700',color:dg,letterSpacing:'1px',marginBottom:'20px'",
  "fontSize:'13px',fontWeight:'700',color:'#ffffff',letterSpacing:'1px',marginBottom:'20px'"
);

// Make result boxes more visible - brighter background and borders
content = content.split("background:'#0a0a0f',borderRadius:'8px',padding:'12px'").join("background:'#1a1a2e',border:'1px solid #2a2a4e',borderRadius:'8px',padding:'12px'");

// Make result label text brighter
content = content.split("fontSize:'11px',color:mg,display:'block',marginBottom:'4px',letterSpacing:'1px'").join("fontSize:'11px',color:'#8b8ba7',display:'block',marginBottom:'4px',letterSpacing:'1px',fontWeight:'700'");

// Make syringe more visible - brighter body and tick marks
content = content.replace(
  "<rect x='16' y='20' width='28' height='200' rx='4' fill='#12121a' stroke='#1e1e2e' strokeWidth='2'/>",
  "<rect x='16' y='20' width='28' height='200' rx='4' fill='#1a1a2e' stroke='#3d3d6e' strokeWidth='2'/>"
);
content = content.replace(
  "stroke='#3d3d5c' strokeWidth='1'/>\n            <text x='52' y={y+4} fontSize='7' fill='#3d3d5c'",
  "stroke='#6b6b9c' strokeWidth='1'/>\n            <text x='52' y={y+4} fontSize='7' fill='#6b6b9c'"
);
content = content.replace(
  "fill='#1e1e2e' stroke='#3d3d5c' strokeWidth='1'/>",
  "fill='#2a2a4e' stroke='#6b6b9c' strokeWidth='1'/>"
);
content = content.replace(
  "fill='#3d3d5c'/>",
  "fill='#6b6b9c'/>"
);

fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
