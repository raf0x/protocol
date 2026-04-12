const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');
content = content.replace(
  "const [result, setResult] = useState(null)",
  "const [result, setResult] = useState<{concentration:number,volumeMl:number,syringeUnits:number}|null>(null)"
);
fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
