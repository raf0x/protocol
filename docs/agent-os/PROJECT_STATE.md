# Project state

Last independently checked: 2026-11-09 (GitHub repository and Vercel deployment metadata). This is a current snapshot, not a release history.

## Production — verified

- GitHub `main`: `eef84b0b8f6122f76ec2d77adbca0dca1da17661` (PR #12 left-edge layout fix).
- Vercel production deployment: `dpl_AXB3UpT6ZMwWcK1L7Y9BqJSi95Ro`, READY, at the matching SHA. Both `www.mypepprotocol.app` and `mypepprotocol.app` are assigned to it.
- Protocol Creation V2A and the later Preparation/iOS left-edge fixes were shipped. Owner reported physical-iPhone acceptance in prior release handoffs; this documentation update did not repeat device testing.

## Known release debt / unverified evidence

- Latest documented broad V2A regression evidence (pre-merge): 2,042 passed / 3 inherited fixture failures. Those involve native app identifier, Terms navigation and profile-query-count assumptions. Results are historical and are not claimed for current `main`.
- Direct production persistence of `final_solution_volume_ml` and `preparation_confirmed` was not conclusively verified after reload. Cross-account RLS enforcement was not fully verified in the live environment.
- Physical-vial remaining balances are deliberately not inferred from unlinked administrations. Current-vial identity is not established by phase preparation alone.
- The repository has 18 migrations but lacks a verified complete core-schema bootstrap for an isolated Supabase QA environment.

## Active branches and review items

- Draft PR #13: Today visual-spacing experiment; no merge or production deployment authorized.
- Draft PR #14: fail-closed CRON_SECRET authorization hardening; review/tests required before production approval.
- See `docs/audits/project-audit-2026-11-09.md` for the verified issues, risks, and proposed owner decisions.

## Next priorities

1. Review privacy implications of the public legacy tracker source and decide whether to retire/redact it.
2. Validate and, if accepted, ship fail-closed cron authorization hardening.
3. Review production owner/RLS isolation, support endpoint abuse protection, and a reproducible database schema baseline.
4. Triage high-growth read paths and the inherited regression fixtures without weakening safety assertions.

## Preservation

Do not assume old Windows worktree details are still accurate. Preserve unrelated worktrees, protected branches, and prior QA evidence until separately verified.
