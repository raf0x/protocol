# MyPepProtocol Launch Blockers V1

Implementation date: September 11, 2026

## Production migration

Apply `supabase/migrations/202609150001_launch_blockers_v1.sql` before deploying the application build. The migration is additive and rerunnable. It does not update, backfill, anonymize, or delete historical records when applied.

The migration adds:

- Three AI processing consent fields to `user_profiles`.
- `app_rate_limits`, an owner-keyed atomic fixed-window counter.
- `app_error_events`, a privacy-scrubbed operational event table.
- `check_app_rate_limit_v1`, the authenticated durable limit operation.
- `delete_my_account_data_v1`, the authenticated transactional application-data deletion operation.

## Account deletion

Profile contains a compact destructive section. The signed-in user must type `DELETE`. The API verifies the session and same-origin request, checks service-role configuration, then invokes one database function that deletes known owner rows child-first. Before the first deletion, the function rejects any unreviewed public base table that has a `user_id` column.

The application-data deletion is one database transaction. Supabase Auth user deletion is a separate Admin API operation and therefore cannot share the database transaction. If Auth deletion fails after application records were removed, the API returns a partial-failure error and never reports success. The remaining empty sign-in account can retry or be handled by support. On complete success, the browser signs out, clears local app storage and caches, and returns to `/`.

The audited owner data is: protocols, compounds, phases, protocol events, injection logs, journal entries including weight, lab panels, lab results, shared protocols, push subscriptions, user profiles, and rate-limit state. No persisted AI output table or Supabase Storage upload path exists in the current repository.

## AI processing consent

AI Health Analyst and the optional AI Doctor Report summary verify versioned consent on the server before loading or transmitting selected health evidence. The first request without consent returns `AI_CONSENT_REQUIRED`; the client presents the shared disclosure and retries only after permission is stored.

Revocation is available in Profile and immediately blocks later AI transmissions. A deterministic report with its AI option disabled continues to work without consent. Consent version 1 requires all three profile values: affirmative choice, timestamp, and version.

## Durable rate limiting

The authenticated Supabase RPC owns the permitted buckets and limits:

| Bucket | Limit | Window |
| --- | ---: | ---: |
| Health Analyst | 8 | 10 minutes |
| Doctor Report AI | 6 | 10 minutes |
| Doctor Report deterministic | 30 | 10 minutes |
| Push subscription update | 5 | 1 minute |

Counters are keyed by authenticated `auth.uid()` and bucket. A production database/RPC failure fails closed with a controlled 503 before protected work. Development may use the existing process-local limiter so local setup remains simple. Blocked requests return structured `RATE_LIMITED` data and `Retry-After`.

## Privacy-scrubbed monitoring

Next.js server request failures, route failures, AI/report failures, account/consent failures, push delivery failures, and client error boundaries record only:

- sanitized route
- error class/type
- source
- HTTP status
- release/deployment identifier when available
- random request identifier
- timestamp

The schema intentionally has no user ID, health payload, message, stack, lab value, dose, note, question, token, or evidence field. Writes use the server-only service role. Monitoring failure returns false or 204 and cannot break the product path.

## Environment and external setup

No new vendor, account, package, or environment variable is required. Existing values remain:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`, now required for account deletion and monitoring
- existing AI, push, and cron variables for those optional features

Never expose `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `VAPID_PRIVATE_KEY`, or `CRON_SECRET` through `NEXT_PUBLIC_` variables.

## Operations

- Alerting is not configured in code. Review `app_error_events` in the Supabase operational dashboard and establish retention and alerts before broad release.
- The deletion function deliberately fails if a future owner table is not added to its reviewed list.
- The original core schema migration is not present in this repository. Explicit deletion plus foreign-key rollback safety avoids relying on unverified legacy cascades.
- Supabase backup lifecycle and provider retention are operational configuration, not altered by this migration.

## Legal TODO

This work does not fabricate Terms of Use. Before public launch, obtain counsel review of the Privacy Policy and Terms, retention/backup language, medical positioning, controller identity, support details, and App Store privacy declarations.
