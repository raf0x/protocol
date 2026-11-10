# MyPepProtocol repository audit — 2026-11-09

**Scope and limitations.** Reviewed the full tracked-file inventory (1,053 files), production/release identity, repository instructions, open PRs, and selected source/contracts across auth, APIs, protocols, health, inventory, PWA, iOS, testing, and documentation. This is **not** a line-by-line audit of all source files or a penetration test. No user data, production database, or secrets were accessed. Source inspection is not proof of deployment behavior.

## Implemented on isolated draft branches (not merged)

| Item | Action | Status |
|---|---|---|
| Privileged cron authentication fails open if `CRON_SECRET` is absent | Draft PR #14 adds a shared nonempty-secret guard for GET `/api/cron` and GET `/api/push`, plus focused tests | Needs test execution / security review |
| README inaccurately describes framework, dependencies, structure, screenshots, and MIT license | This documentation branch corrects verified discrepancies | Draft / docs only |
| PROJECT_STATE snapshot still describes September production | This documentation branch updates verified November production and unresolved evidence | Draft / docs only |

## Remaining findings for owner review

| Priority | Area and evidence | Finding / impact | Proposed decision |
|---|---|---|---|
| P0 investigate | `app/tracker/page.tsx`, `lib/constants.ts` | A legacy tracker embeds detailed treatment-like timelines in client source. Repository is public; browser-side gating cannot make bundled source private. Whether data is real or synthetic has not been established. | Classify privacy exposure, then retire, redact, or migrate with explicit owner approval. Do not paste its contents into an issue or report. |
| P1 | `app/api/support/route.ts` | Public support POST sends two SendGrid messages with validation and honeypot but no shared throttling. Abuse/deliverability costs possible. | Add bounded durable anti-abuse controls, with fail behavior defined. |
| P1 | `app/api/create-protocol/route.ts`, `lib/rateLimit.ts` | Protocol-create API relies on per-process IP Map limiter, explicitly non-durable. Client user is authenticated, but the rate cap is not global. | Evaluate an owner-scoped durable limiter and duplicate-write protection. |
| P1 | `supabase/migrations/` | 18 migrations depend on initial pre-existing tables; no verified schema-only bootstrap/config for isolated QA. | Obtain safe schema-only baseline, review RLS and grants, then create reproducible nonproduction QA. |
| P1 | `tests/user-profile-ownership.test.mjs`, release evidence | Three inherited regression failures; query-count fixture stops before downstream owner/RLS assertions. Live cross-account isolation not confirmed. | Reconcile test contracts without erasing RLS assertions; perform owner-isolation verification separately. |
| P1 | `app/protocol/page.tsx` | Journal reads use `select('*')` ordered by date with no range bound; additional history reads can grow with use. Ownership depends in part on RLS rather than explicit client filters. | Profile query volume and add bounded, owner-scoped reads where semantics permit. |
| P1 | `app/api/cron/route.ts`, `app/api/push/route.ts` | Reminder selection compares a server-side current hour with stored `reminder_hour`, with no subscriber timezone conversion visible in these paths. | Review intended timezone contract before changing notification timing. |
| P2 | `proxy.ts`, `app/robots.ts`, `app/sitemap.ts` | `/robots.txt` and `/sitemap.xml` are not on the explicit public-page allowlist; prior QA observed login redirects. | Add narrow public-route exceptions with auth regression tests and live HTTP verification. |
| P2 | `lib/health/vialSafety.ts`, existing product behavior | Individual physical-vial balances are not tracked; unknown remaining is deliberate, not a corrupted value. | Keep honest unknown states; build vial-instance/withdrawal tracking only as a separately approved project. |
| P2 | `app/share/[token]/page.tsx` | Public shared-protocol view fetches broad related rows; privacy relies on shared-token design and live RLS definitions. | Review share-token revocation/expiry and anon grants before changing public sharing. |
| P2 | Repository controls | No tracked `.github/workflows` CI pipeline found. Merge gates presently depend on preview builds and manually run suites. | Add a focused, affordable CI check for types and security-critical tests before large feature releases. |
| P3 | Repository root | 366 tracked root-level JavaScript files, mostly one-off `fix-*`, `find-*`, and `check-*` scripts, plus `vercel-log.txt`. | Inventory references and owners; archive/delete only after confirming none are required. Do not execute wholesale. |
| P3 | `app/game/page.tsx`, `app/demo/page.tsx`, `app/tracker/page.tsx` | Legacy/redirecting destinations exist. Usage and user expectations are unverified. | Review route analytics and deprecate individually; do not remove blindly. |
| P3 | Draft PR #13 | Today spacing changes are an open, unapproved design experiment. | Compare iPhone results and merge or close separately; do not bundle into maintenance patches. |

## Explicit non-actions

No production changes, Supabase writes/migrations, feature removals, license grants, changes to dose calculation, or tracker-data deletion were performed. Any code change that could alter authentication, medical facts, or user records needs independent review and release authorization.
