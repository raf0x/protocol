-- MPP-006. Independent owned inventory; no protocol linkage or stock backfill.
BEGIN;
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_name text NOT NULL CHECK (length(btrim(item_name)) BETWEEN 1 AND 200),
  form text NOT NULL CHECK (form IN ('lyophilized vial','pre-mixed vial','cartridge','other')),
  vial_strength numeric CHECK (vial_strength > 0 AND vial_strength <= 1000000),
  strength_unit text CHECK (strength_unit IN ('mg','mcg','IU')),
  quantity integer NOT NULL CHECK (quantity BETWEEN 1 AND 1000000),
  acquisition_date date CHECK (acquisition_date BETWEEN DATE '1900-01-01' AND DATE '9999-12-31'),
  expiration_date date CHECK (expiration_date BETWEEN DATE '1900-01-01' AND DATE '9999-12-31'),
  lot_number text CHECK (length(lot_number) <= 100),
  reconstitution_status text NOT NULL CHECK (reconstitution_status IN ('not reconstituted','reconstituted','not applicable','unknown')),
  reconstitution_date date CHECK (reconstitution_date BETWEEN DATE '1900-01-01' AND DATE '9999-12-31'),
  notes text CHECK (length(notes) <= 2000),
  identity_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((vial_strength IS NULL) = (strength_unit IS NULL)),
  CHECK (expiration_date IS NULL OR acquisition_date IS NULL OR expiration_date >= acquisition_date),
  CHECK ((reconstitution_status = 'reconstituted') = (reconstitution_date IS NOT NULL)),
  CHECK (reconstitution_date IS NULL OR acquisition_date IS NULL OR reconstitution_date >= acquisition_date),
  UNIQUE(user_id,identity_key)
);
CREATE TABLE IF NOT EXISTS public.inventory_imports (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  payload_hash text NOT NULL,
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,request_id)
);
CREATE INDEX IF NOT EXISTS inventory_items_owner_created ON public.inventory_items(user_id,created_at DESC,id);

-- Fail on incompatible pre-existing tables, rather than converting their data.
DO $$ DECLARE spec record; actual text; BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('inventory_items','id','uuid'),('inventory_items','user_id','uuid'),('inventory_items','item_name','text'),
    ('inventory_items','form','text'),('inventory_items','vial_strength','numeric'),('inventory_items','strength_unit','text'),
    ('inventory_items','quantity','integer'),('inventory_items','acquisition_date','date'),('inventory_items','expiration_date','date'),
    ('inventory_items','lot_number','text'),('inventory_items','reconstitution_status','text'),('inventory_items','reconstitution_date','date'),
    ('inventory_items','notes','text'),('inventory_items','identity_key','text'),('inventory_items','created_at','timestamp with time zone'),
    ('inventory_items','updated_at','timestamp with time zone'),('inventory_imports','user_id','uuid'),('inventory_imports','request_id','uuid'),
    ('inventory_imports','payload_hash','text'),('inventory_imports','result','jsonb'),('inventory_imports','created_at','timestamp with time zone')
  ) AS fields(tbl,col,typ) LOOP
    SELECT format_type(atttypid,atttypmod) INTO actual FROM pg_attribute
      WHERE attrelid=format('public.%I',spec.tbl)::regclass AND attname=spec.col AND NOT attisdropped;
    IF actual IS DISTINCT FROM spec.typ THEN RAISE EXCEPTION 'Incompatible %.%; inspect deployed inventory schema',spec.tbl,spec.col; END IF;
  END LOOP;
END $$;

ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_imports ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE tab text; BEGIN
  FOREACH tab IN ARRAY ARRAY['inventory_items','inventory_imports'] LOOP
    IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename=tab AND policyname='inventory_owner') THEN
      EXECUTE format('CREATE POLICY inventory_owner ON public.%I TO authenticated USING(user_id=(SELECT auth.uid())) WITH CHECK(user_id=(SELECT auth.uid()))',tab);
    END IF;
  END LOOP;
END $$;
REVOKE ALL ON public.inventory_items,public.inventory_imports FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.inventory_items TO authenticated;
-- Writes go through the bounded, authenticated confirmation RPC below.

CREATE OR REPLACE FUNCTION public.inventory_identity_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
  NEW.item_name:=btrim(NEW.item_name);
  NEW.vial_strength:=trim_scale(NEW.vial_strength);
  NEW.lot_number:=nullif(btrim(NEW.lot_number),''); NEW.notes:=nullif(btrim(NEW.notes),'');
  -- Trim only. Case-sensitive identifiers and actual units are preserved.
  NEW.identity_key:=md5(jsonb_build_array(NEW.item_name,NEW.form,NEW.vial_strength,NEW.strength_unit,NEW.quantity,
    to_char(NEW.acquisition_date,'YYYY-MM-DD'),to_char(NEW.expiration_date,'YYYY-MM-DD'),NEW.lot_number,
    NEW.reconstitution_status,to_char(NEW.reconstitution_date,'YYYY-MM-DD'),NEW.notes)::text);
  NEW.updated_at:=now(); RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER inventory_identity BEFORE INSERT ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.inventory_identity_v1();

CREATE OR REPLACE FUNCTION public.import_inventory_v1(p_request_id uuid,p_rows jsonb,p_confirmed boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE uid uuid:=auth.uid(); prior public.inventory_imports%rowtype; item jsonb; field text;
  inserted_id uuid; inserted_count integer:=0; duplicate_count integer:=0; answer jsonb; ordinal integer:=0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to import inventory'; END IF;
  IF p_confirmed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Review and confirm the import first'; END IF;
  IF p_request_id IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid import request'; END IF;
  IF jsonb_array_length(p_rows) NOT BETWEEN 1 AND 500 OR octet_length(p_rows::text)>2000000 THEN RAISE EXCEPTION 'Import between 1 and 500 rows, up to 2 MB'; END IF;
  INSERT INTO public.inventory_imports(user_id,request_id,payload_hash) VALUES(uid,p_request_id,md5(p_rows::text)) ON CONFLICT DO NOTHING;
  SELECT * INTO prior FROM public.inventory_imports WHERE user_id=uid AND request_id=p_request_id FOR UPDATE;
  IF prior.payload_hash<>md5(p_rows::text) THEN RAISE EXCEPTION 'This import ID was already used for different rows'; END IF;
  IF prior.result IS NOT NULL THEN RETURN prior.result; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
    ordinal:=ordinal+1;
    IF jsonb_typeof(item) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Import row % must be an object',ordinal; END IF;
    -- Prevent ownership/protocol fields or unreviewed workbook metadata being accepted.
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('item_name','form','vial_strength','strength_unit','quantity','acquisition_date','expiration_date','lot_number','reconstitution_status','reconstitution_date','notes')) THEN RAISE EXCEPTION 'Unexpected field in import row %',ordinal; END IF;
    FOREACH field IN ARRAY ARRAY['acquisition_date','expiration_date','reconstitution_date'] LOOP
      IF item->>field IS NOT NULL AND item->>field !~ '^\d{4}-\d{2}-\d{2}$' THEN RAISE EXCEPTION 'Invalid % in import row %',field,ordinal; END IF;
    END LOOP;
    IF coalesce(item->>'quantity','') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Invalid quantity in import row %',ordinal; END IF;
    inserted_id:=NULL;
    INSERT INTO public.inventory_items(user_id,item_name,form,vial_strength,strength_unit,quantity,acquisition_date,expiration_date,lot_number,reconstitution_status,reconstitution_date,notes)
    VALUES(uid,item->>'item_name',item->>'form',(item->>'vial_strength')::numeric,item->>'strength_unit',(item->>'quantity')::integer,
      (item->>'acquisition_date')::date,(item->>'expiration_date')::date,item->>'lot_number',item->>'reconstitution_status',(item->>'reconstitution_date')::date,item->>'notes')
    ON CONFLICT(user_id,identity_key) DO NOTHING RETURNING id INTO inserted_id;
    IF inserted_id IS NULL THEN duplicate_count:=duplicate_count+1; ELSE inserted_count:=inserted_count+1; END IF;
  END LOOP;
  answer:=jsonb_build_object('inserted',inserted_count,'duplicates',duplicate_count);
  UPDATE public.inventory_imports SET result=answer WHERE user_id=uid AND request_id=p_request_id;
  RETURN answer;
END $$;
REVOKE ALL ON FUNCTION public.import_inventory_v1(uuid,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_inventory_v1(uuid,jsonb,boolean) TO authenticated;
REVOKE ALL ON FUNCTION public.inventory_identity_v1() FROM PUBLIC,anon;
COMMIT;
