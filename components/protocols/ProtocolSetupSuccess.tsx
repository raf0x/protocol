'use client'
import { useEffect, useRef } from 'react'
import Link from 'next/link'
import ProtocolRingComposition from './ProtocolRingComposition'
import { QuickStartReview } from './ProtocolQuickStart'
import type { QuickStartDraft, protocolCompoundPayload } from '../../lib/protocols/form'
import { protocolLifecycle } from '../../lib/health/protocolDates'
import { compoundOverview, dateLabel, type LibraryProtocol } from '../../lib/health/protocolPresentation'
import { useSetupViewport } from '../../lib/protocols/useSetupViewport'

export type SavedSetup = { id: string; draft: QuickStartDraft; payload: ReturnType<typeof protocolCompoundPayload>; firstProtocol: boolean }
export default function ProtocolSetupSuccess({ saved, today }: { saved: SavedSetup; today: string }) {
  const heading = useRef<HTMLHeadingElement>(null)
  const viewport = useSetupViewport()
  useEffect(() => { heading.current?.focus() }, [])
  const { draft } = saved
  const lifecycle = protocolLifecycle({ status: draft.startDate ? 'active' : 'planned', start_date: draft.startDate }, today)
  // Presentation of the canonical payload that succeeded; no second payload adapter.
  const protocol = { id: saved.id, name: draft.compounds[0].name, status: draft.startDate ? 'active' : 'planned', start_date: draft.startDate || null } as LibraryProtocol
  const occurrences = saved.payload.map((c, i) => {
    const compound = { id: String(i), name: c.name, phases: [{ ...c.phase, id: String(i) }] } as NonNullable<LibraryProtocol['compounds']>[number]
    const searchFrom = draft.startDate > today ? draft.startDate : today
    return { name: c.name, next: compoundOverview(protocol, compound, searchFrom).next }
  }).filter(item => item.next).sort((a, b) => a.next!.date.localeCompare(b.next!.date))
  const next = occurrences[0]
  const week = lifecycle === 'active' ? compoundOverview(protocol, { id: 'preview', name: protocol.name, phases: [] }, today).week : null
  return <main className="protocols-page protocols-focused"><div className="protocols-container protocols-creation-container">
    <div ref={viewport} className="protocol-creation-layout guided-creation guided-success">
      <p className="guided-eyebrow">Tracking setup complete</p>
      <h1 tabIndex={-1} ref={heading}>{saved.firstProtocol ? 'Your protocol is ready' : 'Protocol saved'}</h1>
      <ProtocolRingComposition celebrate={saved.firstProtocol} items={[{ id: saved.id, name: draft.compounds[0].name, week, label: lifecycle === 'planned' ? 'Planned' : lifecycle === 'scheduled' ? 'Scheduled' : undefined }]} />
      <QuickStartReview value={draft} today={today} />
      {next && <p className="guided-next">Next scheduled: {dateLabel(next.next!.date)}{next.next!.time ? ` · ${next.next!.time}` : ''}{draft.compounds.length > 1 ? ` · ${next.name}` : ''}</p>}
      <footer className="guided-actions"><Link className="quick-save-primary" href="/protocol">Go to Today</Link></footer>
    </div>
  </div></main>
}
