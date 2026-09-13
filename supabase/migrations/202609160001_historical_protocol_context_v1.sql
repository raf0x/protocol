-- Consolidate prospective protocol history capture without rewriting historical rows.
BEGIN;

-- Extend the existing phase snapshot with a preparation-only fingerprint. This is
-- history metadata, not a medication-dose conversion or a new source of truth.
CREATE OR REPLACE FUNCTION public.protocol_phase_event_state_v1(p public.phases)
RETURNS jsonb LANGUAGE sql STABLE SET search_path=public AS $$
  SELECT jsonb_build_object(
    'phaseId',p.id,'compoundId',p.compound_id,'startWeek',p.start_week,'endWeek',p.end_week,
    'medicationDose',CASE
      WHEN p.dosing_entry->>'review_status'='confirmed' AND p.dosing_entry->>'mode'='medication'
        AND p.dosing_entry->>'dose'~'^[+]?[0-9]*[.]?[0-9]+$'
        AND p.dosing_entry->>'dose_unit' IN ('mg','mcg','IU') THEN (p.dosing_entry->>'dose')::numeric
      WHEN p.dosing_entry IS NULL AND p.dose_semantics_version=1 THEN p.dose ELSE NULL END,
    'medicationUnit',CASE
      WHEN p.dosing_entry->>'review_status'='confirmed' AND p.dosing_entry->>'mode'='medication'
        AND p.dosing_entry->>'dose_unit' IN ('mg','mcg','IU') THEN p.dosing_entry->>'dose_unit'
      WHEN p.dosing_entry IS NULL AND p.dose_semantics_version=1 THEN p.dose_unit ELSE NULL END,
    'doseConfirmed',CASE
      WHEN p.dosing_entry IS NOT NULL THEN p.dosing_entry->>'review_status'='confirmed' AND p.dosing_entry->>'mode'='medication'
      ELSE p.dose_semantics_version=1 AND p.dose IS NOT NULL AND p.dose_unit IN ('mg','mcg','IU') END,
    'frequency',p.frequency,'route',p.route,'dosingEntry',p.dosing_entry,
    'doseFingerprint',CASE WHEN p.dosing_entry IS NOT NULL THEN jsonb_build_object(
      'mode',p.dosing_entry->>'mode','reviewStatus',p.dosing_entry->>'review_status',
      'dose',CASE WHEN p.dosing_entry->>'mode'='medication' THEN p.dosing_entry->>'dose' END,
      'doseUnit',CASE WHEN p.dosing_entry->>'mode'='medication' THEN p.dosing_entry->>'dose_unit' END,
      'syringeMarkings',CASE WHEN p.dosing_entry->>'mode' IN ('syringe','unknown') THEN p.dosing_entry->>'syringe_markings' END,
      'syringeScale',CASE WHEN p.dosing_entry->>'mode' IN ('syringe','unknown') THEN p.dosing_entry->>'syringe_scale' END,
      'injectionVolume',CASE WHEN p.dosing_entry->>'mode' IN ('volume','unknown') THEN p.dosing_entry->>'injection_volume' END)
    ELSE jsonb_build_object('dose',p.dose,'doseUnit',p.dose_unit,'semanticsVersion',p.dose_semantics_version,
      'injectionVolumeMl',p.injection_volume_ml,'syringeUnits',p.syringe_units,'syringeScale',p.syringe_scale) END,
    'preparationFingerprint',CASE WHEN p.dosing_entry IS NOT NULL THEN jsonb_build_object(
      'vialStrength',p.dosing_entry->>'vial_strength','vialUnit',p.dosing_entry->>'vial_unit',
      'bacWaterMl',p.dosing_entry->>'bac_water_ml','concentrationValue',p.dosing_entry->>'concentration_value',
      'concentrationUnit',p.dosing_entry->>'concentration_unit','vialLabel',p.dosing_entry->>'vial_label')
    ELSE jsonb_build_object('injectionVolumeMl',p.injection_volume_ml,'syringeUnits',p.syringe_units,'syringeScale',p.syringe_scale) END
  )
$$;

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
    PERFORM 1 FROM protocols WHERE id=p_protocol_id AND user_id=uid AND effective>=start_date AND effective<=current_date FOR UPDATE;
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

CREATE OR REPLACE FUNCTION public.transition_protocol_v1(p_protocol_id uuid,p_action text,p_effective_date date DEFAULT current_date)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); effective date:=coalesce(p_effective_date,current_date); current_status text; started date; pname text;
  previous_completed timestamptz; next_status text; event_name text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT status,start_date,name,completed_date INTO current_status,started,pname,previous_completed
    FROM protocols WHERE id=p_protocol_id AND user_id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Protocol not found'; END IF;
  IF effective<started OR effective>current_date THEN RAISE EXCEPTION 'Choose an effective date between the protocol start and today'; END IF;
  IF p_action='pause' THEN
    IF current_status='paused' THEN RETURN; END IF;
    IF current_status<>'active' THEN RAISE EXCEPTION 'Only an active protocol can be paused'; END IF;
    next_status:='paused'; event_name:='paused';
    UPDATE protocols SET status=next_status WHERE id=p_protocol_id AND user_id=uid;
  ELSIF p_action='resume' THEN
    IF current_status='active' THEN RETURN; END IF;
    IF current_status<>'paused' THEN RAISE EXCEPTION 'Only a paused protocol can be resumed'; END IF;
    next_status:='active'; event_name:='resumed';
    UPDATE protocols SET status=next_status WHERE id=p_protocol_id AND user_id=uid;
  ELSIF p_action='complete' THEN
    IF current_status='completed' THEN RETURN; END IF;
    IF current_status NOT IN ('active','paused') THEN RAISE EXCEPTION 'This protocol cannot be completed'; END IF;
    next_status:='completed'; event_name:='completed';
    UPDATE protocols SET status=next_status,completed_date=effective::timestamptz WHERE id=p_protocol_id AND user_id=uid;
  ELSIF p_action='reactivate' THEN
    IF current_status='active' THEN RETURN; END IF;
    IF current_status<>'completed' THEN RAISE EXCEPTION 'Only a completed protocol can be reactivated'; END IF;
    IF previous_completed IS NOT NULL AND effective < previous_completed::date THEN RAISE EXCEPTION 'Reactivation cannot precede the recorded completion date'; END IF;
    next_status:='active'; event_name:='reactivated';
    UPDATE protocols SET status=next_status,completed_date=NULL WHERE id=p_protocol_id AND user_id=uid;
  ELSE RAISE EXCEPTION 'Unsupported protocol transition'; END IF;
  INSERT INTO protocol_events(user_id,protocol_id,date,event_type,description,metadata)
  VALUES(uid,p_protocol_id,effective,event_name,coalesce(pname,'Protocol')||' '||event_name,
    jsonb_build_object('version',1,'source','protocol_action','effectiveDate',effective,'protocolId',p_protocol_id,
      'previousStatus',current_status,'newStatus',next_status,'previousCompletedDate',previous_completed));
END $$;

REVOKE ALL ON FUNCTION public.protocol_phase_event_state_v1(public.phases),
  public.save_protocol_with_events_v1(uuid,text,date,jsonb,uuid,uuid[],date),public.transition_protocol_v1(uuid,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.protocol_phase_event_state_v1(public.phases),
  public.save_protocol_with_events_v1(uuid,text,date,jsonb,uuid,uuid[],date),public.transition_protocol_v1(uuid,text,date) TO authenticated;

COMMIT;
