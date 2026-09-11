const fs = require('fs');

// Fix sign out in BottomNav - redirect to / not /auth/login
let nav = fs.readFileSync('components/BottomNav.tsx', 'utf8');
nav = nav.replace("router.push('/auth/login')", "router.push('/')");
fs.writeFileSync('components/BottomNav.tsx', nav, 'utf8');

// Fix sign out in Profile page
let profile = fs.readFileSync('app/profile/page.tsx', 'utf8');
profile = profile.replace("router.push('/auth/login')", "router.push('/')");
fs.writeFileSync('app/profile/page.tsx', profile, 'utf8');

// Fix service worker - don't cache protected pages
let sw = fs.readFileSync('public/sw.js', 'utf8');
sw = sw.replace(
  "const STATIC_ASSETS = [\n  '/',\n  '/calculator',\n  '/protocol',\n  '/journal',\n  '/learn',\n]",
  "const STATIC_ASSETS = [\n  '/',\n  '/calculator',\n]"
);
sw = sw.replace(/protocol-v\d+/, "protocol-v11");
fs.writeFileSync('public/sw.js', sw, 'utf8');

console.log('Done');
