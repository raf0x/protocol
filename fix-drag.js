const fs = require('fs');
let content = fs.readFileSync('app/protocol/page.tsx', 'utf8');

// Add drag scroll handler ref
content = content.replace(
  `const [activeCompoundTab, setActiveCompoundTab] = useState(null)`,
  `const [activeCompoundTab, setActiveCompoundTab] = useState(null)
  const tabRowRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragStartX = useRef(0)
  const scrollStartX = useRef(0)`
);

// Add useRef to imports
content = content.replace(
  `import { useState, useEffect } from 'react'`,
  `import { useState, useEffect, useRef } from 'react'`
);

// Add ref and mouse handlers to tab row div
content = content.replace(
  `display:'flex',gap:'6px',marginBottom:'12px',overflowX:'auto',paddingBottom:'4px',scrollbarWidth:'none',msOverflowStyle:'none'`,
  `display:'flex',gap:'6px',marginBottom:'12px',overflowX:'auto',paddingBottom:'4px',scrollbarWidth:'none',msOverflowStyle:'none',cursor:'grab'`
);

content = content.replace(
  `<div style={{display:'flex',gap:'6px',marginBottom:'12px',overflowX:'auto',paddingBottom:'4px',scrollbarWidth:'none',msOverflowStyle:'none',cursor:'grab'}}>`,
  `<div ref={tabRowRef} onMouseDown={(e)=>{isDragging.current=true;dragStartX.current=e.pageX;scrollStartX.current=tabRowRef.current!.scrollLeft;tabRowRef.current!.style.cursor='grabbing'}} onMouseMove={(e)=>{if(!isDragging.current)return;e.preventDefault();tabRowRef.current!.scrollLeft=scrollStartX.current-(e.pageX-dragStartX.current)}} onMouseUp={()=>{isDragging.current=false;if(tabRowRef.current)tabRowRef.current.style.cursor='grab'}} onMouseLeave={()=>{isDragging.current=false;if(tabRowRef.current)tabRowRef.current.style.cursor='grab'}} style={{display:'flex',gap:'6px',marginBottom:'12px',overflowX:'auto',paddingBottom:'4px',scrollbarWidth:'none',msOverflowStyle:'none',cursor:'grab',userSelect:'none'}}>`
);

fs.writeFileSync('app/protocol/page.tsx', content, 'utf8');
console.log('Done!');
