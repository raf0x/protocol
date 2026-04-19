const fs = require('fs');

let protocol = fs.readFileSync('app/protocol/page.tsx', 'utf8');
protocol = protocol.replace("No protocols yet.", "No active protocols yet.");
protocol = protocol.replace("Tap + New to build your first one with phases.", "Tap + New to build your first cycle.");
protocol = protocol.replace("'Edit Protocol' : 'New Protocol'", "'Edit Cycle' : 'New Cycle'");
fs.writeFileSync('app/protocol/page.tsx', protocol, 'utf8');

let journal = fs.readFileSync('app/journal/page.tsx', 'utf8');
journal = journal.replace("ACTIVE STACK", "ACTIVE COMPOUNDS");
fs.writeFileSync('app/journal/page.tsx', journal, 'utf8');

console.log('Done');
