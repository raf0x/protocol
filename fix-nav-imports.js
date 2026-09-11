const fs = require('fs');
let content = fs.readFileSync('components/BottomNav.tsx', 'utf8');
content = content.replace(
  "import { usePathname } from 'next/navigation'",
  "import { usePathname } from 'next/navigation'\nimport { useState, useEffect } from 'react'\nimport { createClient } from '../lib/supabase'"
);
fs.writeFileSync('components/BottomNav.tsx', content, 'utf8');
console.log('Done');
