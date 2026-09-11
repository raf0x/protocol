const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Extract the showChart content block
const chartContentStart = "        {showChart && cd.length > 1 && (<div style={{background:cb,border:'1px solid '";
const chartContentEnd = "/>)}<\/Line><\/LineChart><\/ResponsiveContainer><\/>)}<\/div>)}";

// Find the chart content - it starts with {showChart && cd.length
const regex = /        \{showChart && cd\.length > 1[\s\S]*?<\/ResponsiveContainer><\/>\)}<\/div>\)}/;
const match = content.match(regex);
if (!match) { console.log('Could not find chart content'); process.exit(1); }

const chartContent = match[0];

// Remove from current position (bottom)
content = content.replace(chartContent, '');

// Insert right after the show/hide button
content = content.replace(
  "{showChart ? 'Hide charts' : 'Show charts'}</button></div>)}",
  "{showChart ? 'Hide charts' : 'Show charts'}</button></div>)}\n" + chartContent
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Chart moved');

// Bump service worker
let sw = fs.readFileSync('public/sw.js', 'utf8');
sw = sw.replace(/protocol-v\d+/, "protocol-v14");
fs.writeFileSync('public/sw.js', sw, 'utf8');
console.log('SW bumped to v14');
