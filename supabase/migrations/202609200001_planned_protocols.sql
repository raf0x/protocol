-- MPP-007: undated Planned protocols and atomic activation; no historical backfill.
BEGIN;
-- The canonical schema uses a text status. Fail safely on unexpected enum schemas.
DO $$ BEGIN
  IF (SELECT data_type NOT IN ('text','character varying') FROM information_schema.columns
      WHERE table_schema='public' AND table_name='protocols' AND column_name='status') THEN
    RAISE EXCEPTION 'Expected text protocols.status; inspect the deployed schema before applying MPP-007';
  END IF;
END $$;
ALTER TABLE public.protocols ALTER COLUMN start_date DROP NOT NULL;
-- Preserve each installation's existing status vocabulary (including stopped).
DO $$ DECLARE item record; BEGIN
  FOR item IN SELECT c.conname,pg_get_expr(c.conbin,c.conrelid) AS expression
    FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attname='status'
    WHERE c.conrelid='public.protocols'::regclass AND c.contype='c' AND c.conkey=ARRAY[a.attnum]
  LOOP
    EXECUTE format('ALTER TABLE public.protocols DROP CONSTRAINT %I',item.conname);
    EXECUTE format('ALTER TABLE public.protocols ADD CONSTRAINT %I CHECK ((%s) OR status = ''planned'')',item.conname,item.expression);
  END LOOP;
END $$;
ALTER TABLE public.protocols ADD CONSTRAINT protocols_planned_start_date
  CHECK (status IS DISTINCT FROM 'planned' OR start_date IS NULL) NOT VALID;

CREATE OR REPLACE FUNCTION public.save_protocol_dosing_v2(p_protocol_id uuid, p_name text, p_start_date date, p_compounds jsonb, p_continued_from_id uuid DEFAULT NULL, p_removed_compound_ids uuid[] DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); pid uuid; cid uuid; phid uuid; c jsonb; ph jsonb;
  cv numeric; cu text; dv numeric; du text; vol numeric; scale numeric; sw integer; ew integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 100
    OR jsonb_typeof(p_compounds) IS DISTINCT FROM 'array' OR jsonb_array_length(p_compounds) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid protocol'; END IF;
  IF p_continued_from_id IS NOT NULL AND (p_continued_from_id=p_protocol_id OR NOT EXISTS(SELECT 1 FROM protocols WHERE id=p_continued_from_id AND user_id=uid)) THEN RAISE EXCEPTION 'Invalid continued protocol'; END IF;
  IF p_protocol_id IS NULL THEN
    INSERT INTO protocols(user_id,name,start_date,status,continued_from_protocol_id) VALUES(uid,trim(p_name),p_start_date,CASE WHEN p_start_date IS NULL THEN 'planned' ELSE 'active' END,p_continued_from_id) RETURNING id INTO pid;
  ELSE
    SELECT id INTO pid FROM protocols WHERE id=p_protocol_id AND user_id=uid FOR UPDATE;
    IF pid IS NULL THEN RAISE EXCEPTION 'Protocol not found'; END IF;
    IF EXISTS(SELECT 1 FROM protocols WHERE id=pid AND ((status='planned' AND p_start_date IS NOT NULL) OR (status<>'planned' AND p_start_date IS NULL))) THEN
      RAISE EXCEPTION 'Use Activate to start a Planned protocol; existing protocols require a start date';
    END IF;
    UPDATE protocols SET name=trim(p_name), start_date=p_start_date, continued_from_protocol_id=p_continued_from_id WHERE id=pid AND user_id=uid;
  END IF;
  FOR c IN SELECT value FROM jsonb_array_elements(p_compounds) LOOP
    IF length(trim(c->>'name')) NOT BETWEEN 1 AND 100 OR c->>'name' IS NULL THEN RAISE EXCEPTION 'Invalid compound name'; END IF;
    ph := c->'phase';
    IF jsonb_typeof(ph->'dosing_entry') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Dosing entry required'; END IF;
    sw := (ph->>'start_week')::int; ew := (ph->>'end_week')::int;
    IF sw IS NULL OR sw<1 OR (ew IS NOT NULL AND ew<sw) THEN RAISE EXCEPTION 'Invalid phase range'; END IF;
    IF coalesce(ph->>'frequency','')<>'' AND ph->>'frequency' !~ '^(daily|[1-7]x/week|every[1-7]days)$' THEN RAISE EXCEPTION 'Invalid frequency'; END IF;
    IF jsonb_typeof(ph->'days_of_week')='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(ph->'days_of_week') WHERE value::int NOT BETWEEN 0 AND 6) THEN RAISE EXCEPTION 'Invalid schedule days'; END IF;
    cid := (c->>'id')::uuid;
    IF cid IS NULL THEN
      INSERT INTO compounds(user_id,protocol_id,name) VALUES(uid,pid,trim(c->>'name')) RETURNING id INTO cid;
    ELSE
      PERFORM 1 FROM compounds WHERE id=cid AND protocol_id=pid AND user_id=uid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Compound not found'; END IF;
    END IF;
    UPDATE compounds SET name=trim(c->>'name'),
      reconstitution_date=CASE WHEN c ? 'reconstitution_date' THEN (c->>'reconstitution_date')::date ELSE reconstitution_date END,
      notes=coalesce(c->>'notes',notes), vials_in_stock=coalesce((c->>'vials_in_stock')::int,vials_in_stock)
    WHERE id=cid AND user_id=uid;
    phid := (ph->>'id')::uuid;
    IF phid IS NOT NULL THEN
      PERFORM 1 FROM phases WHERE id=phid AND compound_id=cid AND user_id=uid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Phase not found'; END IF;
    END IF;
    IF phid IS NULL THEN
      INSERT INTO phases(user_id,compound_id,name,dose,dose_unit,dose_semantics_version,dosing_entry,start_week,end_week,frequency)
      VALUES(uid,cid,coalesce(ph->>'name','Phase'),NULL,NULL,NULL,ph->'dosing_entry',sw,ew,ph->>'frequency') RETURNING id INTO phid;
    END IF;
    UPDATE phases SET dosing_entry=ph->'dosing_entry',
      route=ph->>'route',start_week=sw,end_week=ew,duration_weeks=CASE WHEN ew IS NULL THEN NULL ELSE ew-sw+1 END,frequency=ph->>'frequency',
      days_of_week=CASE WHEN jsonb_typeof(ph->'days_of_week')='array' THEN ARRAY(SELECT value::int FROM jsonb_array_elements_text(ph->'days_of_week')) ELSE NULL END,
      day_of_week=(ph->>'day_of_week')::int,time_of_day=ph->>'time_of_day'
    WHERE id=phid AND user_id=uid;
  END LOOP;
  -- Only explicit, confirmed removal actions from the editor delete compounds.
  FOREACH cid IN ARRAY coalesce(p_removed_compound_ids,'{}'::uuid[]) LOOP
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_compounds) WHERE value->>'id'=cid::text) THEN RAISE EXCEPTION 'Cannot save and remove the same compound'; END IF;
    DELETE FROM compounds WHERE id=cid AND protocol_id=pid AND user_id=uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Removed compound not found'; END IF;
  END LOOP;
  IF p_protocol_id IS NULL AND p_start_date IS NOT NULL THEN
    INSERT INTO protocol_events(user_id,protocol_id,date,event_type,description) VALUES(uid,pid,p_start_date,'started','Started '||trim(p_name));
  END IF;
  RETURN pid;
END $$;
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
    PERFORM 1 FROM protocols WHERE id=p_protocol_id AND user_id=uid AND (status='planned' OR (effective>=start_date AND effective<=current_date)) FOR UPDATE;
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

CREATE OR REPLACE FUNCTION public.transition_protocol_v1(p_protocol_id uuid,p_action text,p_effective_date date DEFAULT current_date)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); effective date:=coalesce(p_effective_date,current_date); current_status text; started date; pname text;
  previous_completed timestamptz; next_status text; event_name text; item record; state jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT status,start_date,name,completed_date INTO current_status,started,pname,previous_completed
    FROM protocols WHERE id=p_protocol_id AND user_id=uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Protocol not found'; END IF;
  IF p_action='activate' THEN
    IF p_effective_date IS NULL THEN RAISE EXCEPTION 'Choose a start date'; END IF;
    -- The row lock serializes double clicks and retries without duplicate events.
    IF current_status='active' AND started=effective AND EXISTS(
      SELECT 1 FROM protocol_events WHERE protocol_id=p_protocol_id AND user_id=uid
        AND event_type='started' AND metadata->>'source'='protocol_activation') THEN RETURN; END IF;
    IF current_status IS DISTINCT FROM 'planned' THEN RAISE EXCEPTION 'Only a Planned protocol can be activated'; END IF;
    UPDATE protocols SET status='active',start_date=effective WHERE id=p_protocol_id AND user_id=uid;
    INSERT INTO protocol_events(user_id,protocol_id,date,event_type,description,metadata)
    VALUES(uid,p_protocol_id,effective,'started','Started '||coalesce(pname,'Protocol'),
      jsonb_build_object('version',1,'source','protocol_activation','effectiveDate',effective,'protocolId',p_protocol_id));
    FOR item IN SELECT ph.*,c.name AS compound_name FROM phases ph JOIN compounds c ON c.id=ph.compound_id
      WHERE c.protocol_id=p_protocol_id AND c.user_id=uid AND ph.user_id=uid LOOP
      SELECT public.protocol_phase_event_state_v1(ph) INTO state FROM phases ph WHERE ph.id=item.id;
      INSERT INTO protocol_events(user_id,protocol_id,compound_id,date,event_type,description,metadata)
      VALUES(uid,p_protocol_id,item.compound_id,effective,'phase_started',item.compound_name||' phase started',
        jsonb_build_object('version',1,'source','protocol_activation','effectiveDate',effective,'protocolId',p_protocol_id,
          'compoundId',item.compound_id,'compoundName',item.compound_name,'phaseId',item.id,'newState',state,
          'newDose',state->'medicationDose','newUnit',state->'medicationUnit','newFrequency',state->'frequency','newRoute',state->'route'));
    END LOOP;
    RETURN;
  END IF;
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

COMMIT;
