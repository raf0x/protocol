const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Fix 1: Remove Today's Injections section
content = content.replace(
  `        {/* Today's injections — always visible */}
        <TodaysInjections
          dueCompounds={dueCompounds}
          tomorrowCompounds={tomorrowCompounds}
          logs={logs}
          onToggle={toggleInjection}
        />`,
  ``
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Removed TodaysInjections');
