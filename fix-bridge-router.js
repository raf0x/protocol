const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// Add router import
if (!content.includes("useRouter")) {
  content = content.replace(
    "import { useState, useEffect } from 'react'",
    "import { useState, useEffect } from 'react'\nimport { useRouter } from 'next/navigation'"
  );
}

// Add router hook
content = content.replace(
  "  const [showCustomDose, setShowCustomDose] = useState(false)",
  "  const router = useRouter()\n  const [showCustomDose, setShowCustomDose] = useState(false)"
);

// Replace window.location.href with router.push
content = content.replace(
  "    window.location.href = '/protocol'",
  "    router.push('/protocol')"
);

fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
