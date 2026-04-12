const fs = require('fs');
const config = {
  "crons": [
    {
      "path": "/api/push",
      "schedule": "0 * * * *"
    }
  ]
};
fs.writeFileSync('vercel.json', JSON.stringify(config, null, 2), 'utf8');
console.log('Done');
