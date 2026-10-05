# Today - desktop alignment refinements

Owner acceptance, Oct 5, 2026: the 390px layout is accepted. At 1440px, center the weight-change and latest-date pills side by side between the weight and Health metrics; center the next-dose text and swipe navigation; move New Vial closer below the bottle and match its visible width with a larger button.

Low-risk, isolated styling. Scope: Today CSS and this record. All component markup, data, calculations, swipe/logging/inventory behavior and accepted mobile rules remain unchanged. Independent review is optional for this styling-only follow-up and is not claimed. No stage, commit, push, deployment or Supabase authorization.

Implementation: desktop Health grid uses equal outer columns with two centered metadata columns; a single latest-date pill also centers when change is unavailable. Focus uses equal outer columns around centered dose copy, then a centered navigation row above the progress track. The wide snapshot positions the existing New Vial trigger 8px below the visible SVG bottle body, at its 90px body width and 40px height; shared image dimensions and reserved space keep the trigger inside the snapshot. These rules apply only at the existing desktop viewport / wide-hero breakpoints.

Validation retains the inherited narrow Today gate: affected focused suites, standalone TypeScript, CSS parsing/scope and preservation/diff checks. Browser execution, production build and broad regression are excluded. Exact 1440px visual fit remains owner QA; no rendered browser pass is claimed.

Validation results:

- `npm run validate:focused -- tests/today-v2.test.mjs tests/today-dose-order.test.mjs tests/protocol-numeric-display.test.mjs`: **51 passed, 0 failed, 0 skipped**. Existing presentation, dose navigation, logging callbacks, values, dates and snapshot-action tests are unchanged. No baseline failures.
- `npm run validate:types`: **PASS**.
- PostCSS parsing and Next's CSS Modules local/pure selector compilation: **PASS**. All CSS outside the existing `(min-width: 760px)` viewport and `(min-width: 660px)` hero container queries is byte-identical to intake. Empty Focus support retains its existing hidden state.
- **76 of 77** intake dirty/untracked files remain byte-identical; only Today CSS changed, plus this new record. Component source and existing tests/fixture are untouched. Scoped diff/whitespace checks pass; index remains empty.
- Browser, build and broad regression were not executed under the inherited gate. The desktop geometry is implemented but not visually verified in a rendered browser. No release action or backend operation performed.
