-- READ ONLY: run this SELECT in the Supabase SQL editor before deployment.
-- Does not call either application function or change data, grants, or settings.
-- Checks both functions replaced by 202609240001_scheduled_protocols.sql.
-- The migrations do not prescribe an owner. Compare actual_owner with your
-- approved deployment owner; optionally replace NULL below with that role name.
-- Extra grants/overloads are exposed for review, not silently assumed safe.
-- Expected post-migration continuation ACL: PUBLIC/anon cannot execute;
-- authenticated, service_role, and postgres retain execution access.
-- A pre-deployment anon failure is expected until the corrective migration runs.
WITH expected AS (
  SELECT * FROM (VALUES
    ('save_protocol_with_events_v2',
     'public.save_protocol_with_events_v2(uuid,text,date,jsonb,uuid,uuid[],date,text)',
     ARRAY['p_protocol_id','p_name','p_start_date','p_compounds',
           'p_continued_from_id','p_removed_compound_ids','p_effective_date','p_timezone']::text[],
     'uuid', 4, 'NULL::uuid, ''{}''::uuid[], NULL::date, ''UTC''::text',
     ARRAY['search_path=public','TimeZone=UTC']::text[], NULL::text),
    ('continue_latest_phase',
     'public.continue_latest_phase(uuid,uuid,uuid)',
     ARRAY['p_protocol_id','p_compound_id','p_phase_id']::text[],
     'void', 0, NULL::text,
     ARRAY['search_path=public']::text[], NULL::text)
  ) AS e(function_name, expected_signature, expected_argument_names,
         expected_return, expected_default_count, expected_defaults,
         expected_settings, expected_owner)
), inspected AS (
  SELECT e.*, p.oid, p.proowner, p.proacl, p.prosecdef, p.proconfig,
    p.prokind, p.proretset, p.proargnames, p.pronargdefaults,
    pg_get_userbyid(p.proowner) AS actual_owner,
    pg_get_function_identity_arguments(p.oid) AS actual_identity_arguments,
    pg_get_function_arguments(p.oid) AS actual_arguments_with_defaults,
    pg_get_function_result(p.oid) AS actual_return,
    pg_get_expr(p.proargdefaults, 0) AS actual_defaults,
    (SELECT r.oid FROM pg_roles r WHERE r.rolname='anon') AS anon_role,
    (SELECT r.oid FROM pg_roles r WHERE r.rolname='authenticated') AS authenticated_role,
    (SELECT r.oid FROM pg_roles r WHERE r.rolname='service_role') AS service_role,
    (SELECT r.oid FROM pg_roles r WHERE r.rolname='postgres') AS postgres_role,
    (SELECT count(*) FROM pg_proc other JOIN pg_namespace n ON n.oid=other.pronamespace
      WHERE n.nspname='public' AND other.proname=e.function_name) AS same_name_count,
    (SELECT jsonb_agg(other.oid::regprocedure::text ORDER BY other.oid)
      FROM pg_proc other JOIN pg_namespace n ON n.oid=other.pronamespace
      WHERE n.nspname='public' AND other.proname=e.function_name) AS deployed_overloads
  FROM expected e
  LEFT JOIN pg_proc p ON p.oid=to_regprocedure(e.expected_signature)
), checks AS (
  SELECT i.*,
    coalesce(oid IS NOT NULL AND prokind='f' AND NOT proretset
      AND proargnames=expected_argument_names AND actual_return=expected_return
      AND pronargdefaults=expected_default_count
      AND actual_defaults IS NOT DISTINCT FROM expected_defaults, false) AS signature_defaults_ok,
    coalesce(NOT prosecdef, false) AS security_invoker_ok,
    coalesce(proconfig @> expected_settings AND proconfig <@ expected_settings, false) AS settings_ok,
    CASE WHEN oid IS NOT NULL AND anon_role IS NOT NULL
      THEN has_function_privilege(anon_role,oid,'EXECUTE') END AS anon_can_execute,
    CASE WHEN oid IS NOT NULL AND authenticated_role IS NOT NULL
      THEN has_function_privilege(authenticated_role,oid,'EXECUTE') END AS authenticated_can_execute,
    CASE WHEN oid IS NOT NULL AND service_role IS NOT NULL
      THEN has_function_privilege(service_role,oid,'EXECUTE') END AS service_role_can_execute,
    CASE WHEN oid IS NOT NULL AND postgres_role IS NOT NULL
      THEN has_function_privilege(postgres_role,oid,'EXECUTE') END AS postgres_can_execute,
    CASE WHEN oid IS NOT NULL THEN EXISTS (
      SELECT 1 FROM aclexplode(coalesce(proacl,acldefault('f',proowner))) a
      WHERE a.grantee=0 AND a.privilege_type='EXECUTE'
    ) END AS public_can_execute,
    CASE WHEN oid IS NOT NULL THEN (
      SELECT jsonb_agg(jsonb_build_object(
        'grantee', CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END,
        'grantor', pg_get_userbyid(a.grantor),
        'privilege', a.privilege_type, 'grantable', a.is_grantable
      ) ORDER BY a.grantee,a.privilege_type)
      FROM aclexplode(coalesce(proacl,acldefault('f',proowner))) a
    ) END AS deployed_grants
  FROM inspected i
)
SELECT expected_signature,
  CASE
    WHEN oid IS NULL THEN 'FAIL: missing exact signature'
    WHEN NOT signature_defaults_ok THEN 'FAIL: signature/default/return mismatch'
    WHEN NOT security_invoker_ok THEN 'FAIL: expected SECURITY INVOKER'
    WHEN NOT settings_ok THEN 'FAIL: function settings mismatch'
    WHEN anon_role IS NULL OR authenticated_role IS NULL THEN 'FAIL: missing Supabase role'
    WHEN public_can_execute OR anon_can_execute OR NOT authenticated_can_execute
      THEN 'FAIL: execution privileges mismatch'
    WHEN function_name='continue_latest_phase'
      AND (service_role_can_execute IS DISTINCT FROM true OR postgres_can_execute IS DISTINCT FROM true)
      THEN 'FAIL: continuation service_role/postgres access missing'
    WHEN same_name_count<>1 THEN 'REVIEW: additional overloads'
    WHEN expected_owner IS NOT NULL AND actual_owner<>expected_owner THEN 'FAIL: owner mismatch'
    WHEN expected_owner IS NULL THEN 'PASS contract; REVIEW owner and full grants'
    ELSE 'PASS contract and owner; REVIEW full grants'
  END AS preflight_result,
  actual_owner, expected_owner,
  actual_identity_arguments, actual_arguments_with_defaults, actual_return,
  signature_defaults_ok,
  CASE WHEN oid IS NULL THEN NULL WHEN prosecdef THEN 'DEFINER' ELSE 'INVOKER' END AS security_mode,
  security_invoker_ok, proconfig AS function_settings, settings_ok,
  public_can_execute, anon_can_execute, authenticated_can_execute,
  service_role_can_execute, postgres_can_execute,
  deployed_grants, deployed_overloads
FROM checks
ORDER BY function_name;
