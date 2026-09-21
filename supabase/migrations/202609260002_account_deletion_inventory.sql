-- Inventory references auth.users, which this data-only deletion does not remove.
-- Delete owned inventory explicitly before existing account data; preserve all guards.
-- CREATE OR REPLACE preserves the existing function owner and execution grants.
BEGIN;
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
      'user_profiles','app_rate_limits','inventory_items','inventory_imports');
  IF unaccounted IS NOT NULL THEN
    RAISE EXCEPTION 'Account deletion needs review for owner tables: %',unaccounted;
  END IF;

  FOREACH table_name IN ARRAY ARRAY['inventory_items','inventory_imports','lab_results','lab_panels','injection_logs','phases',
    'protocol_events','shared_protocols','compounds','protocols','journal_entries',
    'push_subscriptions','app_rate_limits']
  LOOP
    IF to_regclass(format('public.%I',table_name)) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE user_id=$1',table_name) USING uid;
    END IF;
  END LOOP;

  -- Profiles use auth.uid() in id, unlike the user_id-owned tables above.
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.user_profiles'::regclass
    AND attname='id' AND atttypid='uuid'::regtype AND NOT attisdropped) THEN
    DELETE FROM public.user_profiles WHERE id=uid;
  END IF;
END $function$;
COMMIT;
