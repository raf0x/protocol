'use client'

import { useEffect, useMemo, useState } from 'react'
import { loadProtocolOverlay } from '../../lib/health/loadProtocolOverlay'
import { filterByWindow, overlappingProtocolIds, overlayMarkers, unitSeries, type OverlayWindow, type ProtocolOverlayData } from '../../lib/health/protocolOverlay'
import { labValue, type BiomarkerHistory } from '../../lib/health/labs'
import { formatTimelineDate } from '../../lib/health/timeline'
import ProtocolOverlayChart from './ProtocolOverlayChart'
import TestDateProtocolContext from './TestDateProtocolContext'
import styles from '../../app/health/health.module.css'

const windows: [OverlayWindow, string][] = [['3m', '3 months'], ['6m', '6 months'], ['12m', '1 year'], ['all', 'All']]

export default function ProtocolOverlayView({ history }: { history: BiomarkerHistory }) {
  const [unit, setUnit] = useState(history.units.length === 1 ? history.units[0].unit : '')
  const [window, setWindow] = useState<OverlayWindow>('all')
  const [data, setData] = useState<ProtocolOverlayData | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const allObservations = useMemo(() => history.units.flatMap(group => group.observations), [history])
  useEffect(() => {
    let live = true
    const dates = allObservations.map(item => item.date).sort()
    loadProtocolOverlay(dates[0], dates.at(-1)!).then(value => {
      if (!live) return
      setData(value); setSelected(new Set(overlappingProtocolIds(value.protocols, allObservations))); setStatus('ready')
    }).catch(() => { if (live) setStatus('error') })
    return () => { live = false }
  }, [allObservations])
  const series = unit ? unitSeries(history, unit) : null
  const latestDate = series?.observations[0]?.date ?? ''
  const observations = series ? filterByWindow(series.observations, latestDate, window) : []
  const allMarkers = data ? overlayMarkers(data.protocols, data.events) : []
  const markers = filterByWindow(allMarkers.filter(marker => selected.has(marker.protocolId)), latestDate, window)
  const protocols = data?.protocols.filter(protocol => selected.has(protocol.id)) ?? []
  function toggle(id: string) { setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next }) }

  return <section className={styles.overlay}>
    <div className={styles.overlayIntro}><span className={styles.eyebrow}>Protocol context</span><h2>{history.name}</h2><p>Compare saved readings with recorded protocol history. Timing is shown without claiming that one caused the other.</p></div>
    {history.units.length > 1 && <fieldset className={styles.overlayFieldset}><legend>Select a unit series</legend><div className={styles.filterRow}>{history.units.map(group => <button type="button" key={group.unit} aria-pressed={unit === group.unit} onClick={() => setUnit(group.unit)}>{group.unit || 'Unit not recorded'} · {group.observations.length}</button>)}</div></fieldset>}
    {!unit && <div className={styles.notice}>This biomarker has multiple units. Select one series to keep comparisons accurate.</div>}
    {unit && <>
      <fieldset className={styles.overlayFieldset}><legend>Time window</legend><div className={styles.filterRow}>{windows.map(([value, label]) => <button type="button" key={value} aria-pressed={window === value} onClick={() => setWindow(value)}>{label}</button>)}</div></fieldset>
      {status === 'loading' && <div className={styles.card}><p role="status">Loading protocol history…</p></div>}
      {status === 'error' && <div className={styles.notice} role="status">Protocol history could not be loaded. Your lab readings remain available.</div>}
      {status === 'ready' && data && <>
        <fieldset className={styles.overlayFieldset}><legend>Protocols shown</legend><div className={styles.filterRow}><button type="button" aria-pressed={selected.size === data.protocols.length} onClick={() => setSelected(new Set(data.protocols.map(protocol => protocol.id)))}>All protocols</button>{data.protocols.map(protocol => <button type="button" key={protocol.id} aria-pressed={selected.has(protocol.id)} onClick={() => toggle(protocol.id)}>{protocol.name || 'Protocol'}</button>)}</div></fieldset>
        <section className={styles.card}><div className={styles.rowHeading}><h3>Readings with protocol history</h3><span className={styles.caption}>{observations.length} readings · {markers.length} events</span></div><ProtocolOverlayChart observations={observations} markers={markers} name={history.name} unit={unit} /></section>
        <section aria-labelledby="changes-heading"><div className={styles.sectionHeading}><h2 id="changes-heading">Recorded protocol changes</h2><span>{markers.length}</span></div>
          {markers.length ? <ol className={styles.overlayEvents}>{markers.map(marker => <li key={marker.id}><span data-type={marker.type} aria-hidden="true" /><div><strong>{marker.title}</strong>{marker.description && <p>{marker.description}</p>}<time dateTime={marker.date}>{formatTimelineDate(marker.date)}</time></div></li>)}</ol> : <div className={styles.card}><p>No protocol changes were recorded in this reading window.</p></div>}
        </section>
        <section aria-labelledby="context-heading"><div className={styles.sectionHeading}><h2 id="context-heading">Protocol context by test</h2></div><div className={styles.contextList}>{observations.map(observation => <TestDateProtocolContext key={observation.result.id} observation={observation} protocols={protocols} events={data.events} />)}</div></section>
        <details className={styles.overlayReadingList}><summary>Reading history</summary><ol>{observations.map(observation => <li key={observation.result.id}><time>{formatTimelineDate(observation.date)}</time><strong>{labValue(observation.result)}</strong></li>)}</ol></details>
      </>}
    </>}
  </section>
}
