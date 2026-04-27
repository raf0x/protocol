const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');
content = content.replace(
  `        <TodaysInjections
          dueCompounds={dueCompounds}
          logs={logs}
          onToggle={toggleInjection}
          onDiscomfort={setDiscomfortVal}
        />`,
  `        <TodaysInjections
          dueCompounds={dueCompounds}
          logs={logs}
          onToggle={toggleInjection}
        />`
);
fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
