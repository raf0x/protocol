-- Save entered dosing without inventing medication semantics. No data backfill.
BEGIN;
DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.phases'::regclass AND attname='dosing_entry' AND NOT attisdropped AND (atttypid<>'jsonb'::regtype OR attnotnull OR atthasdef)) THEN
    RAISE EXCEPTION 'Existing phases.dosing_entry is incompatible; inspect before retrying';
  END IF;
END $$;
ALTER TABLE public.phases ADD COLUMN IF NOT EXISTS dosing_entry jsonb;
-- Unknown new medication doses must be NULL, never a fabricated zero or volume.
ALTER TABLE public.phases ALTER COLUMN dose DROP NOT NULL, ALTER COLUMN dose_unit DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.require_medication_dose_v1() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE k text; v numeric;
BEGIN
  IF NEW.dosing_entry IS NOT NULL THEN
    IF jsonb_typeof(NEW.dosing_entry) IS DISTINCT FROM 'object' OR NEW.dosing_entry->>'version' IS DISTINCT FROM '2'
      OR coalesce(NEW.dosing_entry->>'mode','') NOT IN ('medication','syringe','volume','unknown')
      OR coalesce(NEW.dosing_entry->>'review_status','') NOT IN ('confirmed','unverified') THEN RAISE EXCEPTION 'Invalid dosing entry'; END IF;
    FOREACH k IN ARRAY ARRAY['dose','syringe_markings','syringe_scale','injection_volume','vial_strength','bac_water_ml','concentration_value'] LOOP
      IF jsonb_typeof(NEW.dosing_entry->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid numeric input: %',k; END IF;
      IF trim(NEW.dosing_entry->>k)<>'' THEN
        v:=(NEW.dosing_entry->>k)::numeric;
        IF v<0 OR v>='Infinity'::numeric OR (k='syringe_scale' AND v=0) THEN RAISE EXCEPTION 'Invalid numeric input: %',k; END IF;
      END IF;
    END LOOP;
    FOREACH k IN ARRAY ARRAY['dose_unit','vial_unit','concentration_unit','vial_label'] LOOP
      IF jsonb_typeof(NEW.dosing_entry->k) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'Invalid text input: %',k; END IF;
    END LOOP;
    -- V2 edits preserve legacy columns. Raw JSON is separately authoritative.
    IF TG_OP='UPDATE' AND (NEW.dose IS DISTINCT FROM OLD.dose OR NEW.dose_unit IS DISTINCT FROM OLD.dose_unit OR NEW.dose_semantics_version IS DISTINCT FROM OLD.dose_semantics_version) THEN
      RAISE EXCEPTION 'Save raw dosing separately from historical medication columns';
    END IF;
    IF TG_OP='INSERT' AND (NEW.dose IS NOT NULL OR NEW.dose_unit IS NOT NULL OR NEW.dose_semantics_version IS NOT NULL) THEN RAISE EXCEPTION 'New raw dosing requires empty legacy medication columns'; END IF;
    RETURN NEW;
  END IF;
  IF TG_OP='UPDATE' AND OLD.dosing_entry IS NOT NULL THEN RAISE EXCEPTION 'Use the dosing entry editor for this phase'; END IF;
  IF TG_OP = 'UPDATE' AND OLD.dose_semantics_version=1 AND NEW.dose_semantics_version IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Cannot remove confirmed medication semantics'; END IF;
  IF TG_OP = 'INSERT' OR NEW.dose IS DISTINCT FROM OLD.dose OR NEW.dose_unit IS DISTINCT FROM OLD.dose_unit THEN
    IF NEW.dose_semantics_version IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Medication dose must be explicitly confirmed as Dosing Semantics V1'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION public.save_protocol_dosing_v2(p_protocol_id uuid, p_name text, p_start_date date, p_compounds jsonb, p_continued_from_id uuid DEFAULT NULL, p_removed_compound_ids uuid[] DEFAULT '{}')
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); pid uuid; cid uuid; phid uuid; c jsonb; ph jsonb;
  cv numeric; cu text; dv numeric; du text; vol numeric; scale numeric; sw integer; ew integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_name IS NULL OR length(trim(p_name)) NOT BETWEEN 1 AND 100 OR p_start_date IS NULL
    OR jsonb_typeof(p_compounds) IS DISTINCT FROM 'array' OR jsonb_array_length(p_compounds) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid protocol'; END IF;
  IF p_continued_from_id IS NOT NULL AND (p_continued_from_id=p_protocol_id OR NOT EXISTS(SELECT 1 FROM protocols WHERE id=p_continued_from_id AND user_id=uid)) THEN RAISE EXCEPTION 'Invalid continued protocol'; END IF;
  IF p_protocol_id IS NULL THEN
    INSERT INTO protocols(user_id,name,start_date,continued_from_protocol_id) VALUES(uid,trim(p_name),p_start_date,p_continued_from_id) RETURNING id INTO pid;
  ELSE
    SELECT id INTO pid FROM protocols WHERE id=p_protocol_id AND user_id=uid FOR UPDATE;
    IF pid IS NULL THEN RAISE EXCEPTION 'Protocol not found'; END IF;
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
  IF p_protocol_id IS NULL THEN
    INSERT INTO protocol_events(user_id,protocol_id,date,event_type,description) VALUES(uid,pid,p_start_date,'started','Started '||trim(p_name));
  END IF;
  RETURN pid;
END $$;
REVOKE ALL ON FUNCTION public.save_protocol_dosing_v2(uuid,text,date,jsonb,uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_protocol_dosing_v2(uuid,text,date,jsonb,uuid,uuid[]) TO authenticated;
COMMIT;
