const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Find and extract the charts content block (starts with {showChart && cd.length)
const chartMatch = content.match(/        \{showChart && cd\.length > 1 && \(<div.*?\)}\)}<\/div>\)}/s);
if (!chartMatch) { console.log('Could not find chart block'); process.exit(1); }
const chartBlock = chartMatch[0];

// Remove it from current position
content = content.replace(chartBlock, '');

// Insert it right after the Show charts button
content = content.replace(
  "        {entries.length > 1 && (<div style={{marginBottom:'16px'}}><button onClick={() => setShowChart(!showChart)} style={{width:'100%',background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>{showChart ? 'Hide charts' : 'Show charts'}</button></div>)}",
  "        {entries.length > 1 && (<div style={{marginBottom:'16px'}}><button onClick={() => setShowChart(!showChart)} style={{width:'100%',background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>{showChart ? 'Hide charts' : 'Show charts'}</button></div>)}\n" + chartBlock
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done');
