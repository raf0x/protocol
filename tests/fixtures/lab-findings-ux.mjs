export function testosteroneImportHistory() {
  return [['2025-11-20', 432], ['2026-04-10', 59], ['2026-06-29', 1009], ['2026-09-08', 1077]].map(([date, value], i) => ({
    id: `fixture-panel-${i}`, user_id: 'fixture-owner', test_date: date, panel_name: 'Test panel', provider: 'Test lab', notes: null,
    source_type: i === 3 ? 'pdf' : 'manual', source_filename: i === 3 ? 'fixture.pdf' : null,
    source_metadata: i === 3 ? { parser: 'fixture', reviewed_at: '2026-09-09T12:00:00Z' } : null,
    created_at: date, updated_at: date,
    results: [{ id: `fixture-result-${i}`, lab_panel_id: `fixture-panel-${i}`, user_id: 'fixture-owner',
      biomarker_name: 'TESTOSTERONE, TOTAL, MS', canonical_name: null, value, value_text: null, unit: 'ng/dL',
      reference_low: i ? 250 : null, reference_high: i ? 1100 : null, reference_text: null,
      status: i === 0 ? 'unknown' : i === 1 ? 'low' : 'normal', status_source: i ? 'reported' : 'unknown', category: null,
      source_row_index: i === 3 ? 28 : null, import_confidence: i === 3 ? 'low' : null,
      source_raw: i === 3 ? { extraction: { fields: { entry: '1077' }, review_required: true }, review: { confirmed: true, corrected_fields: [] } } : null,
    }],
  }))
}
