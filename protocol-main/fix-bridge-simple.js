const fs = require('fs');
let content = fs.readFileSync('app/calculator/page.tsx', 'utf8');

// Replace router navigation with just showing success
content = content.replace(
  "    router.push('/protocol')",
  "    setSaveSuccess(true); setShowSaveFlow(false)"
);

// Add saveSuccess state back
content = content.replace(
  "  const [showSaveFlow, setShowSaveFlow] = useState(false)",
  "  const [showSaveFlow, setShowSaveFlow] = useState(false)\n  const [saveSuccess, setSaveSuccess] = useState(false)"
);

// Remove router import and hook if they exist
content = content.replace("import { useRouter } from 'next/navigation'\n", "");
content = content.replace("  const router = useRouter()\n", "");

// Add success message in the UI after the save flow
content = content.replace(
  "          )}\n\n",
  `          )}

          {saveSuccess && (
            <div style={{marginTop:'16px',paddingTop:'16px',borderTop:'1px solid '+bd,textAlign:'center'}}>
              <span style={{color:g,fontSize:'16px',fontWeight:'700'}}>✓ Saved!</span>
              <p style={{fontSize:'13px',color:dg,marginTop:'6px'}}>Tap <strong>Dashboard</strong> below to see your new protocol.</p>
            </div>
          )}

`
);

fs.writeFileSync('app/calculator/page.tsx', content, 'utf8');
console.log('Done');
