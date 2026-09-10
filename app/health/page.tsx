import { Suspense } from 'react'
import HealthDashboard from '../../components/health/HealthDashboard'

export default function HealthPage() {
  return <Suspense fallback={<p role="status">Loading Health…</p>}><HealthDashboard /></Suspense>
}
