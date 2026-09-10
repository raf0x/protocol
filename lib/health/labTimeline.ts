import { panelSummary, type LabPanel } from './labs'
import type { TimelineEvent } from './timeline'

export function normalizeLabTimeline(panels: LabPanel[]): TimelineEvent[] {
  return panels.map(panel => ({ id: `lab_panels:${panel.id}`, date: panel.test_date, category: 'Labs' as const,
    title: panel.panel_name || panel.provider || 'Lab results', description: panelSummary(panel.results),
    sourceType: 'lab_panels' as const, sourceId: panel.id,
    metadata: { panelId: panel.id, provider: panel.provider, resultCount: panel.results.length },
  })).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}
