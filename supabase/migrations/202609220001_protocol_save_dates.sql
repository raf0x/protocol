-- MPP-010: date validation around the canonical history-preserving save.
-- No table changes or historical backfill. The function-local timezone is restored on return.
BEGIN;
CREATE OR REPLACE FUNCTION public.save_protocol_with_events_v2(
  p_protocol_id uuid,p_name text,p_start_date date,p_compounds jsonb,
  p_continued_from_id uuid DEFAULT NULL,p_removed_compound_ids uuid[] DEFAULT '{}',
  p_effective_date date DEFAULT NULL,p_timezone text DEFAULT 'UTC')
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public SET timezone='UTC' AS $$
DECLARE uid uuid:=auth.uid(); effective date; local_today date; original_start date; current_status text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'Choose a valid timezone'; END IF;
  PERFORM set_config('TimeZone',p_timezone,true);
  local_today:=current_date;
  IF p_protocol_id IS NULL THEN
    IF p_start_date > local_today THEN RAISE EXCEPTION 'Start date cannot be in the future.'; END IF;
    -- Creation never reads or validates an edit-history date.
    effective:=p_start_date;
  ELSE
    SELECT start_date,status INTO original_start,current_status FROM public.protocols
      WHERE id=p_protocol_id AND user_id=uid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Protocol not found'; END IF;
    effective:=coalesce(p_effective_date,local_today);
    IF current_status IS DISTINCT FROM 'planned' THEN
      IF effective < original_start OR effective < p_start_date THEN
        RAISE EXCEPTION 'Effective date cannot be before the protocol start date.';
      END IF;
      IF effective > local_today THEN RAISE EXCEPTION 'Effective date cannot be in the future.'; END IF;
    END IF;
  END IF;
  RETURN public.save_protocol_with_events_v1(p_protocol_id,p_name,p_start_date,p_compounds,
    p_continued_from_id,p_removed_compound_ids,effective);
END $$;
REVOKE ALL ON FUNCTION public.save_protocol_with_events_v2(uuid,text,date,jsonb,uuid,uuid[],date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_protocol_with_events_v2(uuid,text,date,jsonb,uuid,uuid[],date,text) TO authenticated;
COMMIT;
