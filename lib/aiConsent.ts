import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export const AI_CONSENT_VERSION = 1
export const AI_CONSENT_REQUIRED = 'AI_CONSENT_REQUIRED'

type ConsentRow = {
  ai_processing_consent: boolean | null
  ai_processing_consented_at: string | null
  ai_processing_consent_version: number | null
}

export async function hasCurrentAiConsent(client: SupabaseClient, userId: string): Promise<boolean> {
  let result = await client.from('user_profiles')
    .select('ai_processing_consent,ai_processing_consented_at,ai_processing_consent_version')
    .eq('user_id', userId).limit(1).maybeSingle<ConsentRow>()
  if (!result.error && !result.data) {
    result = await client.from('user_profiles')
      .select('ai_processing_consent,ai_processing_consented_at,ai_processing_consent_version')
      .eq('id', userId).limit(1).maybeSingle<ConsentRow>()
  }
  const { data, error } = result
  if (error || !data) return false
  return data.ai_processing_consent === true
    && data.ai_processing_consent_version === AI_CONSENT_VERSION
    && typeof data.ai_processing_consented_at === 'string'
}

export function consentRequiredResponse() {
  return {
    code: AI_CONSENT_REQUIRED,
    error: 'Review AI data processing before continuing.',
  }
}
