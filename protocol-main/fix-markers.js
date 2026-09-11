const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

// Add ReferenceLine import
content = content.replace(
  "import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'",
  "import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'"
);

// Compute protocol markers after chartData
content = content.replace(
  "  const tooltipStyle = { contentStyle: { background: cb, border: '1px solid '+bd, borderRadius: '6px', fontSize: '12px' } }",
  `  const tooltipStyle = { contentStyle: { background: cb, border: '1px solid '+bd, borderRadius: '6px', fontSize: '12px' } }

  // Protocol timeline markers
  const markers: { date: string; label: string }[] = []
  activeProtocols.forEach((p: any) => {
    const startLabel = new Date(p.start_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    ;(p.compounds || []).forEach((c: any) => {
      markers.push({ date: startLabel, label: c.name })
      const sortedPhases = (c.phases || []).slice().sort((a: any, b: any) => a.start_week - b.start_week)
      sortedPhases.forEach((ph: any, i: number) => {
        if (i === 0) return
        const phaseStartDay = (ph.start_week - 1) * 7
        const phaseDate = new Date(new Date(p.start_date + 'T00:00:00').getTime() + phaseStartDay * 86400000)
        const phaseLabel = phaseDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        markers.push({ date: phaseLabel, label: c.name + ' → ' + ph.dose + ph.dose_unit })
      })
    })
  })`
);

// Add ReferenceLine markers to the mood/energy/sleep chart
content = content.replace(
  "                <Line type='monotone' dataKey='mood' stroke={g} strokeWidth={2} dot={false} name='Mood' />",
  `                {markers.map((m, i) => <ReferenceLine key={'m1_'+i} x={m.date} stroke='#6c63ff' strokeDasharray='4 4' strokeOpacity={0.5} label={{value: m.label, position: 'top', fontSize: 9, fill: '#6c63ff'}} />)}
                <Line type='monotone' dataKey='mood' stroke={g} strokeWidth={2} dot={false} name='Mood' />`
);

// Add ReferenceLine markers to the weight chart
content = content.replace(
  "                  <Line type='monotone' dataKey='weight' stroke='#8b5cf6' strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} name='Weight' />",
  `                  {markers.map((m, i) => <ReferenceLine key={'m2_'+i} x={m.date} stroke='#6c63ff' strokeDasharray='4 4' strokeOpacity={0.5} />)}
                  <Line type='monotone' dataKey='weight' stroke='#8b5cf6' strokeWidth={2} dot={{ r: 3, fill: '#8b5cf6' }} name='Weight' />`
);

fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
