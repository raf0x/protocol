const fs = require('fs');
const content = `export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ dose?: string; vial?: string; water?: string }> }): Promise<Metadata> {
  const params = await searchParams
  const dose = params.dose || ''
  const vial = params.vial || ''
  const water = params.water || ''
  const hasCalc = dose && vial && water && parseFloat(water) > 0 && parseFloat(vial) > 0 && parseFloat(dose) > 0

  let title = 'Peptide Calculator — Protocol'
  let description = 'Calculate exact syringe units for your peptide dose. Free, no signup required.'
  let ogUrl = 'https://www.mypepprotocol.app/api/og'

  if (hasCalc) {
    const totalMcg = parseFloat(vial) * 1000
    const concentration = totalMcg / parseFloat(water)
    const volumeMl = (parseFloat(dose) * 1000) / concentration
    const units = volumeMl * 100
    title = 'Draw ' + units.toFixed(1) + ' units | Protocol Calculator'
    description = dose + 'mg dose from a ' + vial + 'mg vial with ' + water + 'mL water = ' + units.toFixed(1) + ' units. Free calculator.'
    ogUrl = 'https://www.mypepprotocol.app/api/og?dose=' + dose + '&vial=' + vial + '&water=' + water
  }

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogUrl],
    },
  }
}

export default function CalculatorLayout({ children }: { children: React.ReactNode }) {
  return children
}`;
fs.writeFileSync('app/calculator/layout.tsx', content, 'utf8');
console.log('Done');
