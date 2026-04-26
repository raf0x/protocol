const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  `const [activeCompoundTab, setActiveCompoundTab] = useState(null)`,
  `const [activeCompoundTab, setActiveCompoundTab] = useState<string | null>(null)`
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('useState<string | null>') ? 'yes' : 'NO'));
