# Durable decisions

These choices govern relevant work. Existing decisions may change only through an explicit new product decision from the owner; record what it supersedes and why. Historical implementation notes do not silently override this register.

| Area | Decision |
| --- | --- |
| Repository, deployment, and staging | Root [AGENTS.md](../../AGENTS.md) is authoritative for repository identity, explicit per-file staging, and the separate publication, deployment, and Supabase authorization boundaries. |
| Health data ownership | Authenticate and explicitly scope health/protocol reads and writes to the owner; retain RLS. Failed ownership reads are errors, never evidence of an empty account. Protocol ownership includes all retained lifecycle states. |
| Dosing safety | Preserve medication dose/unit, syringe markings/scale, and mL volume as distinct meanings. Do not infer missing medical values from compound identity. Preserve precision, schedule/lifecycle/date semantics, event generation, and inventory calculations through canonical helpers/save paths. Ambiguous save outcomes must not trigger an unproven-safe duplicate create. |
| Active protocol rings | All active protocols must remain visible. Rows use groups of three, with the final partial row centered. No `+N more` replacement is allowed. Preserve accessible protocol navigation; do not imply a target count or reward additional compounds. This owner-approved decision supersedes MPP-015's earlier capped-ring behavior so every active protocol remains directly accessible; retain MPP-015 as historical documentation. |
| Medical interpretation | Protocol-event proximity provides context only, never evidence of causation. Summaries must not invent diagnoses, treatment recommendations, or protocol/outcome causal claims. |
| Accessibility | Maintain readable dark-mode text contrast (at least 4.5:1 for normal text), visible keyboard focus, accessible names, keyboard-operable controls and chart inspection, touch/assistive alternatives, and reduced-motion behavior. |

## Approved Health Command Center contract (MPP-016)

- Health opens with the Command Center; Today retains daily actions, check-in, onboarding, and protocol navigation without the former charts/weekly recap block. Existing Health destinations remain available, including Labs at `/health?view=labs`.
- Preserve selected range across Health subviews. Default to 7D; 7D/30D/90D use inclusive local calendar dates, and All uses recorded history through today. Preserve owner-scoped paginated history and the shared pure calculation boundary.
- Metrics describe valid recorded observations. Missing values never become zero. Weight uses saved units and latest-minus-earliest valid recorded day, excludes conflicting same-day values, requires two days for change, and carries no good/bad meaning.
- Weight uses a linear unsmoothed line over recorded dates. Mood, Energy, and Sleep use independent none/single/sparse/trend states; retain the exact coverage thresholds and All-range weekly qualification policy in [MPP-016](../mpp-016-command-center.md#focus-and-sparse-signal-correction). These are display rules, not clinical thresholds.
- Keep section-local empty/partial states, generic failures with retry, and no fabricated observations. Command Briefing contains at most one measured change, one confidence item, and one aggregated protocol-activity item; no event-label overlays or latest-events feed.
- Preserve native and chart value inspection, reduced motion, and the compact Add / Import menu's destinations, dismissal, and focus behavior documented in [MPP-016](../mpp-016-command-center.md#real-data-visual-correction).
