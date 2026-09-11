const fs = require('fs');
let content = fs.readFileSync('app/layout.tsx', 'utf8');

content = content.replace(
  "title: 'Protocol'",
  "title: 'Protocol — Peptide & GLP-1 Protocol Tracker'"
);

// Add meta description if not present
if (!content.includes("description:")) {
  content = content.replace(
    "title: 'Protocol — Peptide & GLP-1 Protocol Tracker'",
    "title: 'Protocol — Peptide & GLP-1 Protocol Tracker',\n    description: 'Track your peptide and GLP-1 protocols with real insights. Log injections, mood, energy, sleep, and weight. See what actually works. Private, no ads, no data selling.'"
  );
}

fs.writeFileSync('app/layout.tsx', content, 'utf8');
console.log('Done');
