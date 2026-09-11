const fs = require('fs');
console.log('Exists:', fs.existsSync('components/dashboard/HeroProtocolCard.tsx'));
console.log('Files in components/dashboard:', fs.readdirSync('components/dashboard'));
