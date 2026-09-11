const fs = require('fs');

// Create a simple in-memory rate limiter utility
const limiter = [
"// Simple rate limiter for API routes",
"// Uses in-memory store - resets on server restart",
"// Good enough for Vercel serverless (per-instance limiting)",
"",
"const store = new Map<string, { count: number; resetAt: number }>()",
"",
"export function rateLimit(key: string, limit: number, windowMs: number): boolean {",
"  const now = Date.now()",
"  const entry = store.get(key)",
"  if (!entry || now > entry.resetAt) {",
"    store.set(key, { count: 1, resetAt: now + windowMs })",
"    return true // allowed",
"  }",
"  if (entry.count >= limit) return false // blocked",
"  entry.count++",
"  return true // allowed",
"}",
];

fs.writeFileSync('lib/rateLimit.ts', limiter.join('\n'), 'utf8');
console.log('Created lib/rateLimit.ts');

// Add rate limiting to cron route
let cron = fs.readFileSync('app/api/cron/route.ts', 'utf8');
cron = cron.replace(
  `export async function GET(request: NextRequest) {`,
  `import { rateLimit } from '../../../lib/rateLimit'

export async function GET(request: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const ip = request.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit('cron:' + ip, 10, 60000)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
  }`
);
fs.writeFileSync('app/api/cron/route.ts', cron, 'utf8');
console.log('Rate limited cron route');

// Add rate limiting to OG image route
let og = fs.readFileSync('app/api/og/route.tsx', 'utf8');
og = og.replace(
  `export async function GET(request: Request) {`,
  `import { rateLimit } from '../../../lib/rateLimit'

export async function GET(request: Request) {
  const ip = (request as any).headers?.get?.('x-forwarded-for') || 'unknown'
  if (!rateLimit('og:' + ip, 30, 60000)) {
    return new Response('Too many requests', { status: 429 })
  }`
);
fs.writeFileSync('app/api/og/route.tsx', og, 'utf8');
console.log('Rate limited OG route');
