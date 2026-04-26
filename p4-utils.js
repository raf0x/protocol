const fs = require('fs');

// Create lib/utils.ts
const utils = `// ============================================
// PROTOCOL UTILITIES
// Shared logic used across multiple pages.
// ============================================

export function isDueToday(frequency: string, protocolStart: string, dayOfWeek: number | null): boolean {
  if (!protocolStart) return false
  const start = new Date(protocolStart + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const daysDiff = Math.floor((today.getTime() - start.getTime()) / 86400000)
  if (daysDiff < 0) return false
  if (frequency === 'daily') return true
  if (frequency === 'eod') return daysDiff % 2 === 0
  if (frequency === 'every3days') return daysDiff % 3 === 0
  if (frequency === 'every4days') return daysDiff % 4 === 0
  if (frequency === 'every5days') return daysDiff % 5 === 0
  const todayDay = today.getDay()
  if (frequency === '1x/week') return dayOfWeek !== null ? todayDay === dayOfWeek : daysDiff % 7 === 0
  if (frequency === '2x/week') { const d = dayOfWeek ?? 0; return todayDay === d || todayDay === (d+3)%7 }
  if (frequency === '3x/week') return todayDay === 1 || todayDay === 3 || todayDay === 5
  if (frequency === '4x/week') return todayDay === 1 || todayDay === 2 || todayDay === 4 || todayDay === 5
  if (frequency === '5x/week') return todayDay >= 1 && todayDay <= 5
  if (frequency === '6x/week') return todayDay !== 0
  return false
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDateLong(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function getDaysIn(startDate: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(startDate + 'T00:00:00').getTime()) / 86400000))
}

export function getCurrentWeek(startDate: string): number {
  return Math.max(1, Math.floor(getDaysIn(startDate) / 7) + 1)
}

export function eventColor(type: string): string {
  const colors: Record<string, string> = {
    started: 'var(--color-green)',
    dose_change: '#f59e0b',
    compound_added: '#06b6d4',
    compound_removed: '#ff6b6b',
  }
  return colors[type] || '#6c63ff'
}
`;

fs.writeFileSync('lib/utils.ts', utils, 'utf8');
console.log('Created lib/utils.ts');

// Update protocol/page.tsx to import from utils
let protocol = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add import
if (!protocol.includes("from '../../lib/utils'")) {
  protocol = protocol.replace(
    `import { createClient } from '../../lib/supabase'`,
    `import { createClient } from '../../lib/supabase'
import { isDueToday, getDaysIn, getCurrentWeek, eventColor } from '../../lib/utils'`
  );
}

// Remove the local isDueToday function
protocol = protocol.replace(
  `function isDueToday(frequency: string, protocolStart: string, dayOfWeek: number | null): boolean {
  if (!protocolStart) return false
  const start = new Date(protocolStart + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const daysDiff = Math.floor((today.getTime() - start.getTime()) / 86400000)
  if (daysDiff < 0) return false
  if (frequency === 'daily') return true
  if (frequency === 'eod') return daysDiff % 2 === 0
  if (frequency === 'every3days') return daysDiff % 3 === 0
  if (frequency === 'every4days') return daysDiff % 4 === 0
  if (frequency === 'every5days') return daysDiff % 5 === 0
  const todayDay = today.getDay()
  if (frequency === '1x/week') return dayOfWeek !== null ? todayDay === dayOfWeek : daysDiff % 7 === 0
  if (frequency === '2x/week') { const d = dayOfWeek ?? 0; return todayDay === d || todayDay === (d+3)%7 }
  if (frequency === '3x/week') return todayDay === 1 || todayDay === 3 || todayDay === 5
  if (frequency === '4x/week') return todayDay === 1 || todayDay === 2 || todayDay === 4 || todayDay === 5
  if (frequency === '5x/week') return todayDay >= 1 && todayDay <= 5
  if (frequency === '6x/week') return todayDay !== 0
  return false
}`,
  `// isDueToday moved to lib/utils.ts`
);

fs.writeFileSync('app/protocol/page.tsx', protocol, 'utf8');
console.log('Updated protocol/page.tsx to use lib/utils.ts');
console.log('Priority 4 done!');
