const fs = require('fs');
let content = fs.readFileSync('app/community/cohorts/[id]/page.tsx', 'utf8');

// Add search and filter state after existing state declarations
content = content.replace(
  "  const [userId, setUserId] = useState('')",
  "  const [userId, setUserId] = useState('')\n  const [search, setSearch] = useState('')\n  const [filterTag, setFilterTag] = useState('')"
);

// Add filtered posts computed value before return
content = content.replace(
  "  if (loading) return",
  "  const filteredPosts = posts.filter(post => {\n    const matchesTag = filterTag === '' || post.tag === filterTag\n    const matchesSearch = search === '' || post.content.toLowerCase().includes(search.toLowerCase()) || post.username.toLowerCase().includes(search.toLowerCase())\n    return matchesTag && matchesSearch\n  })\n\n  if (loading) return"
);

// Add search bar and tag filters before the post list - after the moderation warning div
content = content.replace(
  "        {posts.length === 0 && <div",
  "        <div style={{marginBottom:'16px'}}>\n          <input value={search} onChange={e => setSearch(e.target.value)} placeholder='Search posts...' style={{width:'100%',background:'#12121a',border:'1px solid #1e1e2e',borderRadius:'6px',padding:'8px 12px',color:'white',fontSize:'14px',boxSizing:'border-box',outline:'none',marginBottom:'8px'}} />\n          <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>\n            {['', 'observation', 'side effect', 'question', 'milestone'].map(t => (\n              <button key={t} onClick={() => setFilterTag(t)} style={{background:filterTag===t?'#1a1a3e':'none',border:'1px solid '+(filterTag===t?'#6c63ff':'#1e1e2e'),color:filterTag===t?'#6c63ff':'#3d3d5c',fontSize:'11px',padding:'4px 10px',borderRadius:'4px',cursor:'pointer'}}>{t === '' ? 'All' : t}</button>\n            ))}\n          </div>\n        </div>\n        {filteredPosts.length === 0 && search === '' && filterTag === '' && <div"
);

// Replace posts.map with filteredPosts.map
content = content.replace(
  "        {posts.map(post => (",
  "        {filteredPosts.map(post => ("
);

// Fix the old posts.length === 0 check
content = content.replace(
  "        {posts.length === 0 && <div style={{textAlign:'center',padding:'48px 0'}}><p style={{color:dg}}>No posts yet.</p><p style={{color:mg,fontSize:'13px'}}>Be the first to share an experience.</p></div>}",
  "        {filteredPosts.length === 0 && <div style={{textAlign:'center',padding:'48px 0'}}><p style={{color:'#8b8ba7'}}>{search || filterTag ? 'No posts match your filter.' : 'No posts yet.'}</p>{!search && !filterTag && <p style={{color:'#3d3d5c',fontSize:'13px'}}>Be the first to share an experience.</p>}</div>}"
);

fs.writeFileSync('app/community/cohorts/[id]/page.tsx', content, 'utf8');
console.log('Done');
