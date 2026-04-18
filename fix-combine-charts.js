const fs = require('fs');
let content = fs.readFileSync('app/journal/page.tsx', 'utf8');

content = content.replace(
  `            <p style={{fontSize:'11px',color:mg,marginBottom:'8px',letterSpacing:'1px',fontWeight:'600'}}>MOOD & ENERGY</p>
            <ResponsiveContainer width='100%' height={120}>
              <LineChart data={chartData}>
                <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} />
                <YAxis domain={[1,5]} tick={{fontSize:10,fill:mg}} width={20} />
                <Tooltip {...tooltipStyle} />
                <Line type='monotone' dataKey='mood' stroke={g} strokeWidth={2} dot={false} name='Mood' />
                <Line type='monotone' dataKey='energy' stroke='#f59e0b' strokeWidth={2} dot={false} name='Energy' />
              </LineChart>
            </ResponsiveContainer>
            <p style={{fontSize:'11px',color:mg,marginBottom:'8px',marginTop:'16px',letterSpacing:'1px',fontWeight:'600'}}>SLEEP</p>
            <ResponsiveContainer width='100%' height={100}>
              <LineChart data={chartData}>
                <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} />
                <YAxis tick={{fontSize:10,fill:mg}} width={20} />
                <Tooltip {...tooltipStyle} />
                <Line type='monotone' dataKey='sleep' stroke='#7fff7f' strokeWidth={2} dot={false} name='Sleep' />
              </LineChart>
            </ResponsiveContainer>`,
  `            <p style={{fontSize:'11px',color:mg,marginBottom:'8px',letterSpacing:'1px',fontWeight:'600'}}>MOOD, ENERGY & SLEEP</p>
            <ResponsiveContainer width='100%' height={140}>
              <LineChart data={chartData}>
                <XAxis dataKey='date' tick={{fontSize:10,fill:mg}} />
                <YAxis tick={{fontSize:10,fill:mg}} width={20} />
                <Tooltip {...tooltipStyle} />
                <Line type='monotone' dataKey='mood' stroke={g} strokeWidth={2} dot={false} name='Mood' />
                <Line type='monotone' dataKey='energy' stroke='#f59e0b' strokeWidth={2} dot={false} name='Energy' />
                <Line type='monotone' dataKey='sleep' stroke='#7fff7f' strokeWidth={2} dot={false} name='Sleep (hrs)' />
              </LineChart>
            </ResponsiveContainer>`
);

fs.writeFileSync('app/journal/page.tsx', content, 'utf8');
console.log('Done');
