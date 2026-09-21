-- Restore prospective preparation snapshots only; no history backfill.
-- CREATE OR REPLACE preserves the existing function owner and execution grants.
BEGIN;

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

COMMIT;
