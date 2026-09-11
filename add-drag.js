const fs = require('fs');
let content = fs.readFileSync('components/dashboard/WeeklySchedule.tsx', 'utf8');

// Add drag state and handlers
content = content.replace(
  `  const [logs, setLogs] = useState<Record<string,boolean>>({})
  const [loading, setLoading] = useState(true)`,
  `  const [logs, setLogs] = useState<Record<string,boolean>>({})
  const [loading, setLoading] = useState(true)
  const [order, setOrder] = useState<string[]>([])
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)`
);

// Initialize order when compounds change
content = content.replace(
  `  useEffect(() => {`,
  `  useEffect(() => {
    if (compounds.length > 0 && order.length === 0) {
      setOrder(compounds.map(c => c.id))
    }
  }, [compounds.length])

  useEffect(() => {`
);

// Add save order function after toggleLog
content = content.replace(
  `  function isDueOnDate(compound: Compound, date: Date): boolean {`,
  `  async function saveOrder(newOrder: string[]) {
    const supabase = createClient()
    for (let i = 0; i < newOrder.length; i++) {
      await supabase.from('compounds').update({ position: i }).eq('id', newOrder[i])
    }
  }

  function handleDragStart(id: string) {
    setDraggingId(id)
  }

  function handleDragOver(e: React.DragEvent, id: string) {
    e.preventDefault()
    if (id !== draggingId) setDragOverId(id)
  }

  function handleDrop(id: string) {
    if (!draggingId || draggingId === id) { setDraggingId(null); setDragOverId(null); return }
    const currentOrder = order.length > 0 ? order : compounds.map(c => c.id)
    const from = currentOrder.indexOf(draggingId)
    const to = currentOrder.indexOf(id)
    const newOrder = [...currentOrder]
    newOrder.splice(from, 1)
    newOrder.splice(to, 0, draggingId)
    setOrder(newOrder)
    setDraggingId(null)
    setDragOverId(null)
    saveOrder(newOrder)
  }

  // Touch drag support
  function handleTouchStart(e: React.TouchEvent, id: string) {
    setDraggingId(id)
  }

  function handleTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    const touch = e.touches[0]
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const row = el?.closest('[data-compound-id]')
    const overId = row?.getAttribute('data-compound-id')
    if (overId && overId !== draggingId) setDragOverId(overId)
  }

  function handleTouchEnd() {
    if (draggingId && dragOverId) handleDrop(dragOverId)
    setDraggingId(null)
    setDragOverId(null)
  }

  function isDueOnDate(compound: Compound, date: Date): boolean {`
);

// Sort compounds by order
content = content.replace(
  `  if (loading || compounds.length === 0) return null`,
  `  if (loading || compounds.length === 0) return null
  const sortedCompounds = order.length > 0
    ? [...compounds].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
    : compounds`
);

// Replace compounds.map with sortedCompounds.map in tbody
content = content.replace(
  `            {compounds.map((compound) => (
              <tr key={compound.id} style={{borderTop:'1px solid '+bd}}>
                <td style={{padding:'8px 10px',fontSize:'11px',fontWeight:'700',color:'var(--color-text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'80px'}}>{compound.name.split('/')[0].split(' ')[0]}</td>`,
  `            {sortedCompounds.map((compound) => (
              <tr
                key={compound.id}
                data-compound-id={compound.id}
                draggable
                onDragStart={() => handleDragStart(compound.id)}
                onDragOver={e => handleDragOver(e, compound.id)}
                onDrop={() => handleDrop(compound.id)}
                onDragEnd={() => { setDraggingId(null); setDragOverId(null) }}
                onTouchStart={e => handleTouchStart(e, compound.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{
                  borderTop:'1px solid '+bd,
                  opacity: draggingId === compound.id ? 0.4 : 1,
                  background: dragOverId === compound.id ? 'var(--color-green-05)' : 'transparent',
                  transition:'opacity 0.15s, background 0.15s',
                  cursor:'grab'
                }}
              >
                <td style={{padding:'8px 10px',fontSize:'11px',fontWeight:'700',color:'var(--color-text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',maxWidth:'80px'}}>
                  <span style={{marginRight:'4px',opacity:0.3,fontSize:'10px'}}>\u2195</span>
                  {compound.name.split('/')[0].split(' ')[0]}
                </td>`
);

fs.writeFileSync('components/dashboard/WeeklySchedule.tsx', content, 'utf8');
console.log('Done!');
