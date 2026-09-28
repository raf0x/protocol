# Task packet: QA-003 — Readiness and privacy contract corrections

## Outcome and behavior

- **Business outcome:** Align focused readiness coverage and documentation with the approved retired-demo, privacy/navigation, print, and Capacitor contracts without expanding application behavior.
- **Current behavior:** Six focused assertions encode stale or brittle expectations: print selector order, a fictional `/demo` page, a privacy mailto in authenticated navigation, demo-fixture participation, Capacitor absence, and unnormalized privacy source text.
- **Desired behavior:** Tests exercise the redirect, semantic privacy disclosures, structured link/configuration contracts, and parsed print rules. Printed reports also hide an already-open More dialog.
- **Acceptance criteria:**
  - [x] `/demo` invokes a redirect to `/`, and public landing content neither links to nor advertises the retired demo.
  - [x] Privacy disclosures are checked by normalized section meaning for Labs/imports, AI/OpenAI, consent/revocation, generated report PDFs, conditional push, in-app deletion, scrubbed monitoring exclusions, and durable Supabase counters.
  - [x] Public and authenticated committed navigation expose accessible Privacy and Support destinations; the Privacy contact and Support form/direct contact remain discoverable without requiring a privacy mailto in navigation.
  - [x] Parsed print rules independently hide navigation, export controls, and an open More dialog while leaving report content printable.
  - [x] Structured Capacitor checks require the accepted packages, approved production HTTPS origin, and disabled cleartext while release documentation retains all manual gates.

## Scope and preservation

- **In scope:** Two focused test files, App Store readiness documentation, this task packet, and the single Doctor Report print stylesheet.
- **Out of scope:** Rebuilding a fictional demo; changing public/authenticated components; native project generation; mailbox verification; broad validation; Supabase operations.
- **Allowed files or surfaces:** `tests/app-store-readiness.test.mjs`, `tests/launch-blockers.test.mjs`, `docs/app-store-readiness.md`, `docs/tasks/QA-003-readiness-contracts.md`, and `app/health/report/report.module.css`.
- **Required preservation boundaries:** Preserve the uncommitted `components/app/BottomTabBar.tsx`, `docs/mac-handoff-checklist.md`, and `supabase/.temp/` work. Assertions must use Privacy/Support behavior already present in committed navigation and must not depend on the uncommitted Terms-link addition.

## Token/work budget

- **Budget:** Unspecified.
- **Checkpoint and limit behavior:** Stop before any additional application stylesheet or component change; report the scope need instead of expanding it.

## Validation requirements

| Check | Required? | Command/scenario, timing, and evidence |
| --- | --- | --- |
| Focused tests | Yes | `npm run validate:focused -- tests/app-store-readiness.test.mjs tests/launch-blockers.test.mjs`; all tests must pass with no skips. |
| Broad regression tests | No | Explicitly excluded from QA-003. |
| Browser tests | No | Explicitly excluded; physical-device/native checks remain manual gates. |
| TypeScript | No | Explicitly excluded from QA-003. |
| Production build | No | Explicitly excluded from QA-003. |
| Manual QA | Partially complete | Localhost print QA passed: the open More dialog, bottom navigation, and export controls were hidden; the report remained visible; and the normal screen remained unchanged. Privacy mailbox operation and native/App Store operational checks remain unverified. |

## Known baseline failures

The initial focused run at local `HEAD` `5ac026e` reported 89 tests: 83 passed, 6 failed, 0 skipped. The six failures were the stale contracts listed under Current behavior; no unrelated baseline failure was observed.

## Authorization boundaries

| Action | Authorization and scope |
| --- | --- |
| Staging | Not authorized. |
| Commit | Not authorized. |
| Push | Not authorized. |
| Deployment | Not authorized. |
| Supabase | Not authorized. |

## Stop conditions

**Blocked:** Stop before expanding to a second stylesheet or any component/application behavior change. Also stop if the protected BottomTabBar change alters the Privacy, Support, demo, or print contracts under test.

**Task-specific triggers:** A component change, additional stylesheet, production mutation, or assertion dependent on uncommitted navigation behavior requires owner direction.

## Expected final report

Report the BottomTabBar overlap assessment, six root causes and corrections, print selector, test-integrity rationale, changed files, focused totals, diff check, remaining manual/operational checks, and preservation confirmation.

## Future work

`/demo` redirecting to `/` is the accepted temporary retired-demo contract. A rebuilt fictional reviewer demo is intentionally deferred; QA-003 records that need without adding demo application code or treating the retired redirect as a fictional-data fixture.

## Validation results

- Focused tests after the test-integrity correction: 93 passed, 0 failed, 0 skipped. All original test names and the public-landing coverage were preserved; negative behavioral cases now reject a hidden report, false conditional privacy text, and disconnected authenticated-link data.
- Independent review passed with qualifications. All six readiness/privacy failures are repaired.
- Manual localhost print QA passed: the open More dialog, bottom navigation, and export controls were hidden; the report remained visible; and the normal screen remained unchanged.
- The expected unresolved baseline is now 10 failures, all in UI simplification. Full regression has not yet been rerun, so 10 is an expected remaining count rather than a verified complete-suite total, and `validate:release` remains red.
- Privacy mailbox operation and native/App Store operational checks remain unverified. Broad regression, TypeScript, build, browser, signed-device, TestFlight, and App Store checks were not run under the explicit QA-003 validation limit.
