import { panelSummary, type LabPanel } from './labs'
import { biomarkerCategories, classifyBiomarker } from './biomarkerIntelligence'
import type { TimelineEvent } from './timeline'

export function normalizeLabTimeline(panels: LabPanel[]): TimelineEvent[] {
  return panels.map(panel => {
    const present = new Set(panel.results.map(result => classifyBiomarker(result.biomarker_name).category))
    const categories = biomarkerCategories.filter(category => category !== 'Other' && present.has(category))
    const preview = categories.length ? `${categories.slice(0, 2).join(', ')}${categories.length > 2 ? ` +${categories.length - 2}` : ''}` : ''
    return { id: `lab_panels:${panel.id}`, date: panel.test_date, category: 'Labs' as const,
    title: panel.panel_name || panel.provider || 'Lab results', description: [panelSummary(panel.results), preview].filter(Boolean).join(' · '),
    sourceType: 'lab_panels' as const, sourceId: panel.id,
    metadata: { panelId: panel.id, provider: panel.provider, resultCount: panel.results.length, categories: preview || null },
  }}).sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id))
}
