import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadHealthSourceData } from '../analyst/context'
import { buildAnalystContext, type AnalystSourceData } from '../analyst/evidence'
import { analyzeHealthContext } from '../analyst/service'
import type { HealthAnalystProvider } from '../analyst/types'
import { buildDoctorReport, filterReportSource, reportStartDate } from './model'
import type { DoctorReportResponse, ReportRange } from './types'

export async function createDoctorReport(client: SupabaseClient, userId: string, range: ReportRange, includeAi: boolean, today: string,
  provider?: HealthAnalystProvider, onAiError?: (error: unknown) => void | Promise<void>): Promise<DoctorReportResponse> {
  const source = await loadHealthSourceData(client, userId)
  return createDoctorReportFromSource(source, range, includeAi, today, provider, onAiError)
}

export async function createDoctorReportFromSource(source: AnalystSourceData, range: ReportRange, includeAi: boolean, today: string,
  provider?: HealthAnalystProvider, onAiError?: (error: unknown) => void | Promise<void>): Promise<DoctorReportResponse> {
  const report = buildDoctorReport(source, range, today)
  if (!includeAi) return { report, aiSummary: null, aiError: null }
  try {
    const scoped = filterReportSource(source, range, today)
    // Full lifecycle events remain available to strict current-state resolution,
    // while event evidence sent to the model is bounded to the report period.
    const context = buildAnalystContext({ ...scoped, protocolEvents: source.protocolEvents }, 'Create a concise clinician-facing summary of the recorded health history. Prioritize current protocols, largest recorded same-unit lab changes, supplied-range flags, protocol timing, and data limitations.', today, { minimumDate: reportStartDate(range, today) })
    const result = await analyzeHealthContext(context, provider)
    return { report, aiSummary: result.analysis, aiError: null }
  } catch (error) {
    await onAiError?.(error)
    return { report, aiSummary: null, aiError: 'The deterministic report is complete, but the optional AI summary was unavailable.' }
  }
}
