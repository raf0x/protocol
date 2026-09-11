const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

content = content.replace(
  `const [showSummary, setShowSummary] = useState(false)`,
  `const [showSummary, setShowSummary] = useState(new Date().getDay() === 0)`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
