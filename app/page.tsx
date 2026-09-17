import type { Metadata } from 'next'
import HomeClient from './HomeClient'

export const metadata: Metadata = {
  description: 'Track protocols, labs, symptoms, weight, and journal notes in one private record. Health Briefing, Guided Health Analyst, and Doctor Report help you review what changed.',
}

export default function Page() {
  return <HomeClient />
}
