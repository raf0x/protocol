-- An ongoing phase intentionally has no end week.
ALTER TABLE public.phases
ALTER COLUMN end_week DROP NOT NULL;
