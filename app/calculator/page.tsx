'use client'

import { useState } from 'react'

export default function ReconstitutionCalculator() {
  const [peptideAmount, setPeptideAmount] = useState('')
  const [bacWater, setBacWater] = useState('')
  const [desiredDose, setDesiredDose] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  function calculate() {
    setError('')
    setResult(null)
    const peptide = parseFloat(peptideAmount)
    const water = parseFloat(bacWater)
    const dose = parseFloat(desiredDose)
    if (isNaN(peptide) || isNaN(water) || isNaN(dose)) {
      setError('Please fill in all three fields with numbers.')
      return
    }
    if (peptide <= 0 || water <= 0 || dose <= 0) {
      setError('All values must be greater than zero.')
      return
    }
    const peptideMcg = peptide * 1000
    if (dose > peptideMcg) {
      setError('Your desired dose (' + dose + ' mcg) is larger than the total peptide in the vial (' + peptideMcg + ' mcg). Check your numbers.')
      return
    }
    const concentration = peptideMcg / water
    const volumeMl = dose / concentration
    const syringeUnits = volumeMl * 100
    setResult({ concentration, volumeMl, syringeUnits })
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-md mx-auto">
        <a href="/" className="text-sm text-gray-500 hover:text-gray-300 mb-6 block">
          Back to home
        </a>
        <h1 className="text-2xl font-bold mb-1">Reconstitution Calculator</h1>
        <p className="text-gray-400 text-sm mb-6">
          Enter your vial details below to find out how many units to draw.
          This tool does not provide medical advice - always verify your calculations.
        </p>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Peptide vial amount</label>
            <p className="text-xs text-gray-500 mb-1">The amount printed on your vial - usually 2 mg, 5 mg, or 10 mg.</p>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="any" value={peptideAmount} onChange={(e) => setPeptideAmount(e.target.value)} placeholder="e.g. 5" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
              <span className="text-gray-400 text-sm w-8">mg</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Bacteriostatic water added</label>
            <p className="text-xs text-gray-500 mb-1">How much BAC water you injected into the vial.</p>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="any" value={bacWater} onChange={(e) => setBacWater(e.target.value)} placeholder="e.g. 2" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
              <span className="text-gray-400 text-sm w-8">mL</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Desired dose</label>
            <p className="text-xs text-gray-500 mb-1">The dose you want to take. Note: 1 mg = 1,000 mcg.</p>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="any" value={desiredDose} onChange={(e) => setDesiredDose(e.target.value)} placeholder="e.g. 250" className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500" />
              <span className="text-gray-400 text-sm w-8">mcg</span>
            </div>
          </div>
          <button onClick={calculate} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded">
            Calculate
          </button>
        </div>
        {error && (
          <div className="mt-5 bg-red-950 border border-red-800 rounded p-3 text-sm text-red-300">
            {error}
          </div>
        )}
        {result && (
          <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-5">
            <h2 className="font-semibold text-base mb-4">Results</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Solution concentration</span>
                <span>{result.concentration.toFixed(2)} mcg / mL</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-400">Volume to draw</span>
                <span>{result.volumeMl.toFixed(3)} mL</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t border-gray-700">
                <span className="text-gray-300 font-medium">Draw to this line on syringe</span>
                <span className="text-blue-400 font-bold text-xl">{result.syringeUnits.toFixed(1)} units</span>
              </div>
            </div>
            <p className="text-xs text-gray-600 mt-4">
              Calculated for a standard U-100 insulin syringe. This is a reference tool only. Not medical advice.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
