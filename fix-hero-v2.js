const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

// Update hero headline
content = content.replace(
  "Track your protocol results.<br/><span style={{color:'#39ff14'}}>See what's actually working.</span>",
  "Stop guessing your protocol.<br/><span style={{color:'#39ff14'}}>Start knowing what works.</span>"
);

// Update subheadline
content = content.replace(
  "The private wellness tracker built for people managing peptide and GLP-1 protocols. No ads. No data selling. Just signal.",
  "Track → Analyze → Optimize. The private protocol tracker for peptide and GLP-1 users. Not just logging — real insights."
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done');
