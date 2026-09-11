const fs = require('fs');
let content = fs.readFileSync('components/dashboard/HeroProtocolCard.tsx', 'utf8');

content = content.replace(
  `    // For each injection, find which phase was active on that date and use that dose
    const compoundLogs = allLogs.filter((l: any) => l.compound_id === activeCompound.id && l.taken)
    const allPhases = (activeCompound.phases || []).sort((a: any, b: any) => a.start_week - b.start_week)
    const protocolStart = new Date(activeProtocol.start_date + 'T00:00:00')

    let mlUsed = 0
    for (const log of compoundLogs) {
      const logDate = new Date(log.date + 'T00:00:00')
      const daysInAtLog = Math.max(0, Math.floor((logDate.getTime() - protocolStart.getTime()) / 86400000))
      const weekAtLog = Math.max(1, Math.floor(daysInAtLog / 7) + 1)
      const phaseAtLog = allPhases.find((ph: any) => weekAtLog >= ph.start_week && weekAtLog <= ph.end_week) || allPhases[0]
      if (!phaseAtLog) continue
      const mlForDose = phaseAtLog.dose_unit === 'IU'
        ? phaseAtLog.dose / 100
        : (vialStrength > 0 && bacWater > 0 ? (phaseAtLog.dose * 1000) / ((vialStrength * 1000) / bacWater) : 0)
      mlUsed += mlForDose
    }

    mlRemaining = Math.max(0, bacWater - mlUsed)
    fillPct = bacWater > 0 ? mlRemaining / bacWater : 1`,
  `    // Check localStorage for manual doses override first
    let totalDosesTaken = 0
    try {
      const override = localStorage.getItem('vial_inventory_' + activeCompound.id + '_doses')
      if (override !== null) {
        totalDosesTaken = parseInt(override)
      } else {
        // Fall back to injection logs
        totalDosesTaken = allLogs.filter((l: any) => l.compound_id === activeCompound.id && l.taken).length
      }
    } catch(e) {
      totalDosesTaken = allLogs.filter((l: any) => l.compound_id === activeCompound.id && l.taken).length
    }

    const mlPerDose = currentPhase.dose_unit === 'IU'
      ? currentPhase.dose / 100
      : (vialStrength > 0 && bacWater > 0 ? (currentPhase.dose * 1000) / ((vialStrength * 1000) / bacWater) : 0)

    const mlUsed = totalDosesTaken * mlPerDose
    mlRemaining = Math.max(0, bacWater - mlUsed)
    fillPct = bacWater > 0 ? mlRemaining / bacWater : 1`
);

fs.writeFileSync('components/dashboard/HeroProtocolCard.tsx', content, 'utf8');
console.log('Done! Fixed: ' + (content.includes('localStorage.getItem') ? 'yes' : 'NO'));
