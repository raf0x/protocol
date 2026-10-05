# MPP-017/018/019 final release corrections

Bounded implementation against Rafael's October 5 correction packet and independent QA findings. Preserve the accepted Today and dosing design, all unrelated dirty/untracked work, BottomTabBar, the Mac handoff checklist, Supabase temporary files, and the two established baseline-failure suites.

## Acceptance and scope

- F1: constrain the non-modal daily check-in to the available viewport above navigation; keep its header/close outside the internally scrolling content. Verify all fields, multiple errors, Update/Done and Escape at 390×480, plus the normal 390×844 layout.
- F2: convert the current weight draft when its display unit changes, including open and reopened check-ins. Keep pounds as canonical storage, preserve blank/invalid drafts, and verify round trips without double conversion.
- F3: retain New Vial confirmation and input values on returned/thrown save errors; show an error, release saving, leave count/events unchanged and allow retry. Preserve successful payload and event behavior.
- F4: format date-only CSV dates as local calendar dates, including phase offsets and month/year boundaries. Preserve timestamp and injection-count semantics; change no shared date helper.
- Reconcile only the stale partial-medication save and integrated Inventory-navigation assertions. Keep invalid raw/structural input blocked.

Implementation surfaces: Today page/CSS, VialInventory, the two inventory test suites, focused correction tests and the mocked Today browser fixture. No schema, migration, data, auth or deployment changes. No staging, commit or push.

Risk: user-facing data conversion and save error handling. The supplied independent QA packet fixes the existing architecture/acceptance criteria: pounds remain canonical, existing persistence payloads are retained, and the change adds no storage path. Rollback consists only of these task's added hunks; never restore whole files containing earlier local work.

## Validation gate

Required: affected focused tests, mocked browser short-screen/weight flows, `npm run validate:types`, `git diff --check`, and intake hash comparison for preservation. Browser checks use only synthetic transport and no real Supabase writes. Full regression and build are explicitly excluded from this correction gate by Rafael. Physical devices, live persistence, and independent post-correction review remain outside this implementation evidence.

Intake/evidence directory: `C:\Users\three\AppData\Local\Temp\mpp-release-corrections-20261005-085125`. HEAD at intake: `098651010a0882c6182aa6c4c67147d367a16f7f`. The manifest records every dirty/untracked file plus both protected baseline suites before edits.

## Results

- Focused gate: 65 passed, 0 failed, 0 skipped across `today-release-corrections`, `today-checkin-prompt`, `today-v2`, `inventory-protocol` and `inventory` test suites. Correction-specific coverage includes 3 weight tests, 4 timezone/export tests and 4 vial save tests.
- Mocked browser gate: 282 assertions passed, 0 runtime errors. Includes all previous 248 assertions plus 34 correction assertions. At 390×480, four errors cannot clip the fixed header/close; every field/error and Update/Done is reachable by internal scrolling above navigation. Close, Done and Escape dismiss, with focus restored after Escape. At 390×844 normal content fits without internal scrolling. Open, dismissed/reopened, edited-draft and canonical weight-save flows pass.
- Browser fixture rerun only to add a settled normal-height screenshot; final count remains 282, not the sum of both runs. Both normal and short-screen screenshots visually inspected.
- `npm run validate:types`: PASS. `git diff --check`: PASS, with added/untracked file whitespace checks also passing.
- Preservation: all 76 unrelated/protected hashed files unchanged; all 78 original dirty files retained. No unexpected new dirty files. HEAD unchanged, index empty. BottomTabBar, Mac handoff checklist, Supabase temporary files and both protected baseline suites remain byte-identical.
- No shared creation, onboarding or SQL code changed. The two unrelated baseline suites were deliberately not rerun; no change to their behavior is expected, but this narrow gate does not verify them.
- Ready for one final full regression. Build/full regression were not run in this task. Independent post-correction recheck, physical devices and live persistence remain separate release evidence.

Detailed results: `correction-report.json`, `browser-report.json`, `preservation-report.json` in the evidence directory above.
