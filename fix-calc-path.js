const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');
content = content.replace(
  "import { createClient } from '../lib/supabase'",
  "import { createClient } from '../../lib/supabase'"
);
fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
