export type PhaseBoundary = {id:string;start_week:number|null;end_week:number|null}
export function phaseEndWeek(start:number,duration:string):number|null {
  if(!Number.isInteger(start) || start<1) throw new Error('Enter a valid phase start week.')
  if(!duration.trim()) return null
  const count=Number(duration)
  if(!Number.isInteger(count) || count<1) throw new Error('Enter a positive phase duration, or leave blank for ongoing.')
  return start+count-1
}
export function expiredLatestPhase<T extends PhaseBoundary>(phases:T[],status:string,startDate:string,today:string):T|null {
  if(status!=='active') return null
  const week=Math.floor((Date.parse(today.slice(0,10))-Date.parse(startDate.slice(0,10)))/604800000)+1
  if(!Number.isFinite(week) || week<1 || phases.some(p=>p.start_week!=null && p.start_week<=week && (p.end_week==null || p.end_week>=week))) return null
  const latest=[...phases].sort((a,b)=>(b.start_week??0)-(a.start_week??0))
  if(!latest[0]?.id || latest[0].start_week==null || latest[0].end_week==null || latest[0].end_week>=week || (latest[1] && latest[1].start_week===latest[0].start_week)) return null
  return latest[0]
}
