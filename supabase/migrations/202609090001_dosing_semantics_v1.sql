-- Additive migration: no data UPDATE, DELETE, backfill, or name-based repair.
BEGIN;
-- Stop rather than coerce an unknown production column definition. In particular,
-- a default version would silently label historical rows as reviewed.
DO $preflight$
DECLARE spec record; col record;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('compounds','concentration_value','numeric'),
    ('compounds','concentration_unit','text'),
    ('phases','dose_semantics_version','smallint'),
    ('phases','injection_volume_ml','numeric'),
    ('phases','syringe_units','numeric'),
    ('phases','syringe_scale','numeric'),
    ('phases','route','text')
  ) AS fields(tbl,field,expected_type) LOOP
    SELECT format_type(a.atttypid,a.atttypmod) AS typ, a.attnotnull,
      a.attgenerated, a.attidentity, pg_get_expr(d.adbin,d.adrelid) AS default_expr
    INTO col FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE a.attrelid=format('public.%I',spec.tbl)::regclass
      AND a.attname=spec.field AND NOT a.attisdropped;
    IF FOUND AND (col.typ <> spec.expected_type OR col.attnotnull
      OR col.attgenerated <> '' OR col.attidentity <> '' OR col.default_expr IS NOT NULL) THEN
      RAISE EXCEPTION 'Incompatible existing column %.% (type %, default %, not null %). No conversion performed; inspect its definition and semantics before retrying.',
        spec.tbl,spec.field,col.typ,col.default_expr,col.attnotnull;
    END IF;
  END LOOP;
END $preflight$;
ALTER TABLE public.compounds
  ADD COLUMN IF NOT EXISTS concentration_value numeric,
  ADD COLUMN IF NOT EXISTS concentration_unit text;
ALTER TABLE public.phases
  ADD COLUMN IF NOT EXISTS dose_semantics_version smallint,
  ADD COLUMN IF NOT EXISTS injection_volume_ml numeric,
  ADD COLUMN IF NOT EXISTS syringe_units numeric,
  ADD COLUMN IF NOT EXISTS syringe_scale numeric,
  ADD COLUMN IF NOT EXISTS route text;
-- NOT VALID avoids scanning/rejecting legacy concentrations on installation.
-- Phase administration checks apply only to explicitly reviewed V1 rows.
-- Existing same-name constraints must have the expected definition, not merely a
-- matching name. Temporary tables contain no user data and disappear at commit.
DO $constraints$
DECLARE spec record; wanted text; existing text;
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('compounds','compounds_concentration_v1',$check$CHECK ((concentration_value IS NULL AND concentration_unit IS NULL) OR
  (concentration_value IS NOT NULL AND concentration_value > 0 AND concentration_value < 'Infinity'::numeric
   AND concentration_unit IS NOT NULL AND concentration_unit IN ('mg/mL','mcg/mL','IU/mL')))$check$),
    ('phases','phases_dosing_v1',$check$CHECK (dose_semantics_version IS NULL OR (dose_semantics_version = 1
  AND (dose IS NOT NULL AND dose > 0 AND dose < 'Infinity'::numeric AND dose_unit IS NOT NULL AND dose_unit IN ('mg','mcg','IU'))
  AND (injection_volume_ml IS NULL OR (injection_volume_ml > 0 AND injection_volume_ml < 'Infinity'::numeric))
  AND ((syringe_units IS NULL AND syringe_scale IS NULL) OR
    (syringe_units IS NOT NULL AND syringe_units > 0 AND syringe_units < 'Infinity'::numeric AND syringe_scale IS NOT NULL AND syringe_scale IN (40,100) AND injection_volume_ml IS NOT NULL
     AND abs(syringe_units - injection_volume_ml * syringe_scale) < 0.000001))
  AND (route IS NULL OR route IN ('IM','SubQ'))))$check$)
  ) AS checks(tbl,cname,definition) LOOP
    EXECUTE format('CREATE TEMP TABLE %I (LIKE public.%I) ON COMMIT DROP','dosing_expected_'||spec.tbl,spec.tbl);
    EXECUTE format('ALTER TABLE pg_temp.%I ADD CONSTRAINT %I %s NOT VALID','dosing_expected_'||spec.tbl,spec.cname,spec.definition);
    SELECT pg_get_constraintdef(oid) INTO wanted FROM pg_constraint
      WHERE conrelid=format('pg_temp.%I','dosing_expected_'||spec.tbl)::regclass AND conname=spec.cname;
    SELECT pg_get_constraintdef(oid) INTO existing FROM pg_constraint
      WHERE conrelid=format('public.%I',spec.tbl)::regclass AND conname=spec.cname;
    IF FOUND THEN
      IF replace(existing,' NOT VALID','') <> replace(wanted,' NOT VALID','') THEN
        RAISE EXCEPTION 'Existing constraint %.% has an incompatible definition; preserved without replacement',spec.tbl,spec.cname;
      END IF;
    ELSE
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I %s NOT VALID',spec.tbl,spec.cname,spec.definition);
    END IF;
  END LOOP;
END $constraints$;

-- Old rows stay unreviewed. New/changed medication doses must explicitly adopt V1.
CREATE OR REPLACE FUNCTION public.require_medication_dose_v1() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.dose_semantics_version=1 AND NEW.dose_semantics_version IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Cannot remove confirmed medication semantics'; END IF;
  IF TG_OP = 'INSERT' OR NEW.dose IS DISTINCT FROM OLD.dose OR NEW.dose_unit IS DISTINCT FROM OLD.dose_unit THEN
    IF NEW.dose_semantics_version IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Medication dose must be explicitly confirmed as Dosing Semantics V1'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER phases_require_dosing_v1 BEFORE INSERT OR UPDATE ON public.phases
FOR EACH ROW EXECUTE FUNCTION public.require_medication_dose_v1();

-- One authenticated transaction for protocol + compound + selected/new phase.
-- Unlisted compounds/phases are preserved. No name-based matching or deletion.
CREATE OR REPLACE FUNCTION public.save_protocol_dosing_v1(p_protocol_id uuid, p_name text, p_start_date date, p_compounds jsonb, p_continued_from_id uuid DEFAULT NULL, p_removed_compound_ids uuid[] DEFAULT '{}')
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
    ph := c->'phase'; dv := (ph->>'dose')::numeric; du := ph->>'dose_unit';
    IF dv IS NULL OR dv <= 0 OR dv >= 'Infinity'::numeric OR du IS NULL OR du NOT IN ('mg','mcg','IU') OR (ph->>'dose_semantics_version')::int IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'Invalid medication dose'; END IF;
    cv := (c->>'concentration_value')::numeric; cu := c->>'concentration_unit';
    vol := NULL;
    IF cv IS NOT NULL OR cu IS NOT NULL THEN
      IF cv IS NULL OR cv <= 0 OR cv >= 'Infinity'::numeric OR cu IS NULL OR cu NOT IN ('mg/mL','mcg/mL','IU/mL') THEN RAISE EXCEPTION 'Invalid concentration'; END IF;
      IF (du='IU') <> (cu='IU/mL') THEN RAISE EXCEPTION 'Cannot convert medication IU and mass'; END IF;
      vol := dv / cv;
      IF du='mg' AND cu='mcg/mL' THEN vol := vol*1000; END IF;
      IF du='mcg' AND cu='mg/mL' THEN vol := vol/1000; END IF;
    END IF;
    scale := (ph->>'syringe_scale')::numeric;
    IF scale IS NOT NULL AND (scale NOT IN (40,100) OR vol IS NULL) THEN RAISE EXCEPTION 'Select syringe scale and concentration'; END IF;
    sw := (ph->>'start_week')::int; ew := (ph->>'end_week')::int;
    IF sw IS NULL OR sw<1 OR (ew IS NOT NULL AND ew<sw) THEN RAISE EXCEPTION 'Invalid phase range'; END IF;
    IF ph->>'frequency' IS NULL OR ph->>'frequency' !~ '^(daily|[1-7]x/week|every[1-7]days)$' THEN RAISE EXCEPTION 'Invalid frequency'; END IF;
    IF jsonb_typeof(ph->'days_of_week')='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(ph->'days_of_week') WHERE value::int NOT BETWEEN 0 AND 6) THEN RAISE EXCEPTION 'Invalid schedule days'; END IF;
    cid := (c->>'id')::uuid;
    IF cid IS NULL THEN
      INSERT INTO compounds(user_id,protocol_id,name) VALUES(uid,pid,trim(c->>'name')) RETURNING id INTO cid;
    ELSE
      PERFORM 1 FROM compounds WHERE id=cid AND protocol_id=pid AND user_id=uid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Compound not found'; END IF;
    END IF;
    UPDATE compounds SET name=trim(c->>'name'), concentration_value=cv, concentration_unit=cu,
      vial_strength=(c->>'vial_strength')::numeric, vial_unit=c->>'vial_unit', bac_water_ml=(c->>'bac_water_ml')::numeric,
      reconstitution_date=(c->>'reconstitution_date')::date,
      notes=coalesce(c->>'notes',notes), vials_in_stock=coalesce((c->>'vials_in_stock')::int,vials_in_stock)
    WHERE id=cid AND user_id=uid;
    phid := (ph->>'id')::uuid;
    IF phid IS NOT NULL THEN
      PERFORM 1 FROM phases WHERE id=phid AND compound_id=cid AND user_id=uid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Phase not found'; END IF;
    END IF;
    IF EXISTS(SELECT 1 FROM phases WHERE compound_id=cid AND id IS DISTINCT FROM phid
      AND start_week <= coalesce(ew,2147483647) AND coalesce(end_week,2147483647)>=sw) THEN RAISE EXCEPTION 'Phase overlaps another saved phase'; END IF;
    IF phid IS NULL THEN
      INSERT INTO phases(user_id,compound_id,name,dose,dose_unit,dose_semantics_version,start_week,end_week,frequency)
      VALUES(uid,cid,coalesce(ph->>'name','Phase'),dv,du,1,sw,ew,ph->>'frequency') RETURNING id INTO phid;
    END IF;
    UPDATE phases SET dose=dv,dose_unit=du,dose_semantics_version=1,injection_volume_ml=vol,
      syringe_scale=scale,syringe_units=CASE WHEN scale IS NULL THEN NULL ELSE vol*scale END,
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
REVOKE ALL ON FUNCTION public.save_protocol_dosing_v1(uuid,text,date,jsonb,uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_protocol_dosing_v1(uuid,text,date,jsonb,uuid,uuid[]) TO authenticated;
COMMIT;
