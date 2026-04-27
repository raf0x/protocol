const fs = require('fs');
let content = fs.readFileSync('app/page.tsx', 'utf8');

content = content.replace(
  `import { useEffect, useState } from 'react'`,
  `import { useEffect, useState } from 'react'
import PeptideHoneycomb from '../components/PeptideHoneycomb'`
);

content = content.replace(
  `      {/* Old Way vs Protocol */}`,
  `      {/* Peptide Honeycomb */}
      <section style={{padding:'40px 0 60px',overflowX:'hidden'}}>
        <p className='scroll-hidden' style={{fontSize:'13px',color:'#3d3d5c',letterSpacing:'2px',fontWeight:'600',marginBottom:'8px',textAlign:'center'}}>THE PEPTIDE UNIVERSE</p>
        <h2 className='scroll-hidden stagger-1' style={{fontSize:'22px',fontWeight:'800',marginBottom:'6px',textAlign:'center',color:'white'}}>Track any compound in your stack</h2>
        <p className='scroll-hidden stagger-2' style={{fontSize:'14px',color:'#8b8ba7',marginBottom:'28px',textAlign:'center',padding:'0 24px'}}>Protocol supports every major peptide and GLP-1. Your data stays private.</p>
        <div className='scroll-hidden stagger-3'>
          <PeptideHoneycomb />
        </div>
      </section>

      {/* Old Way vs Protocol */}`
);

fs.writeFileSync('app/page.tsx', content, 'utf8');
console.log('Done!');
