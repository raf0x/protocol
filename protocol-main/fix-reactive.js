const fs = require('fs');

// Fix 1: HeroProtocolCard - make doses read reactive
let hero = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');

hero = hero.replace(
  `export default function HeroProtocolCard({ activeProtocols, activeCompoundTab, logs, allLogs, totalLost, compoundIndex }: Props) {`,
  `export default function HeroProtocolCard({ activeProtocols, activeCompoundTab, logs, allLogs, totalLost, compoundIndex }: Props) {
  const [dosesRefresh, setDosesRefresh] = React.useState(0)
  React.useEffect(() => {
    function onStorage(e: StorageEvent) { if (e.key?.includes('_doses')) setDosesRefresh(n => n + 1) }
    window.addEventListener('storage', onStorage)
    // Also listen for custom event from same tab
    function onDoses() { setDosesRefresh(n => n + 1) }
    window.addEventListener('doses_updated', onDoses)
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener('doses_updated', onDoses) }
  }, [])`
);

// Add React import
hero = hero.replace(
  `'use client'`,
  `'use client'
import React from 'react'`
);

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', hero, 'utf8');
console.log('HeroProtocolCard updated');

// Fix 2: VialInventory - dispatch event when doses saved
let inv = fs.readFileSync('components/dashboard/VialInventory.tsx', 'utf8');
inv = inv.replace(
  `  function saveDoses() {
    const val = parseInt(dosesInput)
    if (!isNaN(val) && val >= 0) {
      setDosesOverride(val)
      try { localStorage.setItem(key + '_doses', String(val)) } catch(e) {}
    }
    setEditingDoses(false)
  }`,
  `  function saveDoses() {
    const val = parseInt(dosesInput)
    if (!isNaN(val) && val >= 0) {
      setDosesOverride(val)
      try {
        localStorage.setItem(key + '_doses', String(val))
        window.dispatchEvent(new Event('doses_updated'))
      } catch(e) {}
    }
    setEditingDoses(false)
  }`
);

fs.writeFileSync('components/dashboard/VialInventory.tsx', inv, 'utf8');
console.log('VialInventory updated');
