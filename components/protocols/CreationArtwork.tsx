'use client'
import EnhancedVial from '../today/EnhancedVial'
import { entryFromForm } from '../../lib/health/dosingEntry'
import { preparationPresentation } from '../../lib/health/preparationPresentation'
import { measurementPreview } from '../../lib/protocols/creationMeasurement'
import type { Compound } from '../../lib/protocols/form'

/** Decoration explains recorded state; never depicts an inferred balance or syringe draw. */
export default function CreationArtwork({ value: c, stage }: { value: Compound; stage: 'preparation' | 'measurement' | 'review' }) {
  const amount = preparationPresentation({}, { dosing_entry: c }).amount
  let preview: ReturnType<typeof measurementPreview> | null = null
  try { preview = measurementPreview(entryFromForm(c)) } catch { /* Incomplete drafts remain editable. */ }
  const calibration = c.syringe_scale === '100' ? 100 : c.syringe_scale === '40' ? 40 : null
  const confirmed = Boolean(preview?.medication)
  const preparationRecorded = c.preparation === 'ready' ? Boolean(c.concentration_value && c.concentration_unit) : Boolean(amount)
  return <aside className={`creation-stage-visual creation-stage-${stage}`} data-prepared={preparationRecorded} aria-label={stage === 'measurement' ? 'Measurement illustration' : 'Preparation illustration'}>
    {stage === 'measurement' && c.route !== 'Oral' ? <figure className="creation-syringe">
      <svg viewBox="0 0 240 84" role="img" aria-label={calibration ? `U-${calibration} calibration reference, no liquid level` : 'Syringe schematic, calibration not selected'}>
        <defs><linearGradient id="creation-syringe-glass" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d7f3f2" stopOpacity=".42"/><stop offset=".5" stopColor="#68a9bf" stopOpacity=".1"/><stop offset="1" stopColor="#8fb4c4" stopOpacity=".32"/></linearGradient></defs>
        <path d="M199 42H232" stroke="#b9d7e3" strokeWidth="2" strokeLinecap="round"/>
        <path d="M180 32H198V52H180" fill="#3d7188" stroke="#a6dce4"/>
        <rect x="42" y="26" width="140" height="32" rx="5" fill="url(#creation-syringe-glass)" stroke="#a6dce4"/>
        <path d="M41 20V64M16 30V54M17 42H40" stroke="#b8d3e1" strokeWidth="3" strokeLinecap="round"/>
        {[0,1,2,3,4,5].map(i => <g key={i}><path d={`M${58+i*22} 28V${i%2 ? 36 : 40}`} className="creation-syringe-tick" stroke="var(--creation-syringe-tick, #c1e7ed)"/>{calibration && <text x={58+i*22} y="51" textAnchor="middle" className="creation-syringe-number" fill="var(--creation-syringe-number, #e6f4f6)" fontSize="9">{i * calibration / 10}</text>}</g>)}
      </svg>
      <figcaption>{calibration ? `U-${calibration} · ${calibration} markings/mL` : 'Syringe reference'}<small>Schematic only. No fill level shown.</small></figcaption>
    </figure> : <EnhancedVial name={c.name || 'Your compound'} strength={amount?.value} unit={amount?.unit} strengthLabel={c.name || 'Your compound'} remainingFraction={null} remainingMl={null} presentation="onboarding" />}
    <div className="creation-visual-copy"><span className="creation-eyebrow">{stage === 'review' ? 'Your protocol' : stage === 'measurement' ? 'Your measurement' : 'Your preparation'}</span>
      <strong key={`${stage}-${c.name}-${c.vial_strength}-${c.vial_unit}-${c.preparation}`} className="creation-label-transition">{stage === 'review' ? 'Ready to review' : stage === 'measurement' ? confirmed ? 'Facts checked' : 'Keep it in your units' : c.name || 'A clear start'}</strong>
      <p>{stage === 'review' ? 'Your entries stay separate from calculated equivalents.' : stage === 'measurement' ? confirmed && c.input_mode === 'syringe' ? `${c.syringe_markings} recorded markings. See the equivalent below.` : 'Record your intended amount. No dose is selected for you.' : preparationRecorded ? 'Preparation details entered. Remaining amount is not tracked.' : 'Just the facts from your vial, one question at a time.'}</p>
    </div>
  </aside>
}
