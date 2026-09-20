-- Release hotfix: validate against the newly submitted start date in both save layers.
-- NULL override resolves to today in the supplied timezone. No data rewrite or backfill.
-- Preserve the deployed migrations; only replace the two function definitions.
BEGIN;
CREATE OR REPLACE FUNCTION public.save_protocol_with_events_v1(
  p_protocol_id uuid,p_name text,p_start_date date,p_compounds jsonb,p_continued_from_id uuid DEFAULT NULL,
  p_removed_compound_ids uuid[] DEFAULT '{}',p_effective_date date DEFAULT current_date)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); pid uuid; effective date:=coalesce(p_effective_date,current_date);
  before_states jsonb:='{}'::jsonb; before_compounds jsonb:='{}'::jsonb; before_event_ids uuid[]:='{}';
  previous jsonb; current_state jsonb; previous_compound jsonb; item record; base jsonb; removed_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_protocol_id IS NOT NULL THEN
    PERFORM 1 FROM protocols WHERE id=p_protocol_id AND user_id=uid AND (status='planned' OR (effective>=p_start_date AND effective<=current_date)) FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Choose an effective date between the protocol start and today'; END IF;
    SELECT coalesce(jsonb_object_agg(ph.id::text,public.protocol_phase_event_state_v1(ph)),'{}'::jsonb)
      INTO before_states FROM compounds c JOIN phases ph ON ph.compound_id=c.id
      WHERE c.protocol_id=p_protocol_id AND c.user_id=uid AND ph.user_id=uid;
    SELECT coalesce(jsonb_object_agg(snapshot.compound_id::text,jsonb_build_object(
        'compoundId',snapshot.compound_id,'compoundName',snapshot.compound_name,'phaseStates',snapshot.phase_states)),'{}'::jsonb)
      INTO before_compounds
      FROM (
        SELECT c.id AS compound_id,c.name AS compound_name,
          coalesce(jsonb_agg(public.protocol_phase_event_state_v1(ph) ORDER BY ph.start_week,ph.id)
            FILTER (WHERE ph.id IS NOT NULL),'[]'::jsonb) AS phase_states
        FROM compounds c LEFT JOIN phases ph ON ph.compound_id=c.id AND ph.user_id=uid
        WHERE c.protocol_id=p_protocol_id AND c.user_id=uid GROUP BY c.id,c.name
      ) snapshot;
    SELECT coalesce(array_agg(id),'{}') INTO before_event_ids FROM protocol_events WHERE protocol_id=p_protocol_id AND user_id=uid;
  END IF;

  pid:=public.save_protocol_dosing_v2(p_protocol_id,p_name,p_start_date,p_compounds,p_continued_from_id,p_removed_compound_ids);
  IF p_start_date IS NULL THEN RETURN pid; END IF;
  IF p_protocol_id IS NULL THEN
    UPDATE protocol_events SET metadata=jsonb_build_object('version',1,'source','protocol_editor','effectiveDate',p_start_date,'protocolId',pid)
      WHERE user_id=uid AND protocol_id=pid AND event_type='started' AND NOT(id=ANY(before_event_ids));
  END IF;

  -- The current compound row may be deleted by save_protocol_dosing_v2. Preserve
  -- identity and all retained phase snapshots in metadata without depending on a
  -- surviving compound foreign key. This is prospective only; no old removal is guessed.
  FOREACH removed_id IN ARRAY coalesce(p_removed_compound_ids,'{}'::uuid[]) LOOP
    previous_compound:=before_compounds->(removed_id::text);
    IF previous_compound IS NOT NULL THEN
      INSERT INTO protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
      VALUES(uid,pid,NULL,effective,'compound_removed',coalesce(previous_compound->>'compoundName','Compound')||' removed',
        jsonb_build_object('version',1,'source','protocol_editor','effectiveDate',effective,'protocolId',pid,
          'compoundId',removed_id,'compoundName',previous_compound->>'compoundName','previousStates',previous_compound->'phaseStates'));
    END IF;
  END LOOP;

  -- Existing protocols can gain compounds. Record the exact identity and the
  -- phase snapshots present at the effective date so replay does not project a
  -- newly added compound backward to the protocol start. New protocols already
  -- have a protocol start boundary, so they do not need redundant add events.
  IF p_protocol_id IS NOT NULL THEN
    FOR item IN
      SELECT c.id AS compound_id,c.name AS compound_name,
        coalesce(jsonb_agg(public.protocol_phase_event_state_v1(ph) ORDER BY ph.start_week,ph.id)
          FILTER (WHERE ph.id IS NOT NULL),'[]'::jsonb) AS phase_states
      FROM compounds c LEFT JOIN phases ph ON ph.compound_id=c.id AND ph.user_id=uid
      WHERE c.protocol_id=pid AND c.user_id=uid GROUP BY c.id,c.name
    LOOP
      IF before_compounds->(item.compound_id::text) IS NULL THEN
        INSERT INTO protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
        VALUES(uid,pid,item.compound_id,effective,'compound_added',coalesce(item.compound_name,'Compound')||' added',
          jsonb_build_object('version',1,'source','protocol_editor','effectiveDate',effective,'protocolId',pid,
            'compoundId',item.compound_id,'compoundName',item.compound_name,'newStates',item.phase_states));
      END IF;
    END LOOP;
  END IF;

  FOR item IN SELECT ph.id AS phase_id,ph.compound_id,public.protocol_phase_event_state_v1(ph) AS event_state,c.name AS compound_name
    FROM compounds c JOIN phases ph ON ph.compound_id=c.id
    WHERE c.protocol_id=pid AND c.user_id=uid AND ph.user_id=uid
  LOOP
    current_state:=item.event_state;
    previous:=before_states->(item.phase_id::text);
    base:=jsonb_build_object('version',1,'source','protocol_editor','effectiveDate',effective,'protocolId',pid,
      'compoundId',item.compound_id,'compoundName',item.compound_name,'phaseId',item.phase_id);
    IF previous IS NULL THEN
      INSERT INTO protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
      VALUES(uid,pid,item.compound_id,CASE WHEN p_protocol_id IS NULL THEN p_start_date ELSE effective END,'phase_started',
        coalesce(item.compound_name,'Compound')||' phase started',base||jsonb_build_object('newState',current_state,
        'newDose',current_state->'medicationDose','newUnit',current_state->'medicationUnit','newFrequency',current_state->'frequency','newRoute',current_state->'route'));
    ELSE
      IF previous->'startWeek' IS DISTINCT FROM current_state->'startWeek' OR previous->'endWeek' IS DISTINCT FROM current_state->'endWeek' THEN
        INSERT INTO protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
        VALUES(uid,pid,item.compound_id,effective,'phase_boundary_change',coalesce(item.compound_name,'Compound')||' phase boundary changed',
          base||jsonb_build_object('previousState',previous,'newState',current_state));
      END IF;
      IF previous->'doseFingerprint' IS DISTINCT FROM current_state->'doseFingerprint' THEN
        INSERT INTO protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
        VALUES(uid,pid,item.compound_id,effective,'dose_change',coalesce(item.compound_name,'Compound')||' dosing updated',
          base||jsonb_build_object('previousState',previous,'newState',current_state,'previousDose',previous->'medicationDose',
          'previousUnit',previous->'medicationUnit','newDose',current_state->'medicationDose','newUnit',current_state->'medicationUnit'));
      END IF;
      IF previous->'preparationFingerprint' IS DISTINCT FROM current_state->'preparationFingerprint'
        AND previous->'doseFingerprint' IS NOT DISTINCT FROM current_state->'doseFingerprint' THEN
        INSERT INTO protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
        VALUES(uid,pid,item.compound_id,effective,'preparation_change',coalesce(item.compound_name,'Compound')||' preparation updated',
          base||jsonb_build_object('previousState',previous,'newState',current_state));
      END IF;
      IF previous->'frequency' IS DISTINCT FROM current_state->'frequency' THEN
        INSERT INTO protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
        VALUES(uid,pid,item.compound_id,effective,'frequency_change',coalesce(item.compound_name,'Compound')||' frequency changed',
          base||jsonb_build_object('previousFrequency',previous->'frequency','newFrequency',current_state->'frequency','previousState',previous,'newState',current_state));
      END IF;
      IF previous->'route' IS DISTINCT FROM current_state->'route' THEN
        INSERT INTO protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
        VALUES(uid,pid,item.compound_id,effective,'route_change',coalesce(item.compound_name,'Compound')||' route changed',
          base||jsonb_build_object('previousRoute',previous->'route','newRoute',current_state->'route','previousState',previous,'newState',current_state));
      END IF;
    END IF;
  END LOOP;
  RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.save_protocol_with_events_v2(
  p_protocol_id uuid,p_name text,p_start_date date,p_compounds jsonb,
  p_continued_from_id uuid DEFAULT NULL,p_removed_compound_ids uuid[] DEFAULT '{}',
  p_effective_date date DEFAULT NULL,p_timezone text DEFAULT 'UTC')
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public SET timezone='UTC' AS $$
DECLARE uid uuid:=auth.uid(); effective date; local_today date; current_status text;
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
    SELECT status INTO current_status FROM public.protocols
      WHERE id=p_protocol_id AND user_id=uid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Protocol not found'; END IF;
    effective:=coalesce(p_effective_date,local_today);
    IF current_status IS DISTINCT FROM 'planned' THEN
      IF effective < p_start_date THEN
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
-- Completion must use the same local calendar as editing. Preserve canonical
-- transition identity, status checks, retry behavior and event construction.
CREATE OR REPLACE FUNCTION public.transition_protocol_v2(
  p_protocol_id uuid,p_action text,p_effective_date date DEFAULT NULL,p_timezone text DEFAULT 'UTC')
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public SET timezone='UTC' AS $$
DECLARE uid uuid:=auth.uid(); effective date; started date;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'Choose a valid timezone'; END IF;
  PERFORM set_config('TimeZone',p_timezone,true);
  SELECT start_date INTO started FROM public.protocols WHERE id=p_protocol_id AND user_id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Protocol not found'; END IF;
  effective:=coalesce(p_effective_date,current_date);
  IF p_action='complete' THEN
    IF effective<started THEN RAISE EXCEPTION 'Completion date cannot be before the protocol start date (%). Correct the start date in Edit protocol if it is wrong.',started; END IF;
    IF effective>current_date THEN RAISE EXCEPTION 'Completion date cannot be in the future.'; END IF;
  END IF;
  PERFORM public.transition_protocol_v1(p_protocol_id,p_action,effective);
END $$;
REVOKE ALL ON FUNCTION public.transition_protocol_v2(uuid,text,date,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transition_protocol_v2(uuid,text,date,text) TO authenticated;
COMMIT;
