# App Privacy mapping draft

Draft date: September 11, 2026

This mapping is derived from the current repository after Launch Blockers V1. It is not legal advice and is not an App Store Connect submission. Confirm production configuration, native wrapper behavior, processor contracts, logs, retention, and Apple’s current definitions before answering App Privacy questions.

## Tracking declaration

No advertising SDK, data broker integration, cross-app advertising identifier, or cross-company tracking use was found in the repository. The current code does not use collected data for tracking as Apple defines it. Confirm that the production domain, Vercel configuration, Supabase project, support tooling, and future native wrapper do not add tracking before selecting **Data Not Used to Track You**.

## Collection mapping

| Apple category | Current data | Linked to user | Purpose | Used for tracking | Current processors | Confirmation needed |
| --- | --- | --- | --- | --- | --- | --- |
| Health & Fitness: Health | Protocols, compounds, medication/admin details, phases, events, injection logs, weight, sleep, energy, mood, hunger, discomfort, labs and reference ranges | Yes | App functionality; user-requested analytics and reports | No in current code | Supabase; OpenAI only for consented, requested AI work; Vercel transport/logging | Confirm Apple subcategory selection, retention, backups, OpenAI API settings, and whether native crash tooling is added. |
| Contact Info: Email Address | Sign-in email and authentication messages | Yes | Authentication, account management, support | No | Supabase Auth; Resend for transactional email; Vercel transport/logging | Confirm Resend production role and retention. |
| Identifiers: User ID | Supabase account identifier and record ownership keys | Yes | Authentication, security, rate limiting, account scoping | No | Supabase; Vercel may receive request/session network metadata | Confirm platform-log retention and whether Apple considers future native installation identifiers separately. |
| Identifiers: Device ID or other identifier | Browser push endpoint and encryption public keys when push is enabled | Yes | Notifications | No | Supabase; browser/Apple push service; Vercel | Push is deferred for V1. Reassess if native APNs tokens are added. |
| User Content: Other User Content | Freeform protocol, journal, lab, and report notes; AI questions; imported filename/provenance | Yes | App functionality; user-requested AI functionality | No | Supabase for saved records; OpenAI receives minimized question/evidence on consented request; Vercel transport/logging | Confirm whether filenames/content enter provider logs and final import behavior. Current PDF/CSV parsing is client-side before reviewed values are saved. |
| Usage Data: Product Interaction | Authenticated feature requests and route access necessarily present in hosting/service logs | Potentially | App functionality, security, reliability | No | Vercel and Supabase platform logs | No analytics SDK was found. Confirm provider log fields and retention before declaring whether Apple treats these as collected. |
| Diagnostics: Crash/Performance/Other Diagnostic Data | Privacy-scrubbed operational event: route, sanitized error type, status, release, timestamp, random request ID, source | No application account identifier in the custom event | Reliability, security, troubleshooting | No | Supabase; Vercel transport/logging | Confirm IP/platform log treatment, retention, staff access, and whether future native crash reports add device-linked fields. |

## Data not intentionally included in custom monitoring

The `app_error_events` payload builder does not include lab values, protocol doses, journal notes, AI questions, evidence, auth tokens, API keys, request bodies, error messages, or stack traces. Production QA must inspect stored rows and platform logs rather than relying only on source review.

## Processing and storage notes

- Supabase stores authenticated application records, owner-scoped rate-limit counters, AI permission state, and privacy-scrubbed operational events.
- Vercel hosts the Next.js application and necessarily processes network requests. Platform logs are outside the custom monitoring table.
- Resend is identified in the public policy as the transactional authentication email provider.
- OpenAI is called only for a user-requested analyst/report AI operation after server-side consent verification. Current generated answers are returned to the client and are not written to app tables.
- Browser print creates the current report/PDF flow. The application does not upload the generated PDF in current code.
- Push is deferred for App Store V1. If enabled later, update this map for endpoint/device tokens and the final Apple/browser delivery architecture.

## Submission confirmation checklist

- [ ] Re-read Apple’s current [App Privacy data type definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/app-privacy).
- [ ] Confirm production Supabase region, retention, backups, deletion lifecycle, RLS, and staff access.
- [ ] Confirm Vercel logs, analytics settings, firewall/security products, and retention.
- [ ] Confirm Resend message metadata and retention.
- [ ] Confirm OpenAI API data controls, retention, model/provider, and subprocessors.
- [ ] Confirm the native wrapper adds no crash, analytics, attribution, advertising, or device-ID SDK.
- [ ] Confirm account deletion behavior and backup/provider deletion language with counsel.
- [ ] Confirm all privacy-policy statements and App Store selections use the same definitions.
- [ ] Obtain legal and product-owner sign-off before submission.
