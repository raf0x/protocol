const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// Add the supabase import at the top
content = content.replace(
  "import { useState, useEffect, Suspense } from 'react'",
  "import { useState, useEffect } from 'react'\nimport { createClient } from '../lib/supabase'"
);

// Remove the dynamic import inside saveToProtocol
content = content.replace(
  "    const { createClient } = await import('../lib/supabase')\n    const supabase = createClient()",
  "    const supabase = createClient()"
);

fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
