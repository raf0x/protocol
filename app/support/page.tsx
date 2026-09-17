import type { Metadata } from 'next'
import SupportClient from './SupportClient'

export const metadata: Metadata = {
  title: 'Support',
  description: 'Contact MyPepProtocol support with questions or requests. We respond within 24 hours.',
}

export default function Page() {
  return <SupportClient />
}
