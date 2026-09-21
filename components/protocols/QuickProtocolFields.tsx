'use client'

type Fields = {
  vial_strength: string; vial_unit: string; isPreMixed: boolean; bac_water_ml: string
  dose: string; dose_unit: string; vials_in_stock: string; frequency_mode: 'weekly' | 'rolling'
  days_of_week: number[]; cycle_days: string; time_of_day: string; duration_weeks: string
}
export default function QuickProtocolFields({ value, onChange }: { value: Fields; onChange: (field: string, value: string | boolean | number[]) => void }) {
  const number = (field: keyof Fields, label: string, min = 0, step = 'any') => <label>{label}<input aria-label={label} type="number" min={min} step={step} value={String(value[field])} onChange={event => onChange(field, event.target.value)} /></label>
  const unit = (field: 'vial_unit' | 'dose_unit', label: string) => <label>{label}<select aria-label={label} value={value[field]} onChange={event => onChange(field, event.target.value)}><option value="">Choose a unit</option>{['mg','mcg','IU'].map(unit => <option key={unit}>{unit}</option>)}</select></label>
  return <div className="protocol-quick-fields">
    <div className="protocol-quick-grid">{number('vial_strength','Vial strength')}{unit('vial_unit','Vial strength unit')}</div>
    <label className="protocol-check"><input type="checkbox" checked={value.isPreMixed} onChange={event => onChange('isPreMixed',event.target.checked)} />Pre-mixed: no BAC water needed</label>
    {!value.isPreMixed && number('bac_water_ml','BAC water (mL)')}
    <div className="protocol-quick-grid">{number('dose','Medication dose per injection')}{unit('dose_unit','Medication dose unit')}</div>
    <p>Medication IU is not a syringe marking. Use Add more details for syringe markings or injection volume.</p>
    {number('vials_in_stock','Vials in stock',0,'1')}
    <label>Frequency<select aria-label="Frequency" value={value.frequency_mode} onChange={event => onChange('frequency_mode',event.target.value)}><option value="weekly">Weekly schedule</option><option value="rolling">Every N days</option></select></label>
    {value.frequency_mode === 'weekly' ? <fieldset><legend>Schedule</legend><div className="protocol-day-picker">{['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((day,index) => {
      const dayNumber = (index + 1) % 7, selected = value.days_of_week.includes(dayNumber)
      return <button type="button" key={day} aria-pressed={selected} onClick={() => onChange('days_of_week',selected ? value.days_of_week.filter(d => d !== dayNumber) : [...value.days_of_week,dayNumber])}>{day}</button>
    })}</div></fieldset> : number('cycle_days','Days between doses',1,'1')}
    <label>Time of day<select aria-label="Time of day" value={value.time_of_day} onChange={event => onChange('time_of_day',event.target.value)}><option value="">Choose a time</option>{['Morning','Afternoon','Evening','Night'].map(time => <option key={time}>{time}</option>)}</select></label>
    {number('duration_weeks','Duration (weeks, blank for ongoing)',1,'1')}
  </div>
}
