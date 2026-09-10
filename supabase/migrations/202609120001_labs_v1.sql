-- Labs V1. Additive only; does not touch protocol, dosing or journal tables.
BEGIN;

CREATE TABLE IF NOT EXISTS public.lab_panels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_date date NOT NULL,
  panel_name text,
  provider text,
  notes text,
  source_type text NOT NULL DEFAULT 'manual' CHECK (source_type = 'manual'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id),
  CHECK (length(panel_name) <= 200 AND length(provider) <= 200 AND length(notes) <= 10000)
);

CREATE TABLE IF NOT EXISTS public.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lab_panel_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  biomarker_name text NOT NULL CHECK (length(btrim(biomarker_name)) BETWEEN 1 AND 200),
  canonical_name text,
  value numeric,
  value_text text,
  unit text NOT NULL DEFAULT '' CHECK (length(unit) <= 80),
  reference_low numeric,
  reference_high numeric,
  reference_text text CHECK (length(reference_text) <= 1000),
  status text NOT NULL DEFAULT 'unknown' CHECK (status IN ('low','normal','high','abnormal','unknown')),
  status_source text NOT NULL DEFAULT 'unknown' CHECK (status_source IN ('reported','derived','unknown')),
  category text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (lab_panel_id, user_id) REFERENCES public.lab_panels(id, user_id) ON DELETE CASCADE,
  CHECK ((value IS NOT NULL AND value_text IS NULL) OR (value IS NULL AND value_text IS NOT NULL AND length(btrim(value_text)) BETWEEN 1 AND 200)),
  CHECK (value IS NULL OR value NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  CHECK (reference_low IS NULL OR reference_low NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  CHECK (reference_high IS NULL OR reference_high NOT IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric)),
  CHECK (reference_low IS NULL OR reference_high IS NULL OR reference_low <= reference_high),
  CHECK (length(canonical_name) <= 200 AND length(category) <= 200)
);

-- A pre-existing incompatible column causes a rollback, never an ALTER TYPE.
DO $$
DECLARE expected record; actual text;
BEGIN
  FOR expected IN SELECT * FROM (VALUES
    ('lab_panels','id','uuid'), ('lab_panels','user_id','uuid'), ('lab_panels','test_date','date'),
    ('lab_panels','panel_name','text'), ('lab_panels','provider','text'), ('lab_panels','notes','text'),
    ('lab_panels','source_type','text'), ('lab_panels','created_at','timestamp with time zone'), ('lab_panels','updated_at','timestamp with time zone'),
    ('lab_results','id','uuid'), ('lab_results','lab_panel_id','uuid'), ('lab_results','user_id','uuid'),
    ('lab_results','biomarker_name','text'), ('lab_results','canonical_name','text'), ('lab_results','value','numeric'),
    ('lab_results','value_text','text'), ('lab_results','unit','text'), ('lab_results','reference_low','numeric'),
    ('lab_results','reference_high','numeric'), ('lab_results','reference_text','text'), ('lab_results','status','text'),
    ('lab_results','status_source','text'), ('lab_results','category','text'),
    ('lab_results','created_at','timestamp with time zone'), ('lab_results','updated_at','timestamp with time zone')
  ) AS fields(table_name,column_name,type_name)
  LOOP
    SELECT format_type(a.atttypid,a.atttypmod) INTO actual FROM pg_attribute a
      WHERE a.attrelid = format('public.%I',expected.table_name)::regclass AND a.attname=expected.column_name AND NOT a.attisdropped;
    IF actual IS DISTINCT FROM expected.type_name THEN
      RAISE EXCEPTION 'Incompatible existing %.%: expected %, got %. Inspect schema before proceeding.',expected.table_name,expected.column_name,expected.type_name,actual;
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS lab_panels_user_date_idx ON public.lab_panels(user_id,test_date DESC,id);
CREATE INDEX IF NOT EXISTS lab_results_user_panel_idx ON public.lab_results(user_id,lab_panel_id,id);

ALTER TABLE public.lab_panels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
DO $$
DECLARE tab text;
BEGIN
  FOREACH tab IN ARRAY ARRAY['lab_panels','lab_results'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=tab AND policyname='labs_owner_select') THEN
      EXECUTE format('CREATE POLICY labs_owner_select ON public.%I FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()))',tab);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=tab AND policyname='labs_owner_insert') THEN
      EXECUTE format('CREATE POLICY labs_owner_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()))',tab);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON public.lab_panels, public.lab_results FROM anon, authenticated;
GRANT SELECT, INSERT ON public.lab_panels, public.lab_results TO authenticated;

CREATE OR REPLACE FUNCTION public.labs_v1_result_status()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  -- A lab-reported interpretation is preserved, including explicit Unknown.
  IF NEW.status_source <> 'reported' THEN
    NEW.status := 'unknown'; NEW.status_source := 'unknown';
    IF NEW.value IS NOT NULL AND (NEW.reference_low IS NOT NULL OR NEW.reference_high IS NOT NULL) THEN
      NEW.status_source := 'derived';
      NEW.status := CASE WHEN NEW.value < NEW.reference_low THEN 'low'
        WHEN NEW.value > NEW.reference_high THEN 'high' ELSE 'normal' END;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER labs_v1_result_status_trigger BEFORE INSERT OR UPDATE ON public.lab_results
FOR EACH ROW EXECUTE FUNCTION public.labs_v1_result_status();

CREATE OR REPLACE FUNCTION public.save_lab_panel_v1(p_panel jsonb, p_results jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE uid uuid := auth.uid(); panel_id uuid; item jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to save lab results'; END IF;
  IF jsonb_typeof(p_panel) IS DISTINCT FROM 'object' OR jsonb_typeof(p_results) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Panel and results are required';
  END IF;
  IF jsonb_array_length(p_results) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Enter between 1 and 500 biomarkers'; END IF;
  IF (p_panel->>'test_date') IS NULL OR (p_panel->>'test_date') !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Enter a valid test date'; END IF;
  INSERT INTO public.lab_panels(user_id,test_date,panel_name,provider,notes)
  VALUES(uid,(p_panel->>'test_date')::date,nullif(btrim(p_panel->>'panel_name'),''),nullif(btrim(p_panel->>'provider'),''),nullif(btrim(p_panel->>'notes'),'')) RETURNING id INTO panel_id;
  FOR item IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid biomarker row'; END IF;
    INSERT INTO public.lab_results(lab_panel_id,user_id,biomarker_name,value,value_text,unit,reference_low,reference_high,reference_text,status,status_source)
    VALUES(panel_id,uid,btrim(item->>'biomarker_name'),(item->>'value')::numeric,nullif(btrim(item->>'value_text'),''),coalesce(btrim(item->>'unit'),''),
      (item->>'reference_low')::numeric,(item->>'reference_high')::numeric,nullif(btrim(item->>'reference_text'),''),
      coalesce(item->>'status','unknown'),CASE WHEN item->>'status_source'='reported' THEN 'reported' ELSE 'unknown' END);
  END LOOP;
  RETURN panel_id;
END $$;
REVOKE ALL ON FUNCTION public.save_lab_panel_v1(jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_lab_panel_v1(jsonb,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.labs_v1_result_status() FROM PUBLIC, anon;

COMMENT ON COLUMN public.lab_results.status IS 'Lab-reported status or inclusive numeric-bound comparison, never a diagnosis.';
COMMENT ON COLUMN public.lab_results.value_text IS 'Verbatim qualitative or comparator result, e.g. Not detected or <5. Never coerced into a numeric trend.';
COMMENT ON COLUMN public.lab_results.canonical_name IS 'Reserved for explicit future mapping. V1 compares exact trimmed names without synonym inference.';
COMMIT;
