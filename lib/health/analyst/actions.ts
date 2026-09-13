/** Public V1 input: the client selects an action, never an instruction. */
export type GuidedAnalystAction =
  | 'since_last_labs'
  | 'current_snapshot'
  | 'largest_changes'
  | 'missing_data'
  | 'protocol_context'

export const INVALID_ANALYST_ACTION = 'INVALID_ANALYST_ACTION'

const instructions = {
  since_last_labs: 'Describe eligible latest lab comparisons and latest-panel comparison gaps. Use canonical deterministic findings as primary truth. Omit weight, check-ins and unrelated protocol history.',
  current_snapshot: 'Summarize the latest recorded labs/findings and current recorded protocol state concisely. Include at most one meaningful gap. Do not recap older history.',
  largest_changes: 'Describe the largest recorded lab changes using supplied numeric magnitude ranking, never finding priority, medical severity or concern.',
  missing_data: 'Describe only meaningful gaps and limitations in the recorded lab evidence. Missing measurements are absence, not zero. Do not recommend ordering or repeating tests.',
  protocol_context: 'Describe recorded protocol timing using supplied canonical longitudinal observations, regimen snapshots, windows and confounders. Do not introduce unrelated lab history or infer treatment effects.',
} as const satisfies Record<GuidedAnalystAction, string>

export function isGuidedAnalystAction(value: unknown): value is GuidedAnalystAction {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(instructions, value)
}

export function parseGuidedAnalystAction(body: unknown): GuidedAnalystAction | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const input = body as Record<string, unknown>
  return Object.keys(input).length === 1 && isGuidedAnalystAction(input.action) ? input.action : null
}

const scanStyle = [
  'Write for a person scanning a phone screen in a few seconds.',
  'Format analysis.summary as 1 to 3 short scan lines separated by newline characters, with one idea per line and no prose paragraph.',
  'Format every finding.detail as 1 to 4 short fact lines separated by newline characters, one fact per line.',
  'Do not include markdown bullets, numbering or tables inside the strings; the UI supplies the visual list treatment.',
  'Prefer compact label-value-change phrasing when supported, for example: "Total testosterone: 1077 ng/dL · +68 (+6.7%) since Jun 29".',
  'Avoid repeating the same recorded numbers in analysis.summary and finding.detail unless the selected action requires them.',
].join(' ')

const answerStyle: Partial<Record<GuidedAnalystAction, string>> = {
  since_last_labs: 'In analysis.summary, state the count of eligible comparisons and comparison gaps when available. Put biomarker-level numbers in findings.',
  current_snapshot: 'In analysis.summary, include at most two canonical headline lab changes with a current value or delta when available, plus the count of currently recorded protocol items. Do not enumerate every biomarker, supplied range, dose, frequency, route or protocol week there. In findings, organize details into compact facts rather than inventories.',
  largest_changes: 'In analysis.summary, name the largest recorded numeric change and its magnitude when available. Keep the ranked numeric details in findings.',
  missing_data: 'In analysis.summary, state the one or two main evidence gaps plainly. Put supporting specifics in findings.',
  protocol_context: 'In analysis.summary, state the most relevant recorded timing window or absence of one. Put event-by-event timing in findings.',
}

export function guidedAnalystInstruction(action: GuidedAnalystAction): string {
  return `${instructions[action]} Answer this selected action only. ${scanStyle} ${answerStyle[action] ?? ''} Deterministic findings are authoritative. No causal inference, diagnosis, medication adjustment advice or personal-normal claims.`.replace(/\s+/g, ' ').trim()
}

export const guidedAnalystLimits: Record<GuidedAnalystAction, { evidence: number; findings: number }> = {
  since_last_labs: { evidence: 20, findings: 4 },
  current_snapshot: { evidence: 20, findings: 4 },
  largest_changes: { evidence: 16, findings: 4 },
  missing_data: { evidence: 16, findings: 4 },
  protocol_context: { evidence: 20, findings: 0 },
}
