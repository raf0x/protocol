const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  `          compoundIndex={activeProtocols.flatMap((p: any) => (p.compounds||[])).findIndex((c: any) => c.id === (activeCompoundTab || activeProtocols[0]?.compounds?.[0]?.id))}
        />`,
  `          compoundIndex={activeProtocols.flatMap((p: any) => (p.compounds||[])).findIndex((c: any) => c.id === (activeCompoundTab || activeProtocols[0]?.compounds?.[0]?.id))}
          onShare={shareProtocol}
        />`
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
