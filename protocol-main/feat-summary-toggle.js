const fs = require('fs');

// Update WeeklySummary to accept a forceShow prop
let component = fs.readFileSync('components/dashboard/WeeklySummary.tsx', 'utf8');
component = component.replace(
  `type Props = {
  entries: Entry[]
  currentWeek: number
}`,
  `type Props = {
  entries: Entry[]
  currentWeek: number
  forceShow?: boolean
}`
);
component = component.replace(
  `  const isSunday = today.getDay() === 0
  if (!isSunday || entries.length < 3) return null`,
  `  const isSunday = today.getDay() === 0
  if ((!isSunday && !forceShow) || entries.length < 3) return null`
);
component = component.replace(
  `export default function WeeklySummary({ entries, currentWeek }: Props)`,
  `export default function WeeklySummary({ entries, currentWeek, forceShow }: Props)`
);
fs.writeFileSync('components/dashboard/WeeklySummary.tsx', component, 'utf8');
console.log('Updated WeeklySummary');

// Add showSummary state to protocol/page.tsx
let protocol = fs.readFileSync('app/protocol/page.tsx', 'utf8');
protocol = protocol.replace(
  `const [showChart, setShowChart] = useState(false)`,
  `const [showChart, setShowChart] = useState(false)
  const [showSummary, setShowSummary] = useState(false)`
);

// Replace the charts toggle row with a combined toggle row
protocol = protocol.replace(
  `        {/* Charts */}
        {entries.length > 1 && (<div style={{marginBottom:'16px'}}><button onClick={() => setShowChart(!showChart)} style={{width:'100%',background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>{showChart ? 'Hide charts' : 'Show charts'}</button></div>)}`,
  `        {/* Charts + Summary toggles */}
        {entries.length > 1 && (
          <div style={{display:'flex',gap:'8px',marginBottom:'16px'}}>
            <button onClick={() => setShowChart(!showChart)} style={{flex:1,background:cb,color:dg,border:'1px solid '+bd,borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>{showChart ? 'Hide charts' : 'Show charts'}</button>
            <button onClick={() => setShowSummary(!showSummary)} style={{flex:1,background:showSummary?'var(--color-green-10)':cb,color:showSummary?'var(--color-green)':dg,border:'1px solid '+(showSummary?'var(--color-green-30)':bd),borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:'600'}}>Week recap</button>
          </div>
        )}`
);

// Pass forceShow to WeeklySummary
protocol = protocol.replace(
  `        <WeeklySummary entries={entries} currentWeek={currentWeek} />`,
  `        <WeeklySummary entries={entries} currentWeek={currentWeek} forceShow={showSummary} />`
);

fs.writeFileSync('app/protocol/page.tsx', protocol, 'utf8');
console.log('Done!');
