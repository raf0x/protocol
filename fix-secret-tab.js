const fs = require('fs');
let content = fs.readFileSync('components/BottomNav.tsx', 'utf8');

// Add useState and useEffect imports
content = content.replace(
  "'use client'\nimport { usePathname } from 'next/navigation'",
  "'use client'\nimport { usePathname } from 'next/navigation'\nimport { useState, useEffect } from 'react'\nimport { createClient } from '../lib/supabase'"
);

// Add admin check
content = content.replace(
  "  const pathname = usePathname()\n  if (pathname === '/') return null",
  "  const pathname = usePathname()\n  const [isAdmin, setIsAdmin] = useState(false)\n  useEffect(() => { async function check() { const supabase = createClient(); const { data: { user } } = await supabase.auth.getUser(); if (user?.id === '41266062-c8a7-4a52-aa9b-c1fb96d1c483') setIsAdmin(true) }; check() }, [])\n  if (pathname === '/') return null"
);

// Add tracker link for admin only
content = content.replace(
  "    { href: '/profile', label: 'Profile' },",
  "    { href: '/profile', label: 'Profile' },\n    ...(isAdmin ? [{ href: '/tracker', label: '🔒' }] : []),"
);

fs.writeFileSync('components/BottomNav.tsx', content, 'utf8');
console.log('Done');
