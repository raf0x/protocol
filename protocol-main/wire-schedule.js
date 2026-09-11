const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

content = content.replace(
  `import VialInventory from '../../components/dashboard/VialInventory'`,
  `import VialInventory from '../../components/dashboard/VialInventory'
import WeeklySchedule from '../../components/dashboard/WeeklySchedule'`
);

content = content.replace(
  `        {/* Today's injections — always visible */}`,
  `        {/* Weekly schedule */}
        <WeeklySchedule activeProtocols={activeProtocols} />

        {/* Today's injections — always visible */}`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
