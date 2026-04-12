const fs = require('fs');
let content = fs.readFileSync('app/profile/page.tsx', 'utf8');
content = content.replace(
  "    } catch (e) {\n      setNotifStatus('Could not enable notifications. Make sure you are using the installed app.')\n    }",
  "    } catch (e: any) {\n      console.error('Push error:', e)\n      setNotifStatus('Error: ' + (e?.message || String(e)))\n    }"
);
fs.writeFileSync('app/profile/page.tsx', content, 'utf8');
console.log('Done');
