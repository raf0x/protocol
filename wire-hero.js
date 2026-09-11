const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add import
content = content.replace(
  `import WeeklySummary from '../../components/dashboard/WeeklySummary'`,
  `import WeeklySummary from '../../components/dashboard/WeeklySummary'
import HeroProtocolCard from '../../components/dashboard/HeroProtocolCard'`
);

// Insert hero card between title and StatsBar
content = content.replace(
  `        {/* Stats — StatsBar component */}`,
  `        {/* Hero protocol card */}
        <HeroProtocolCard
          activeProtocols={activeProtocols}
          currentWeek={currentWeek}
          totalLost={tl}
        />

        {/* Stats — StatsBar component */}`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
