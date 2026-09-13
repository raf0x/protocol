import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { loadHealthSourceData } from '../analyst/context'
import type { AnalystSourceData } from '../analyst/evidence'
import { analyzeHealthContext } from '../analyst/service'
import type { HealthAnalystProvider } from '../analyst/types'
import { buildDoctorReport } from './model'
import { buildReportAiContext, toReportAiSummary } from './ai'
import type { DoctorReportResponse, ReportRange } from './types'

export async function createDoctorReport(
  client: SupabaseClient,
  userId: string,
  range: ReportRange,
  includeAi: boolean,
  today: string,
  provider?: HealthAnalystProvider,
  onAiError?: (error: unknown) => void | Promise<void>
): Promise<DoctorReportResponse> {
  const source = await loadHealthSourceData(client, userId)
  return createDoctorReportFromSource(source, range, includeAi, today, provider, onAiError)
}

export async function createDoctorReportFromSource(
  source: AnalystSourceData,
  range: ReportRange,
  includeAi: boolean,
  today: string,
  provider?: HealthAnalystProvider,
  onAiError?: (error: unknown) => void | Promise<void>
): Promise<DoctorReportResponse> {
  const report = buildDoctorReport(source, range, today)

  if (!includeAi) return { report, aiSummary: null, aiError: null }

  try {
    const context = buildReportAiContext(report)
    const result = await analyzeHealthContext(context, provider)
    return { report, aiSummary: toReportAiSummary(result.analysis), aiError: null }
  } catch (error) {
    await onAiError?.(error)
    return {
      report,
      aiSummary: null,
      aiError: 'The deterministic report is complete, but the optional AI overview was unavailable.',
    }
  }
}
