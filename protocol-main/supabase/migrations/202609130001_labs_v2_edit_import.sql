-- Extends Labs V1 only. No backfill or protocol/dosing changes.
BEGIN;
ALTER TABLE public.lab_panels
  ADD COLUMN IF NOT EXISTS source_filename text,
  ADD COLUMN IF NOT EXISTS source_metadata jsonb;
ALTER TABLE public.lab_results
  ADD COLUMN IF NOT EXISTS source_row_index integer,
  ADD COLUMN IF NOT EXISTS source_raw jsonb,
  ADD COLUMN IF NOT EXISTS import_confidence text;
DO $$
DECLARE f record; actual text;
BEGIN
  FOR f IN SELECT * FROM (VALUES ('lab_panels','source_filename','text'),('lab_panels','source_metadata','jsonb'),
    ('lab_results','source_row_index','integer'),('lab_results','source_raw','jsonb'),('lab_results','import_confidence','text')) AS v(t,c,ty)
  LOOP
    SELECT format_type(atttypid,atttypmod) INTO actual FROM pg_attribute WHERE attrelid=format('public.%I',f.t)::regclass AND attname=f.c AND NOT attisdropped;
    IF actual IS DISTINCT FROM f.ty THEN RAISE EXCEPTION 'Incompatible existing %.% type: %. Inspect before proceeding.',f.t,f.c,actual; END IF;
  END LOOP;
END $$;
-- Replace only the known V1 manual-only check. Existing values remain valid.
ALTER TABLE public.lab_panels DROP CONSTRAINT IF EXISTS lab_panels_source_type_check;
ALTER TABLE public.lab_panels ADD CONSTRAINT lab_panels_source_type_check CHECK (source_type IN ('manual','csv','pdf'));
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.lab_panels'::regclass AND conname='labs_v2_panel_source_check') THEN
    ALTER TABLE public.lab_panels ADD CONSTRAINT labs_v2_panel_source_check CHECK (length(source_filename)<=255 AND (source_metadata IS NULL OR (jsonb_typeof(source_metadata)='object' AND octet_length(source_metadata::text)<=2000000)));
  END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.lab_results'::regclass AND conname='labs_v2_result_source_check') THEN
    ALTER TABLE public.lab_results ADD CONSTRAINT labs_v2_result_source_check CHECK ((source_row_index IS NULL OR source_row_index>=1) AND (import_confidence IS NULL OR import_confidence IN ('high','medium','low')) AND (source_raw IS NULL OR octet_length(source_raw::text)<=20000));
  END IF;
END $$;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['lab_panels','lab_results'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=tab AND policyname='labs_owner_update') THEN
      EXECUTE format('CREATE POLICY labs_owner_update ON public.%I FOR UPDATE TO authenticated USING (user_id=(SELECT auth.uid())) WITH CHECK (user_id=(SELECT auth.uid()))',tab);
    END IF;
    IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=tab AND policyname='labs_owner_delete') THEN
      EXECUTE format('CREATE POLICY labs_owner_delete ON public.%I FOR DELETE TO authenticated USING (user_id=(SELECT auth.uid()))',tab);
    END IF;
  END LOOP;
END $$;
GRANT UPDATE, DELETE ON public.lab_panels, public.lab_results TO authenticated;

CREATE OR REPLACE FUNCTION public.labs_v2_audit_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN RAISE EXCEPTION 'Lab identity and ownership cannot change'; END IF;
  NEW.created_at:=OLD.created_at; NEW.updated_at:=clock_timestamp();
  IF TG_TABLE_NAME='lab_results' THEN
    IF NEW.lab_panel_id IS DISTINCT FROM OLD.lab_panel_id THEN RAISE EXCEPTION 'Results cannot move between panels'; END IF;
    NEW.source_raw:=OLD.source_raw; NEW.source_row_index:=OLD.source_row_index; NEW.import_confidence:=OLD.import_confidence;
  ELSE
    NEW.source_type:=OLD.source_type; NEW.source_filename:=OLD.source_filename; NEW.source_metadata:=OLD.source_metadata;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER labs_zz_v2_audit BEFORE UPDATE ON public.lab_panels FOR EACH ROW EXECUTE FUNCTION public.labs_v2_audit_guard();
CREATE OR REPLACE TRIGGER labs_zz_v2_audit BEFORE UPDATE ON public.lab_results FOR EACH ROW EXECUTE FUNCTION public.labs_v2_audit_guard();
REVOKE ALL ON FUNCTION public.labs_v2_audit_guard() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.save_lab_panel_v2(p_panel_id uuid,p_expected_updated_at timestamptz,p_panel jsonb,p_results jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); pid uuid:=p_panel_id; stamp timestamptz; source text; item jsonb; rid uuid; keep_ids uuid[]:='{}';
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to save lab results'; END IF;
  IF jsonb_typeof(p_panel) IS DISTINCT FROM 'object' OR jsonb_typeof(p_results) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Panel and results required'; END IF;
  IF jsonb_array_length(p_results) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Enter 1 to 500 biomarkers'; END IF;
  IF (p_panel->>'test_date') IS NULL OR (p_panel->>'test_date') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Invalid test date'; END IF;
  IF pid IS NOT NULL THEN
    SELECT updated_at,source_type INTO stamp,source FROM public.lab_panels WHERE id=pid AND user_id=uid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Panel not available in your account'; END IF;
    IF stamp IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Panel changed since you opened it. Reload before editing.'; END IF;
    UPDATE public.lab_panels SET test_date=(p_panel->>'test_date')::date,panel_name=nullif(btrim(p_panel->>'panel_name'),''),provider=nullif(btrim(p_panel->>'provider'),''),notes=nullif(btrim(p_panel->>'notes'),'') WHERE id=pid AND user_id=uid;
  ELSE
    source:=coalesce(p_panel->>'source_type','manual');
    IF source<>'manual' AND p_panel->>'review_confirmed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Confirm imported results before saving'; END IF;
    INSERT INTO public.lab_panels(user_id,test_date,panel_name,provider,notes,source_type,source_filename,source_metadata)
    VALUES(uid,(p_panel->>'test_date')::date,nullif(btrim(p_panel->>'panel_name'),''),nullif(btrim(p_panel->>'provider'),''),nullif(btrim(p_panel->>'notes'),''),source,
      p_panel->>'source_filename',CASE WHEN source<>'manual' THEN coalesce(p_panel->'source_metadata','{}'::jsonb)||jsonb_build_object('reviewed_at',clock_timestamp()) ELSE NULL END) RETURNING id INTO pid;
  END IF;
  FOR item IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid result'; END IF;
    IF p_panel_id IS NULL AND source<>'manual' AND item->>'review_confirmed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Each imported row must be confirmed'; END IF;
    rid:=nullif(item->>'id','')::uuid;
    IF rid IS NOT NULL THEN
      IF rid=ANY(keep_ids) THEN RAISE EXCEPTION 'Repeated result identifier'; END IF;
      PERFORM 1 FROM public.lab_results WHERE id=rid AND lab_panel_id=pid AND user_id=uid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Result not available in this panel'; END IF;
      UPDATE public.lab_results SET biomarker_name=btrim(item->>'biomarker_name'),value=(item->>'value')::numeric,value_text=nullif(btrim(item->>'value_text'),''),unit=coalesce(btrim(item->>'unit'),''),
        reference_low=(item->>'reference_low')::numeric,reference_high=(item->>'reference_high')::numeric,reference_text=nullif(btrim(item->>'reference_text'),''),
        status=coalesce(item->>'status','unknown'),status_source=CASE WHEN item->>'status_source'='reported' THEN 'reported' ELSE 'unknown' END
      WHERE id=rid AND lab_panel_id=pid AND user_id=uid;
    ELSE
      INSERT INTO public.lab_results(lab_panel_id,user_id,biomarker_name,value,value_text,unit,reference_low,reference_high,reference_text,status,status_source,source_row_index,source_raw,import_confidence)
      VALUES(pid,uid,btrim(item->>'biomarker_name'),(item->>'value')::numeric,nullif(btrim(item->>'value_text'),''),coalesce(btrim(item->>'unit'),''),
        (item->>'reference_low')::numeric,(item->>'reference_high')::numeric,nullif(btrim(item->>'reference_text'),''),coalesce(item->>'status','unknown'),CASE WHEN item->>'status_source'='reported' THEN 'reported' ELSE 'unknown' END,
        (item->>'source_row_index')::integer,item->'source_raw',item->>'import_confidence') RETURNING id INTO rid;
    END IF;
    keep_ids:=array_append(keep_ids,rid);
  END LOOP;
  DELETE FROM public.lab_results WHERE lab_panel_id=pid AND user_id=uid AND NOT(id=ANY(keep_ids));
  RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.delete_lab_panel_v2(p_panel_id uuid,p_expected_updated_at timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE stamp timestamptz; BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to delete a panel'; END IF;
  SELECT updated_at INTO stamp FROM public.lab_panels WHERE id=p_panel_id AND user_id=auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Panel not available in your account'; END IF;
  IF stamp IS DISTINCT FROM p_expected_updated_at THEN RAISE EXCEPTION 'Panel changed. Reload before deleting.'; END IF;
  DELETE FROM public.lab_panels WHERE id=p_panel_id AND user_id=auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.save_lab_panel_v2(uuid,timestamptz,jsonb,jsonb),public.delete_lab_panel_v2(uuid,timestamptz) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_lab_panel_v2(uuid,timestamptz,jsonb,jsonb),public.delete_lab_panel_v2(uuid,timestamptz) TO authenticated;
COMMIT;
