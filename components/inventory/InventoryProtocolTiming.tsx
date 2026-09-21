'use client'

import type { InventoryProtocolTiming as Timing } from '../../lib/inventory/protocol'

export default function InventoryProtocolTiming({ value, onChange, disabled }: {
  value: Timing; onChange: (value: Timing) => void; disabled: boolean
}) {
  return <fieldset className="protocol-use-choice" disabled={disabled}>
    <legend>When should this protocol begin?</legend>
    <div className="protocol-use-options">
      {([
        ['today', 'Start today', 'Active today, using your local calendar.'],
        ['scheduled', 'Schedule for later', 'Choose a future date. Tracking begins automatically.'],
        ['planned', 'Save as Planned', 'No start date. Activate or schedule it when you are ready.'],
      ] as const).map(([timing, title, help]) => <label className="protocol-use-option" key={timing}>
        <input type="radio" name="inventory-protocol-timing" value={timing} checked={value === timing}
          onChange={() => onChange(timing)} aria-describedby={`inventory-${timing}-help`} />
        <span><strong>{title}</strong><small id={`inventory-${timing}-help`}>{help}</small></span>
      </label>)}
    </div>
  </fieldset>
}
