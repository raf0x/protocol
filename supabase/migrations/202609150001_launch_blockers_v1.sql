-- Launch Blockers V1: explicit AI consent, durable throttling, scrubbed
-- operational events, and transactional owner-data deletion.
-- Additive and rerunnable. No historical rows are updated or backfilled.
BEGIN;

DO $preflight$
DECLARE field record; actual text;
BEGIN
  FOR field IN SELECT * FROM (VALUES
    ('ai_processing_consent','boolean'),
    ('ai_processing_consented_at','timestamp with time zone'),
    ('ai_processing_consent_version','smallint')
  ) AS expected(column_name,type_name)
  LOOP
    SELECT format_type(a.atttypid,a.atttypmod) INTO actual
    FROM pg_attribute a
    WHERE a.attrelid='public.user_profiles'::regclass
      AND a.attname=field.column_name AND NOT a.attisdropped;
    IF actual IS NOT NULL AND actual IS DISTINCT FROM field.type_name THEN
      RAISE EXCEPTION 'Incompatible user_profiles.%: expected %, got %. No change was made.',
        field.column_name,field.type_name,actual;
    END IF;
  END LOOP;
END $preflight$;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS ai_processing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_processing_consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_processing_consent_version smallint;

CREATE TABLE IF NOT EXISTS public.app_rate_limits (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bucket text NOT NULL,
  window_started_at timestamptz NOT NULL,
  request_count integer NOT NULL,
  PRIMARY KEY (user_id,bucket),
  CHECK (length(bucket) BETWEEN 1 AND 64),
  CHECK (request_count >= 1)
);

CREATE TABLE IF NOT EXISTS public.app_error_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  route text NOT NULL,
  error_type text NOT NULL,
  source text NOT NULL,
  http_status integer,
  release text,
  request_id uuid NOT NULL,
  CHECK (length(route) BETWEEN 1 AND 160),
  CHECK (length(error_type) BETWEEN 1 AND 80),
  CHECK (source IN ('client','server','api','ai','report','push','account')),
  CHECK (http_status IS NULL OR http_status BETWEEN 100 AND 599),
  CHECK (release IS NULL OR length(release) <= 100)
);

DO $table_preflight$
DECLARE actual text;
BEGIN
  SELECT format_type(atttypid,atttypmod) INTO actual FROM pg_attribute
    WHERE attrelid='public.app_rate_limits'::regclass AND attname='user_id' AND NOT attisdropped;
  IF actual IS DISTINCT FROM 'uuid' THEN RAISE EXCEPTION 'Incompatible app_rate_limits.user_id type. No change was made.'; END IF;
  SELECT format_type(atttypid,atttypmod) INTO actual FROM pg_attribute
    WHERE attrelid='public.app_rate_limits'::regclass AND attname='request_count' AND NOT attisdropped;
  IF actual IS DISTINCT FROM 'integer' THEN RAISE EXCEPTION 'Incompatible app_rate_limits.request_count type. No change was made.'; END IF;
  SELECT format_type(atttypid,atttypmod) INTO actual FROM pg_attribute
    WHERE attrelid='public.app_error_events'::regclass AND attname='request_id' AND NOT attisdropped;
  IF actual IS DISTINCT FROM 'uuid' THEN RAISE EXCEPTION 'Incompatible app_error_events.request_id type. No change was made.'; END IF;
END $table_preflight$;

ALTER TABLE public.app_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_error_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_rate_limits,public.app_error_events FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.check_app_rate_limit_v1(p_bucket text)
RETURNS TABLE(allowed boolean,retry_after_seconds integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
DECLARE
  uid uuid:=auth.uid();
  max_requests integer;
  window_seconds integer;
  current_count integer;
  started timestamptz;
  checked_at timestamptz:=clock_timestamp();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  CASE p_bucket
    WHEN 'health-analyst' THEN max_requests:=8; window_seconds:=600;
    WHEN 'health-report-ai' THEN max_requests:=6; window_seconds:=600;
    WHEN 'health-report-deterministic' THEN max_requests:=30; window_seconds:=600;
    WHEN 'push-subscribe' THEN max_requests:=5; window_seconds:=60;
    ELSE RAISE EXCEPTION 'Unsupported rate-limit bucket';
  END CASE;

  INSERT INTO public.app_rate_limits(user_id,bucket,window_started_at,request_count)
  VALUES(uid,p_bucket,checked_at,1)
  ON CONFLICT(user_id,bucket) DO UPDATE SET
    window_started_at=CASE
      WHEN app_rate_limits.window_started_at + make_interval(secs=>window_seconds) <= checked_at THEN checked_at
      ELSE app_rate_limits.window_started_at END,
    request_count=CASE
      WHEN app_rate_limits.window_started_at + make_interval(secs=>window_seconds) <= checked_at THEN 1
      ELSE app_rate_limits.request_count+1 END
  RETURNING request_count,window_started_at INTO current_count,started;

  allowed:=current_count<=max_requests;
  retry_after_seconds:=CASE WHEN allowed THEN 0 ELSE greatest(1,ceil(extract(epoch FROM
    (started+make_interval(secs=>window_seconds)-checked_at)))::integer) END;
  RETURN NEXT;
END $function$;

CREATE OR REPLACE FUNCTION public.delete_my_account_data_v1(p_confirmation text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $function$
DECLARE
  uid uuid:=auth.uid();
  unaccounted text;
  table_name text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_confirmation IS DISTINCT FROM 'DELETE' THEN RAISE EXCEPTION 'Type DELETE to confirm'; END IF;

  -- Fail before the first delete if a newly introduced owner table has not been
  -- explicitly reviewed here. This prevents silently orphaning future data.
  SELECT string_agg(c.table_name,', ' ORDER BY c.table_name) INTO unaccounted
  FROM information_schema.columns c
  JOIN information_schema.tables t ON t.table_schema=c.table_schema AND t.table_name=c.table_name
  WHERE c.table_schema='public' AND c.column_name='user_id' AND t.table_type='BASE TABLE'
    AND c.table_name NOT IN ('protocols','compounds','phases','protocol_events','injection_logs',
      'journal_entries','lab_panels','lab_results','shared_protocols','push_subscriptions',
      'user_profiles','app_rate_limits');
  IF unaccounted IS NOT NULL THEN
    RAISE EXCEPTION 'Account deletion needs review for owner tables: %',unaccounted;
  END IF;

  FOREACH table_name IN ARRAY ARRAY['lab_results','lab_panels','injection_logs','phases',
    'protocol_events','shared_protocols','compounds','protocols','journal_entries',
    'push_subscriptions','app_rate_limits','user_profiles']
  LOOP
    IF to_regclass(format('public.%I',table_name)) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id=$1',table_name) USING uid;
    END IF;
  END LOOP;

  -- Older deployments created profiles with auth.uid() in `id`. Remove that
  -- owner row too without changing or repurposing either identifier column.
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.user_profiles'::regclass
    AND attname='id' AND atttypid='uuid'::regtype AND NOT attisdropped) THEN
    DELETE FROM public.user_profiles WHERE id=uid;
  END IF;
END $function$;

REVOKE ALL ON FUNCTION public.check_app_rate_limit_v1(text),
  public.delete_my_account_data_v1(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_app_rate_limit_v1(text),
  public.delete_my_account_data_v1(text) TO authenticated;

COMMENT ON COLUMN public.user_profiles.ai_processing_consent IS
  'Explicit user choice for third-party AI processing. False means no AI transmission.';
COMMENT ON TABLE public.app_error_events IS
  'Privacy-scrubbed operational metadata only. Never store messages, stacks, health data, payloads, or user identifiers.';

COMMIT;
