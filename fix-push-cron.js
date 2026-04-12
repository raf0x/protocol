const fs = require('fs');
let content = fs.readFileSync('app/api/push/route.ts', 'utf8');
content = content.replace(
  "export async function GET(request: NextRequest) {\n  const authHeader = request.headers.get('x-user-id')\n  if (authHeader !== '41266062-c8a7-4a52-aa9b-c1fb96d1c483') {\n    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })\n  }",
  "export async function GET(request: NextRequest) {\n  const userId = request.headers.get('x-user-id')\n  const cronSecret = request.headers.get('authorization')\n  const isAdmin = userId === '41266062-c8a7-4a52-aa9b-c1fb96d1c483'\n  const isCron = cronSecret === `Bearer ${process.env.CRON_SECRET}`\n  if (!isAdmin && !isCron) {\n    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })\n  }"
);
fs.writeFileSync('app/api/push/route.ts', content, 'utf8');
console.log('Done');
