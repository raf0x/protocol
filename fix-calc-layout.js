const fs = require('fs');
const content = `import type { Metadata } from 'next'

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ dose?: string; vial?: string; water?: string }> }): Promise<Metadata> {
  const params = await searchParams
  const dose = params.dose || ''
  const vial = params.vial || ''
  const water = params.water || ''
  const hasCalc = dose && vial && water

  const totalMcg = parseFloat(vial) * 1000
  const concentration = totalMcg / parseFloat(water)
  const volumeMl = (parseFloat(dose) * 1000) / concentration
  const units = volumeMl * 100

  const title = hasCalc
    ? 'Draw ' + units.toFixed(1) + ' units — ' + dose + 'mg from ' + vial + 'mg vial | Protocol Calculator'
    : 'Peptide Calculator — Protocol'

  const description = hasCalc
    ? dose + 'mg dose from a ' + vial + 'mg vial with ' + water + 'mL water = ' + units.toFixed(1) + ' units (' + volumeMl.toFixed(3) + ' mL). Free calculator at mypepprotocol.app'
    : 'Calculate exact syringe units for your peptide dose. Free, no signup required.'

  const ogUrl = hasCalc
    ? process.env.NEXT_PUBLIC_SITE_URL + '/api/og?dose=' + dose + '&vial=' + vial + '&water=' + water
    : process.env.NEXT_PUBLIC_SITE_URL + '/api/og'

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
