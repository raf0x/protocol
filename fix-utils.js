const fs = require('fs');
let content = fs.readFileSync('lib/utils.ts', 'utf8');
content = content.replace(
  `export function isDueToday(frequency: string, protocolStart: string, dayOfWeek: number | null): boolean {
  if (!protocolStart) return false
  const start = new Date(protocolStart + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const daysDiff = Math.floor((today.getTime() - start.getTime()) / 86400000)`,
  `export function isDueToday(frequency: string, protocolStart: string, dayOfWeek: number | null, checkDateStr?: string): boolean {
  if (!protocolStart) return false
  const start = new Date(protocolStart + 'T00:00:00')
  const today = checkDateStr ? new Date(checkDateStr + 'T00:00:00') : new Date(); today.setHours(0,0,0,0)
  const daysDiff = Math.floor((today.getTime() - start.getTime()) / 86400000)`
);
content = content.replace(
  `  const todayDay = today.getDay()`,
  `  const todayDay = today.getDay()`
);
fs.writeFileSync('lib/utils.ts', content, 'utf8');
console.log('Done!');
