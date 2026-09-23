import Link from 'next/link'

export default function EmptyProtocolRings() {
  return <div className="protocol-empty-rings">
    <Link href="/protocol/manage?new=1" aria-label="Add your first protocol" className="today-text-link">
      <svg viewBox="0 0 260 145" width="260" style={{maxWidth:'100%',height:'auto'}} aria-hidden="true">
        {[[50,48],[130,48],[210,48],[90,98],[170,98]].map(([cx,cy],i) => <circle key={i} cx={cx} cy={cy} r="39" fill="none" stroke={['#39ff14','#6c63ff','#06b6d4','#f59e0b','#f43f5e'][i]} strokeWidth="3" opacity="0.55" />)}
        <path d="M122 48h16m-8-8v16" stroke="currentColor" strokeWidth="2" />
      </svg>
      <span>Add your first protocol</span>
    </Link>
    <p>Choose a compound, then confirm when you’ll start.</p>
  </div>
}
