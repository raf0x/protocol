-- Lab Findings Seen Marker V1: one persisted per-user marker recording the
-- last lab panel the user has seen findings for, so the Health Briefing can
-- show "N new findings since your last visit" without a parallel state model.
-- Additive and rerunnable. No historical rows are updated or backfilled.
-- No new RLS policy is added: RLS policies are row-scoped, so an existing
-- owner-row policy automatically covers a column added later. That claim is
-- not just asserted here -- it is verified below before the column is added,
-- since user_profiles' original CREATE TABLE/RLS setup predates this repo's
-- tracked migration history and cannot otherwise be confirmed from source.
BEGIN;

DO $preflight$
DECLARE actual text;
DECLARE rls_enabled boolean;
DECLARE policy_count integer;
BEGIN
  SELECT format_type(a.atttypid,a.atttypmod) INTO actual
  FROM pg_attribute a
  WHERE a.attrelid='public.user_profiles'::regclass
    AND a.attname='last_seen_lab_panel_id' AND NOT a.attisdropped;
  IF actual IS NOT NULL AND actual IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION 'Incompatible user_profiles.last_seen_lab_panel_id: expected uuid, got %. No change was made.',actual;
  END IF;

  SELECT relrowsecurity INTO rls_enabled FROM pg_class WHERE oid='public.user_profiles'::regclass;
  IF rls_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'public.user_profiles does not have row level security enabled. Refusing to add last_seen_lab_panel_id until RLS is confirmed on. No change was made.';
  END IF;

  SELECT count(*) INTO policy_count FROM pg_policies
    WHERE schemaname='public' AND tablename='user_profiles' AND cmd IN ('SELECT','ALL');
  IF policy_count=0 THEN
    RAISE EXCEPTION 'public.user_profiles has no SELECT-covering RLS policy. Refusing to add last_seen_lab_panel_id until row ownership is confirmed enforced. No change was made.';
  END IF;

  SELECT count(*) INTO policy_count FROM pg_policies
    WHERE schemaname='public' AND tablename='user_profiles' AND cmd IN ('UPDATE','ALL');
  IF policy_count=0 THEN
    RAISE EXCEPTION 'public.user_profiles has no UPDATE-covering RLS policy. Refusing to add last_seen_lab_panel_id until row ownership is confirmed enforced. No change was made.';
  END IF;
END $preflight$;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS last_seen_lab_panel_id uuid REFERENCES public.lab_panels(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.user_profiles.last_seen_lab_panel_id IS
  'Latest lab panel the user has seen findings for, used only to compute "N new findings since your last visit". Not a source of lab or protocol truth.';

COMMIT;
