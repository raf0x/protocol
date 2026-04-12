const fs = require('fs');
const content = `'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function GamePage() {
  const router = useRouter()
  useEffect(() => {
    window.location.href = '/timedodge.html'
  }, [])
  return null
}`;
fs.writeFileSync('app/game/page.tsx', content, 'utf8');
console.log('Done');
