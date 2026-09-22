# MPP-013 V1: personal history and meaningful lab ranking

This is derived state over `labEvidence.ts`, `labFindings.ts`, and the existing
current-panel finding selector. There is no new persistence, normalization
registry, comparison engine, clinical threshold, or treatment attribution.

## Evidence and history rules

- Canonical biomarker identity and exact trimmed units remain authoritative.
  No conversions are inferred. Mixed units are disclosed even when an eligible
  same-unit subgroup is available.
- Every date with multiple readings, including equal values, remains ambiguous.
  None is chosen or averaged. Latest recorded-pair eligibility is authoritative;
  an older eligible pair cannot stand in for an unusable latest result.
- Explicit `assay`, `method`, and `specimen` strings in existing result
  `source_raw` metadata are compared conservatively. A known mismatch blocks the
  pair and whole-series history. These fields are not inferred from names,
  providers, filenames, or free text. Most records have no such metadata, so
  assay equivalence remains unverified and is disclosed in details and AI facts.
- One eligible date: insufficient history. Two: direct comparison only. Three:
  recorded history, sufficient for extremes and two-step movement, but not a
  baseline of earlier readings.
- A descriptive baseline needs at least **three earlier eligible dates**, excludes
  the current result, and reports median, minimum, maximum, count, and first/last
  source dates. For even counts, median is the midpoint of the two middle values.
  Excluded dates remain explicit limitations; the baseline covers loaded eligible
  history only, not a biological or clinical normal interval.
- New recorded high/low requires at least two earlier eligible dates and strict
  departure above/below their observed extent. No magnitude cutoff is invented.
- Repeated movement means two consecutive strictly increasing or decreasing
  steps across the last three recorded dates. Reversal means those steps have
  opposite signs. Neither pattern bridges an excluded date.
- V1 stability is deliberately strict: an exact repeat of the previous value,
  at least three earlier eligible dates, and no excluded dates. There is no
  tolerance defining a clinically meaningful or insignificant change.
- Known supplied range/status transitions retain the canonical matching-range
  rule. Missing or changed ranges never produce an invented transition.

## Ranking and presentation

The inspectable ascending tuple is `[category, negative YYYYMMDD, name, unit, id]`.
Unknown dates sort after dated findings. String tie-breaks use code-unit order.
Category order is newly outside supplied range, returned to supplied range,
persistent abnormality, personal high/low, repeated movement/reversal, stable
history, direct pair movement, then membership/insufficient/incompatible facts.
It is presentation priority, not medical urgency or a risk score.

One trajectory finding is chosen per biomarker/unit using that precedence.
Additional personal-history facts remain in its evidence even when a range
finding leads. Existing panel-membership precedence and latest-panel ambiguity
rules remain intact. Unchanged pairs without established history and unsupported
comparisons are omitted from headlines. Existing newly measured membership
cards are collapsed; missing-panel findings remain coverage details in Briefing.

Briefing shows up to four meaningful findings; Report up to five. Consumer cards
lead with the name, up to three exact values and dates, and a concise change such
as "Up 68 (+6.7%) since June 29." Native consumer disclosures switch between
"View details" and "Hide details" using the browser's open state. Their first
layer contains only the previous/current comparison, valid supplied range, and
one brief uncertainty message. Technical evidence is not rendered in consumer
cards; the Report retains the existing full evidence component and shared data.

One-reading results do not fill consumer slots unless they have a valid numeric
outside-range result or a low-confidence verification issue. Canonical findings
and report/audit evidence are retained. Consumer range presentation requires two
finite, distinct, ordered bounds with no contradictory reported flag; missing,
partial, malformed, reversed, or identical bounds are omitted, not repaired.
Original source records are not modified.

`import_confidence` describes original extraction quality. Import save requires
confirmation and may retain a review record, but the existing audit guard keeps
source metadata and confidence immutable on edits; there is no durable
post-import verification state that clears low confidence. Low confidence is
therefore retained as a shared limitation, qualifies finding reasons and labels,
and displays "Imported result needs verification" in consumer cards. Arithmetic
and ranking remain deterministic; uncertain imported records are not discarded.
Clinician and Analyst consumers receive the same qualification and source facts.

Analyst receives the same deterministic personal-history facts and the
identity-free ranking prefix. Every contributing date must fit in its existing
atomic evidence budget; otherwise the entire finding is omitted and counted in
the existing scope disclosure. Report uses the same findings and components;
optional Report AI receives only projected deterministic prose. No raw import
content, owner IDs, filenames, or canonical source IDs are added to AI requests.

## QA scope

Automated coverage includes history counts, median/extent, transitions, extremes,
movement/reversal/stability, missing ranges, unit/assay mismatches, duplicate
dates, stable ordering, capped presentation, exact values/provenance, disclosures,
and cross-consumer parity. Device-level keyboard/touch and print/PDF review remain
manual QA; no production account or Supabase data is needed for the unit fixtures.
