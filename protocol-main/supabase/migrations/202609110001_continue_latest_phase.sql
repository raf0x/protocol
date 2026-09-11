-- No automatic history changes. Only a user-invoked continuation changes a phase.
BEGIN;
CREATE OR REPLACE FUNCTION public.continue_latest_phase(p_protocol_id uuid,p_compound_id uuid,p_phase_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sw integer; ew integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM 1 FROM protocols WHERE id=p_protocol_id AND user_id=uid AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only an active protocol you own can be continued'; END IF;
  PERFORM 1 FROM compounds WHERE id=p_compound_id AND protocol_id=p_protocol_id AND user_id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compound not found'; END IF;
  SELECT start_week,end_week INTO sw,ew FROM phases WHERE id=p_phase_id AND compound_id=p_compound_id AND user_id=uid FOR UPDATE;
  IF NOT FOUND OR sw IS NULL THEN RAISE EXCEPTION 'Phase not found or undated'; END IF;
  IF EXISTS(SELECT 1 FROM phases WHERE compound_id=p_compound_id AND id<>p_phase_id AND (start_week>=sw OR end_week IS NULL OR end_week>=sw)) THEN
    RAISE EXCEPTION 'Selected phase must be the unique latest non-overlapping phase. Review the phase list.';
  END IF;
  UPDATE phases SET end_week=NULL,duration_weeks=NULL WHERE id=p_phase_id AND compound_id=p_compound_id AND user_id=uid;
END $$;
REVOKE ALL ON FUNCTION public.continue_latest_phase(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.continue_latest_phase(uuid,uuid,uuid) TO authenticated;
COMMIT;
