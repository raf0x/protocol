const fs = require('fs');
let content = fs.readFileSync('app/community/cohorts/[id]/page.tsx', 'utf8');
content = content.replace(
  "export default function CohortPage({ params }: { params: { id: string } }) {",
  "export default function CohortPage({ params }: { params: Promise<{ id: string }> }) {"
);
content = content.replace(
  "  useEffect(() => { loadData() }, [])",
  "  useEffect(() => { loadData() }, [])\n  const [cohortId, setCohortId] = React.useState('')"
);
fs.writeFileSync('app/community/cohorts/[id]/page.tsx', content, 'utf8');
console.log('Done');
