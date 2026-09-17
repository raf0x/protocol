import type { Metadata } from 'next'
import CalculatorClient from './CalculatorClient'

export const metadata: Metadata = {
  title: 'Pep Calculator',
  description: 'Free peptide dose, vial concentration, and reconstitution calculator with syringe-unit conversion. No signup required.',
}

export default function Page() {
  return <CalculatorClient />
}
