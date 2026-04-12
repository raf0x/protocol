const fs = require('fs');
let content = fs.readFileSync('app/profile/page.tsx', 'utf8');
content = content.replace(
  "applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,",
  "applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ''),"
);
content = content.replace(
  "  async function enableNotifications() {",
  "  function urlBase64ToUint8Array(base64String: string) {\n    const padding = '='.repeat((4 - base64String.length % 4) % 4)\n    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')\n    const rawData = window.atob(base64)\n    const outputArray = new Uint8Array(rawData.length)\n    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i) }\n    return outputArray\n  }\n\n  async function enableNotifications() {"
);
fs.writeFileSync('app/profile/page.tsx', content, 'utf8');
console.log('Done');
