// User entries are authoritative; calculated equivalents are advisory, never guesses.
export type EntryMode = 'medication' | 'syringe' | 'volume' | 'unknown'
export type DosingEntry = {
  is_premixed?: boolean; version: 2; mode: EntryMode; review_status: 'unverified' | 'confirmed'
  dose: string; dose_unit: string; syringe_markings: string; syringe_scale: string
  injection_volume: string; vial_strength: string; vial_unit: string; bac_water_ml: string
  concentration_value: string; concentration_unit: string; vial_label: string
}
const numericFields = ['dose','syringe_markings','syringe_scale','injection_volume','vial_strength','bac_water_ml','concentration_value'] as const
export function validateEntry(entry: DosingEntry) {
  if (entry.version !== 2 || !['medication','syringe','volume','unknown'].includes(entry.mode)) throw new Error('Invalid dosing entry mode.')
  for (const key of numericFields) {
    const value=entry[key]
    if (typeof value !== 'string') throw new Error(`${key}: enter a number or leave blank.`)
    if (value.trim() && (!Number.isFinite(Number(value)) || Number(value)<0 || (key==='syringe_scale' && Number(value)===0))) throw new Error(`${key}: enter a valid non-negative number${key==='syringe_scale' ? ' with a positive scale' : ''}.`)
  }
}
export function entryFromForm(form: Record<string, unknown>): DosingEntry {
  const str=(key:string)=>typeof form[key]==='string' ? form[key] as string : ''
  const entry: DosingEntry={is_premixed:form.isPreMixed===true,version:2,mode:(str('input_mode') || 'unknown') as EntryMode,review_status:form.reviewed ? 'confirmed':'unverified',dose:str('dose'),dose_unit:str('dose_unit'),syringe_markings:str('syringe_markings'),syringe_scale:str('syringe_scale'),injection_volume:str('injection_volume'),vial_strength:str('vial_strength'),vial_unit:str('vial_unit'),bac_water_ml:str('bac_water_ml'),concentration_value:str('concentration_value'),concentration_unit:str('concentration_unit'),vial_label:str('vial_label')}
  // Preserve all inputs, including incomplete or conflicting preparation fields.
  validateEntry(entry); return entry
}
export function interpretEntry(entry: DosingEntry) {
  validateEntry(entry)
  const n=(s:string)=>s.trim() ? Number(s) : null
  const units=['mg','mcg','IU']
  const warnings:string[]=[]
  let concentration: {value:number;unit:string}|null=null
  const cv=n(entry.concentration_value), vial=n(entry.vial_strength), water=n(entry.bac_water_ml)
  if(cv!=null || entry.concentration_unit) {
    if(cv!=null && cv>0 && ['mg/mL','mcg/mL','IU/mL'].includes(entry.concentration_unit)) concentration={value:cv,unit:entry.concentration_unit.slice(0,-3)}
    else warnings.push('Add the complete labelled concentration to calculate equivalents.')
  } else if(vial!=null && vial>0 && water!=null && water>0 && units.includes(entry.vial_unit)) concentration={value:vial/water,unit:entry.vial_unit}
  else warnings.push('Add vial strength and reconstitution volume, or labelled concentration, to calculate equivalents.')
  let medication: {value:number;unit:string}|null=null
  let volume:number|null=null, markings:number|null=null
  const scale=n(entry.syringe_scale)
  if(entry.mode==='medication' && n(entry.dose)!=null && units.includes(entry.dose_unit)) medication={value:n(entry.dose)!,unit:entry.dose_unit}
  if(entry.mode==='volume') volume=n(entry.injection_volume)
  if(entry.mode==='syringe' || entry.mode==='unknown') {
    markings=n(entry.syringe_markings)
    if(markings!=null && scale!=null && scale>0) volume=markings/scale
    else if(markings!=null) warnings.push('Add your syringe scale to calculate liquid volume.')
  }
  if(entry.mode==='unknown') warnings.push('Unverified dose semantics. Your original entry is preserved.')
  if(medication && concentration) {
    if((medication.unit==='IU') !== (concentration.unit==='IU')) warnings.push('Medication and concentration units differ. Both entries are saved; no IU-to-mass conversion was made.')
    else volume=medication.value*(medication.unit===concentration.unit ? 1 : medication.unit==='mg' ? 1000 : .001)/concentration.value
  } else if(volume!=null && concentration) {
    // Unknown entries offer a candidate; user confirmation is needed to promote it.
    if(entry.mode!=='unknown' || entry.review_status==='confirmed') medication={value:volume*concentration.value,unit:concentration.unit}
  }
  const candidate=volume!=null && concentration ? {value:volume*concentration.value,unit:concentration.unit} : null
  if(volume!=null && scale!=null && scale>0 && markings==null) markings=volume*scale
  if(!medication) warnings.push('Medication dose not calculated.')
  // Reject arithmetic overflow as invalid rather than presenting Infinity.
  if([volume,markings,medication?.value,candidate?.value].some(v=>v!=null && !Number.isFinite(v))) throw new Error('Values are too large to calculate reliably.')
  return {medication,volume,markings,scale,concentration,candidate,warnings,status:entry.mode==='unknown' && entry.review_status!=='confirmed' ? 'unverified' : warnings.length ? 'incomplete':'calculated'}
}
export function entryFormState(phase?: {dosing_entry?:DosingEntry|null;dose?:number|string|null;dose_unit?:string|null;dose_semantics_version?:number|null;syringe_scale?:number|null}) {
  const e=phase?.dosing_entry
  return e ? {...e,isPreMixed:e.is_premixed===true,input_mode:e.mode,reviewed:e.review_status==='confirmed',legacy_value:e.mode==='unknown' ? e.dose : ''} : {
    input_mode:phase && phase.dose_semantics_version!==1 ? 'unknown' as const:'medication' as const,
    dose:phase?.dose?.toString() || '',dose_unit:phase?.dose_unit || '',syringe_markings:'',syringe_scale:phase?.syringe_scale?.toString() || '',injection_volume:'',vial_label:'',reviewed:phase?.dose_semantics_version===1,legacy_value:phase?.dose?.toString() || ''}
}
export function dosingDisplay(phase?: {dosing_entry?:DosingEntry|null;dose?:number|string|null;dose_unit?:string|null;dose_semantics_version?:number|null}|null) {
  if(!phase) return {primary:'Dose not entered',secondary:'No current phase',medication:null}
  if(phase.dosing_entry) {
    try {
      const r=interpretEntry(phase.dosing_entry), fmt=(v:number)=>Number(v.toPrecision(6))
      const admin=r.markings!=null ? `${fmt(r.markings)} ${r.scale ? `U-${r.scale} units`:'syringe units'}` : r.volume!=null ? `${fmt(r.volume)} mL` : 'Dose not fully calculated yet'
      return {primary:r.medication ? `${fmt(r.medication.value)} ${r.medication.unit}`:admin,secondary:r.warnings.join(' '),medication:r.medication}
    } catch {return {primary:'Unverified dosing entry',secondary:'Check the saved dosing values.',medication:null}}
  }
  return phase.dose_semantics_version===1 ? {primary:`${phase.dose} ${phase.dose_unit}`,secondary:'',medication:{value:Number(phase.dose),unit:phase.dose_unit || ''}} : {primary:'Unverified dose semantics',secondary:`Stored value: ${phase.dose ?? ''} ${phase.dose_unit ?? ''}`,medication:null}
}
export function validDate(value:string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value
}

export function quickEntryPayload(body:Record<string,unknown>) {
  if(typeof body.name!=='string' || !body.name.trim() || body.name.length>100) throw new Error('Enter a compound name.')
  const field=(key:string)=>body[key]==null ? '' : String(body[key])
  const entry=entryFromForm({input_mode:'medication',dose:field('dose'),dose_unit:field('dose_unit'),vial_strength:field('vial'),vial_unit:field('vial_unit'),bac_water_ml:field('water'),concentration_value:field('concentration_value'),concentration_unit:field('concentration_unit'),syringe_scale:field('syringe_scale')})
  const frequency=body.frequency ?? ''
  if(typeof frequency!=='string' || (frequency && !/^(daily|[1-7]x\/week|every[1-7]days)$/.test(frequency))) throw new Error('Invalid frequency.')
  return {name:body.name.trim(),compounds:[{name:body.name.trim(),phase:{name:'Phase 1',dosing_entry:entry,start_week:1,end_week:null,frequency}}]}
}

export function administrationForPhase(phase?: {dosing_entry?:DosingEntry|null;dose_semantics_version?:number|null;injection_volume_ml?:number|null;syringe_units?:number|null}|null) {
  if(phase?.dosing_entry) {try {const r=interpretEntry(phase.dosing_entry);return {volume:r.volume,markings:r.markings}} catch {return {volume:null,markings:null}}}
  return {volume:phase?.dose_semantics_version===1 ? phase.injection_volume_ml ?? null:null,markings:phase?.dose_semantics_version===1 ? phase.syringe_units ?? null:null}
}
