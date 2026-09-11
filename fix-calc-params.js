const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// Remove the force-dynamic we just added
content = content.replace("'use client'\n\nexport const dynamic = 'force-dynamic'", "'use client'");

// Wrap useSearchParams in Suspense by making it safe
content = content.replace(
  "import { useState, useEffect } from 'react'\nimport { useSearchParams } from 'next/navigation'",
  "import { useState, useEffect, Suspense } from 'react'"
);

// Remove searchParams usage and replace with manual URL parsing
content = content.replace(
  "  const searchParams = useSearchParams()\n\n  useEffect(() => {\n    const d = searchParams.get('dose')\n    const s = searchParams.get('vial')\n    const w = searchParams.get('water')",
  "  useEffect(() => {\n    const params = new URLSearchParams(window.location.search)\n    const d = params.get('dose')\n    const s = params.get('vial')\n    const w = params.get('water')"
);

fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
