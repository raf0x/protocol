const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add haptic to toggleInjection
content = content.replace(
  `async function toggleInjection(cid: string) { if (togglingId === cid) return; setTogglingId(cid);`,
  `async function toggleInjection(cid: string) { if (togglingId === cid) return; try { navigator.vibrate(10) } catch(e) {} setTogglingId(cid);`
);

// Add haptic to saveEntry
content = content.replace(
  `async function saveEntry() { setSaving(true);`,
  `async function saveEntry() { try { navigator.vibrate(6) } catch(e) {} setSaving(true);`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
