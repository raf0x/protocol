-- Scheduled is derived from status='active' and a future start_date.
-- No new status, cron, backfill, or changes to completed/stopped protocols.
BEGIN;
CREATE OR REPLACE FUNCTION public.save_protocol_with_events_v2(
  p_protocol_id uuid,p_name text,p_start_date date,p_compounds jsonb,
  p_continued_from_id uuid DEFAULT NULL,p_removed_compound_ids uuid[] DEFAULT '{}',
  p_effective_date date DEFAULT NULL,p_timezone text DEFAULT 'UTC')
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public SET timezone='UTC' AS $$
DECLARE uid uuid:=auth.uid(); effective date; local_today date; current_status text; original_start date;
  pid uuid; item record; state jsonb; base jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'Choose a valid timezone'; END IF;
  PERFORM set_config('TimeZone',p_timezone,true);
  local_today:=current_date;
  IF p_protocol_id IS NULL THEN
    -- Initial configuration is effective at its committed start, even in the future.
    effective:=p_start_date;
  ELSE
    SELECT status,start_date INTO current_status,original_start FROM public.protocols
      WHERE id=p_protocol_id AND user_id=uid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Protocol not found'; END IF;
    IF current_status='active' AND original_start>local_today THEN
      IF p_start_date IS NULL THEN RAISE EXCEPTION 'Choose a start date'; END IF;
      -- Nothing has started yet: update saved configuration through the canonical
      -- dosing function without inventing dose-change history before treatment.
      pid:=public.save_protocol_dosing_v2(p_protocol_id,p_name,p_start_date,p_compounds,p_continued_from_id,p_removed_compound_ids);
      -- Move only prospective records. IDs and any actual historical records stay intact.
      UPDATE public.protocol_events SET date=p_start_date,
        metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('effectiveDate',p_start_date)
        WHERE protocol_id=pid AND user_id=uid AND date>=original_start;
      IF NOT EXISTS(SELECT 1 FROM public.protocol_events WHERE protocol_id=pid AND user_id=uid AND event_type='started') THEN
        INSERT INTO public.protocol_events(user_id,protocol_id,date,event_type,description,metadata)
          VALUES(uid,pid,p_start_date,'started','Started '||p_name,
            jsonb_build_object('version',1,'source','protocol_editor','effectiveDate',p_start_date,'protocolId',pid));
      END IF;
      FOR item IN SELECT ph.id AS phase_id,ph.compound_id,c.name,public.protocol_phase_event_state_v1(ph) AS event_state
        FROM public.phases ph JOIN public.compounds c ON c.id=ph.compound_id
        WHERE c.protocol_id=pid AND c.user_id=uid AND ph.user_id=uid
      LOOP
        state:=item.event_state;
        base:=jsonb_build_object('version',1,'source','protocol_editor','effectiveDate',p_start_date,'protocolId',pid,
          'compoundId',item.compound_id,'compoundName',item.name,'phaseId',item.phase_id,'newState',state,
          'newDose',state->'medicationDose','newUnit',state->'medicationUnit','newFrequency',state->'frequency','newRoute',state->'route');
        UPDATE public.protocol_events SET metadata=base,date=p_start_date
          WHERE protocol_id=pid AND user_id=uid AND event_type='phase_started'
          AND metadata->>'phaseId'=item.phase_id::text AND date=p_start_date;
        IF NOT FOUND THEN
          INSERT INTO public.protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
            VALUES(uid,pid,item.compound_id,p_start_date,'phase_started',item.name||' phase started',base);
        END IF;
      END LOOP;
      RETURN pid;
    END IF;
    effective:=coalesce(p_effective_date,local_today);
    IF current_status IS DISTINCT FROM 'planned' THEN
      IF effective<p_start_date THEN RAISE EXCEPTION 'Effective date cannot be before the protocol start date.'; END IF;
      IF effective>local_today THEN RAISE EXCEPTION 'Effective date cannot be in the future.'; END IF;
    END IF;
  END IF;
  RETURN public.save_protocol_with_events_v1(p_protocol_id,p_name,p_start_date,p_compounds,
    p_continued_from_id,p_removed_compound_ids,effective);
END $$;
REVOKE ALL ON FUNCTION public.save_protocol_with_events_v2(uuid,text,date,jsonb,uuid,uuid[],date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_protocol_with_events_v2(uuid,text,date,jsonb,uuid,uuid[],date,text) TO authenticated;
-- A direct continuation RPC must not manufacture activity before treatment.
CREATE OR REPLACE FUNCTION public.continue_latest_phase(p_protocol_id uuid,p_compound_id uuid,p_phase_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sw integer; ew integer; pname text; state jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM 1 FROM protocols WHERE id=p_protocol_id AND user_id=uid AND status='active' AND start_date<=current_date FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only an active protocol you own can be continued'; END IF;
  SELECT c.name,p.start_week,p.end_week INTO pname,sw,ew FROM phases p JOIN compounds c ON c.id=p.compound_id
    WHERE p.id=p_phase_id AND p.compound_id=p_compound_id AND p.user_id=uid AND c.protocol_id=p_protocol_id AND c.user_id=uid FOR UPDATE OF p,c;
  IF NOT FOUND OR sw IS NULL THEN RAISE EXCEPTION 'Phase not found or undated'; END IF;
  IF ew IS NULL THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM phases WHERE compound_id=p_compound_id AND id<>p_phase_id AND (start_week>=sw OR end_week IS NULL OR end_week>=sw)) THEN
    RAISE EXCEPTION 'Selected phase must be the unique latest non-overlapping phase. Review the phase list.';
  END IF;
  UPDATE phases SET end_week=NULL,duration_weeks=NULL WHERE id=p_phase_id AND compound_id=p_compound_id AND user_id=uid;
  SELECT public.protocol_phase_event_state_v1(p) INTO state FROM phases p
    WHERE p.id=p_phase_id AND p.compound_id=p_compound_id AND p.user_id=uid;
  INSERT INTO protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
  VALUES(uid,p_protocol_id,p_compound_id,current_date,'phase_continued',coalesce(pname,'Compound')||' phase continued',
    jsonb_build_object('version',1,'source','continue_phase','effectiveDate',current_date,'protocolId',p_protocol_id,
      'compoundId',p_compound_id,'phaseId',p_phase_id,'previousEndWeek',ew,'newEndWeek',NULL,'newState',state));
END $$;
-- Production had a direct anon grant; CREATE OR REPLACE preserves that ACL.
REVOKE EXECUTE ON FUNCTION public.continue_latest_phase(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.continue_latest_phase(uuid,uuid,uuid) TO authenticated,service_role,postgres;
COMMIT;
