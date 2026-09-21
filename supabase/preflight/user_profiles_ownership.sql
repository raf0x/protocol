-- READ ONLY. No application functions are called and no profile rows are read.
-- Run in Supabase SQL editor. Results identify deployed schema and SQL callers;
-- catalogs cannot identify which historical request produced a logged error.
WITH target AS (
  SELECT to_regclass('public.user_profiles') AS oid
), functions AS (
  SELECT p.oid, n.nspname AS schema_name, p.proname,
    p.oid::regprocedure::text AS signature,
    pg_get_userbyid(p.proowner) AS owner,
    p.prosecdef AS security_definer, p.proconfig AS settings,
    p.prosrc ILIKE '%user_profiles%' AS mentions_profiles,
    p.prosrc ILIKE '%user_id%' AS mentions_user_id,
    pg_get_functiondef(p.oid) AS definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE p.prokind IN ('f','p') AND n.nspname NOT IN ('pg_catalog','information_schema')
    AND (p.prosrc ILIKE '%user_profiles%' OR p.prosrc ILIKE '%user_id%')
), views AS (
  SELECT n.nspname AS schema_name,c.relname,c.relkind,
    pg_get_viewdef(c.oid,true) AS definition
  FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE c.relkind IN ('v','m') AND n.nspname NOT IN ('pg_catalog','information_schema')
    AND (pg_get_viewdef(c.oid,true) ILIKE '%user_profiles%' OR EXISTS (
      SELECT 1 FROM pg_rewrite r JOIN pg_depend d ON d.objid=r.oid
      WHERE r.ev_class=c.oid AND d.classid='pg_rewrite'::regclass
        AND d.refclassid='pg_class'::regclass AND d.refobjid=(SELECT oid FROM target)
    ))
), triggers AS (
  SELECT n.nspname AS schema_name,c.relname,t.tgname,t.tgenabled,
    t.tgfoid::regprocedure::text AS function_signature,
    pg_get_triggerdef(t.oid,true) AS definition
  FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE NOT t.tgisinternal AND (t.tgrelid=(SELECT oid FROM target)
    OR t.tgfoid IN (SELECT oid FROM functions)
    OR pg_get_triggerdef(t.oid,true) ILIKE '%user_profiles%'
    OR pg_get_triggerdef(t.oid,true) ILIKE '%user_id%')
)
SELECT jsonb_build_object(
  'table_exists',(SELECT oid IS NOT NULL FROM target),
  'columns',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
    'not_null',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid)
  ) ORDER BY a.attnum),'[]'::jsonb) FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=(SELECT oid FROM target) AND a.attnum>0 AND NOT a.attisdropped),
  'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object(
    'name',conname,'definition',pg_get_constraintdef(oid,true))),'[]'::jsonb)
    FROM pg_constraint WHERE conrelid=(SELECT oid FROM target)),
  'table_security',(SELECT jsonb_build_object('owner',pg_get_userbyid(relowner),
    'rls_enabled',relrowsecurity,'rls_forced',relforcerowsecurity)
    FROM pg_class WHERE oid=(SELECT oid FROM target)),
  'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb)
    FROM pg_policies p WHERE schemaname='public' AND tablename='user_profiles'),
  'table_grants',(SELECT coalesce(jsonb_agg(to_jsonb(g)),'[]'::jsonb)
    FROM information_schema.role_table_grants g WHERE table_schema='public' AND table_name='user_profiles'),
  'views',(SELECT coalesce(jsonb_agg(to_jsonb(v)),'[]'::jsonb) FROM views v),
  'functions',(SELECT coalesce(jsonb_agg(to_jsonb(f)-'oid' ORDER BY signature),'[]'::jsonb) FROM functions f),
  'triggers',(SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) FROM triggers t)
) AS user_profiles_diagnosis;

-- Optional live-caller snapshot. This is not the last 24 hours of logs.
-- The active SELECT filters out this SQL editor session itself.
SELECT pid,usename,application_name,backend_type,state,query_start,query
FROM pg_stat_activity
WHERE pid<>pg_backend_pid() AND state='active' AND query ILIKE '%user_profiles%';
