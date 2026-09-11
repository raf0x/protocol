const fs = require('fs');

// Fix 1: Update isDueToday in lib/utils.ts to check days_of_week array
let utils = fs.readFileSync('lib/utils.ts', 'utf8');
utils = utils.replace(
  `  if (frequency === '1x/week') return dayOfWeek !== null ? todayDay === dayOfWeek : daysDiff % 7 === 0
  if (frequency === '2x/week') { const d = dayOfWeek ?? 0; return todayDay === d || todayDay === (d+3)%7 }`,
  `  if (frequency === '1x/week') return dayOfWeek !== null ? todayDay === dayOfWeek : daysDiff % 7 === 0
  if (frequency === '2x/week') { const d = dayOfWeek ?? 0; return todayDay === d || todayDay === (d+3)%7 }`
);
fs.writeFileSync('lib/utils.ts', utils, 'utf8');

// Fix 2: Update isDueToday to also accept days_of_week array
utils = fs.readFileSync('lib/utils.ts', 'utf8');
utils = utils.replace(
  `export function isDueToday(frequency: string, protocolStart: string, dayOfWeek: number | null, checkDateStr?: string): boolean {`,
  `export function isDueToday(frequency: string, protocolStart: string, dayOfWeek: number | null, checkDateStr?: string, daysOfWeek?: number[]): boolean {`
);

// Add days_of_week array check after daysDiff calculation
utils = utils.replace(
  `  if (daysDiff < 0) return false
  if (frequency === 'daily') return true`,
  `  if (daysDiff < 0) return false
  // If days_of_week array is provided, use it directly
  if (daysOfWeek && daysOfWeek.length > 0) return daysOfWeek.includes(todayDay)
  if (frequency === 'daily') return true`
);

// Move todayDay before the daysOfWeek check
utils = utils.replace(
  `  const daysDiff = Math.floor((today.getTime() - start.getTime()) / 86400000)
  if (daysDiff < 0) return false
  // If days_of_week array is provided, use it directly
  if (daysOfWeek && daysOfWeek.length > 0) return daysOfWeek.includes(todayDay)`,
  `  const daysDiff = Math.floor((today.getTime() - start.getTime()) / 86400000)
  const todayDay = today.getDay()
  if (daysDiff < 0) return false
  // If days_of_week array is provided, use it directly
  if (daysOfWeek && daysOfWeek.length > 0) return daysOfWeek.includes(todayDay)`
);

// Remove duplicate todayDay declaration
utils = utils.replace(
  `  const todayDay = today.getDay()
  const todayDay = today.getDay()`,
  `  const todayDay = today.getDay()`
);

fs.writeFileSync('lib/utils.ts', utils, 'utf8');
console.log('utils.ts updated');

// Fix 3: Pass days_of_week to isDueToday in protocol/page.tsx
let protocol = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Fix today's due compounds
protocol = protocol.replace(
  `if (phase && isDueToday(phase.frequency, p.start_date, phase.day_of_week)) {`,
  `if (phase && isDueToday(phase.frequency, p.start_date, phase.day_of_week, undefined, phase.days_of_week)) {`
);

// Fix tomorrow's due compounds
protocol = protocol.replace(
  `if (phase && isDueToday(phase.frequency, p.start_date, phase.day_of_week, tomorrowStr)) {`,
  `if (phase && isDueToday(phase.frequency, p.start_date, phase.day_of_week, tomorrowStr, phase.days_of_week)) {`
);

fs.writeFileSync('app/protocol/page.tsx', protocol, 'utf8');
console.log('protocol/page.tsx updated');
