-- Additive structured protocol history. No historical rows are rewritten.
BEGIN;

DO $preflight$
DECLARE col record;
BEGIN
  SELECT format_type(a.atttypid,a.atttypmod) AS typ,a.attnotnull,a.attgenerated,a.attidentity,
    pg_get_expr(d.adbin,d.adrelid) AS default_expr
  INTO col FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
  WHERE a.attrelid='public.protocol_events'::regclass AND a.attname='metadata' AND NOT a.attisdropped;
  IF FOUND AND (col.typ<>'jsonb' OR col.attnotnull OR col.attgenerated<>'' OR col.attidentity<>'' OR col.default_expr IS NOT NULL) THEN
    RAISE EXCEPTION 'Existing protocol_events.metadata is incompatible. No change was made.';
  END IF;
END $preflight$;

ALTER TABLE public.protocol_events ADD COLUMN IF NOT EXISTS metadata jsonb;

DO $constraints$
DECLARE wanted text; existing text;
BEGIN
  CREATE TEMP TABLE protocol_events_metadata_expected(metadata jsonb) ON COMMIT DROP;
  ALTER TABLE protocol_events_metadata_expected ADD CONSTRAINT protocol_events_metadata_v1
    CHECK (metadata IS NULL OR (jsonb_typeof(metadata)='object' AND octet_length(metadata::text)<=100000)) NOT VALID;
  SELECT pg_get_constraintdef(oid) INTO wanted FROM pg_constraint
    WHERE conrelid='pg_temp.protocol_events_metadata_expected'::regclass AND conname='protocol_events_metadata_v1';
  SELECT pg_get_constraintdef(oid) INTO existing FROM pg_constraint
    WHERE conrelid='public.protocol_events'::regclass AND conname='protocol_events_metadata_v1';
  IF FOUND THEN
    IF replace(existing,' NOT VALID','') <> replace(wanted,' NOT VALID','') THEN
      RAISE EXCEPTION 'Existing protocol_events_metadata_v1 constraint is incompatible. No change was made.';
    END IF;
  ELSE
    ALTER TABLE public.protocol_events ADD CONSTRAINT protocol_events_metadata_v1
      CHECK (metadata IS NULL OR (jsonb_typeof(metadata)='object' AND octet_length(metadata::text)<=100000)) NOT VALID;
  END IF;
END $constraints$;

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
      'injectionVolumeMl',p.injection_volume_ml,'syringeUnits',p.syringe_units,'syringeScale',p.syringe_scale) END
  )
$$;

CREATE OR REPLACE FUNCTION public.save_protocol_with_events_v1(
  p_protocol_id uuid,p_name text,p_start_date date,p_compounds jsonb,p_continued_from_id uuid DEFAULT NULL,
  p_removed_compound_ids uuid[] DEFAULT '{}',p_effective_date date DEFAULT current_date)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); pid uuid; effective date:=coalesce(p_effective_date,current_date);
  before_states jsonb:='{}'::jsonb; before_event_ids uuid[]:='{}'; previous jsonb; current_state jsonb; item record; base jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_protocol_id IS NOT NULL THEN
    PERFORM 1 FROM protocols WHERE id=p_protocol_id AND user_id=uid AND effective>=start_date AND effective<=current_date FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Choose an effective date between the protocol start and today'; END IF;
    SELECT coalesce(jsonb_object_agg(ph.id::text,public.protocol_phase_event_state_v1(ph)),'{}'::jsonb)
      INTO before_states FROM compounds c JOIN phases ph ON ph.compound_id=c.id
      WHERE c.protocol_id=p_protocol_id AND c.user_id=uid AND ph.user_id=uid;
    SELECT coalesce(array_agg(id),'{}') INTO before_event_ids FROM protocol_events WHERE protocol_id=p_protocol_id AND user_id=uid;
  END IF;

  pid:=public.save_protocol_dosing_v2(p_protocol_id,p_name,p_start_date,p_compounds,p_continued_from_id,p_removed_compound_ids);
  IF p_protocol_id IS NULL THEN
    UPDATE protocol_events SET metadata=jsonb_build_object('version',1,'source','protocol_editor','effectiveDate',p_start_date,'protocolId',pid)
      WHERE user_id=uid AND protocol_id=pid AND event_type='started' AND NOT(id=ANY(before_event_ids));
  END IF;

  FOR item IN SELECT ph.id AS phase_id,ph.compound_id,public.protocol_phase_event_state_v1(ph) AS event_state,c.name AS compound_name
    FROM compounds c JOIN phases ph ON ph.compound_id=c.id
    WHERE c.protocol_id=pid AND c.user_id=uid AND ph.user_id=uid
  LOOP
    current_state:=item.event_state;
    previous:=before_states->(item.phase_id::text);
    base:=jsonb_build_object('version',1,'source','protocol_editor','effectiveDate',effective,'protocolId',pid,
      'compoundId',item.compound_id,'phaseId',item.phase_id);
    IF previous IS NULL THEN
      INSERT INTO protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
      VALUES(uid,pid,item.compound_id,CASE WHEN p_protocol_id IS NULL THEN p_start_date ELSE effective END,'phase_started',
        coalesce(item.compound_name,'Compound')||' phase started',base||jsonb_build_object('newState',current_state,
        'newDose',current_state->'medicationDose','newUnit',current_state->'medicationUnit','newFrequency',current_state->'frequency','newRoute',current_state->'route'));
    ELSE
      IF previous->'doseFingerprint' IS DISTINCT FROM current_state->'doseFingerprint' THEN
        INSERT INTO protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
        VALUES(uid,pid,item.compound_id,effective,'dose_change',coalesce(item.compound_name,'Compound')||' dosing updated',
          base||jsonb_build_object('previousState',previous,'newState',current_state,'previousDose',previous->'medicationDose',
          'previousUnit',previous->'medicationUnit','newDose',current_state->'medicationDose','newUnit',current_state->'medicationUnit'));
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

CREATE OR REPLACE FUNCTION public.change_protocol_dose_v1(p_protocol_id uuid,p_compound_id uuid,p_dosing_entry jsonb,p_effective_date date DEFAULT current_date)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); effective date:=coalesce(p_effective_date,current_date); protocol_start date; wk integer;
  existing public.phases%rowtype; created public.phases%rowtype; old_state jsonb; new_state jsonb; old_end integer; matches integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT start_date INTO protocol_start FROM protocols WHERE id=p_protocol_id AND user_id=uid AND status='active' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Only an active protocol can change dose'; END IF;
  IF effective<protocol_start OR effective>current_date THEN RAISE EXCEPTION 'Choose an effective date between the protocol start and today'; END IF;
  PERFORM 1 FROM compounds WHERE id=p_compound_id AND protocol_id=p_protocol_id AND user_id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Compound not found'; END IF;
  wk:=floor((effective-protocol_start)/7)+1;
  SELECT count(*) INTO matches FROM phases WHERE compound_id=p_compound_id AND user_id=uid AND start_week<=wk AND (end_week IS NULL OR end_week>=wk);
  IF matches<>1 THEN RAISE EXCEPTION 'A single current phase is required. Review phase history first.'; END IF;
  SELECT * INTO existing FROM phases WHERE compound_id=p_compound_id AND user_id=uid AND start_week<=wk AND (end_week IS NULL OR end_week>=wk) FOR UPDATE;
  IF existing.dosing_entry=p_dosing_entry THEN RETURN existing.id; END IF;
  old_state:=public.protocol_phase_event_state_v1(existing);
  IF wk>existing.start_week THEN
    old_end:=existing.end_week;
    UPDATE phases SET end_week=wk-1,duration_weeks=wk-existing.start_week WHERE id=existing.id AND user_id=uid;
    INSERT INTO phases(user_id,compound_id,name,dose,dose_unit,dose_semantics_version,dosing_entry,start_week,end_week,duration_weeks,
      frequency,days_of_week,day_of_week,time_of_day,route)
    VALUES(uid,p_compound_id,existing.name,NULL,NULL,NULL,p_dosing_entry,wk,old_end,
      CASE WHEN old_end IS NULL THEN NULL ELSE old_end-wk+1 END,existing.frequency,existing.days_of_week,existing.day_of_week,existing.time_of_day,existing.route)
    RETURNING * INTO created;
  ELSE
    UPDATE phases SET dosing_entry=p_dosing_entry WHERE id=existing.id AND user_id=uid RETURNING * INTO created;
  END IF;
  new_state:=public.protocol_phase_event_state_v1(created);
  INSERT INTO protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
  VALUES(uid,p_protocol_id,p_compound_id,effective,'dose_change','Dose updated',jsonb_build_object('version',1,'source','quick_dose_change',
    'effectiveDate',effective,'protocolId',p_protocol_id,'compoundId',p_compound_id,'phaseId',created.id,
    'previousPhaseId',existing.id,'previousDose',old_state->'medicationDose','previousUnit',old_state->'medicationUnit',
    'newDose',new_state->'medicationDose','newUnit',new_state->'medicationUnit','previousState',old_state,'newState',new_state));
  RETURN created.id;
END $$;

CREATE OR REPLACE FUNCTION public.transition_protocol_v1(p_protocol_id uuid,p_action text,p_effective_date date DEFAULT current_date)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); effective date:=coalesce(p_effective_date,current_date); current_status text; started date; pname text; next_status text; event_name text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT status,start_date,name INTO current_status,started,pname FROM protocols WHERE id=p_protocol_id AND user_id=uid FOR UPDATE;
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
  ELSE RAISE EXCEPTION 'Unsupported protocol transition'; END IF;
  INSERT INTO protocol_events(user_id,protocol_id,date,event_type,description,metadata)
  VALUES(uid,p_protocol_id,effective,event_name,coalesce(pname,'Protocol')||' '||event_name,
    jsonb_build_object('version',1,'source','protocol_action','effectiveDate',effective,'protocolId',p_protocol_id,
      'previousStatus',current_status,'newStatus',next_status));
END $$;

CREATE OR REPLACE FUNCTION public.continue_latest_phase(p_protocol_id uuid,p_compound_id uuid,p_phase_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); sw integer; ew integer; pname text; state jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  PERFORM 1 FROM protocols WHERE id=p_protocol_id AND user_id=uid AND status='active' FOR UPDATE;
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

REVOKE ALL ON FUNCTION public.protocol_phase_event_state_v1(public.phases),
  public.save_protocol_with_events_v1(uuid,text,date,jsonb,uuid,uuid[],date),
  public.change_protocol_dose_v1(uuid,uuid,jsonb,date),public.transition_protocol_v1(uuid,text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.protocol_phase_event_state_v1(public.phases),
  public.save_protocol_with_events_v1(uuid,text,date,jsonb,uuid,uuid[],date),
  public.change_protocol_dose_v1(uuid,uuid,jsonb,date),public.transition_protocol_v1(uuid,text,date) TO authenticated;

COMMIT;
