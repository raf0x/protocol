const fs = require('fs');
const path = require('path');

// Check if the share directory exists
const dirs = ['app/share', 'app/share/[token]'];
dirs.forEach(d => {
  console.log(d + ': ' + (fs.existsSync(d) ? 'EXISTS' : 'MISSING'));
});

// List what's actually in app/share if it exists
if (fs.existsSync('app/share')) {
  console.log('Contents of app/share:', fs.readdirSync('app/share'));
}
