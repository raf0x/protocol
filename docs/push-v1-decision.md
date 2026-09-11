# Push decision for App Store V1

Decision date: September 11, 2026

## Decision: defer

Push reminders will not ship as an enabled App Store V1 feature. The Profile surface shows a calm coming-later state while the service worker, subscription API, and delivery code remain in the repository.

This is a reliability decision, not a statement that iOS Web Push is unsupported. The current implementation has these release gaps:

1. Reminder hours are stored as server-hour integers without a user timezone or timezone-change policy.
2. Failed provider deliveries do not remove expired 404/410 subscriptions.
3. Delivery exists in both the cron route and a user-triggered push route, so production ownership is not singular enough for launch operations.
4. Installed-mode permission, Focus mode, notification tap routing, reinstall, and device replacement have not completed physical iPhone QA.

`APP_STORE_V1_PUSH_ENABLED` in `lib/appRelease.ts` is the release gate. Do not change it to `true` until all criteria below pass.

## Re-enable criteria

- [ ] Persist an IANA timezone for every reminder subscriber.
- [ ] Define behavior for travel, daylight-saving changes, and missing/invalid timezones.
- [ ] Choose one scheduled production delivery path and remove or restrict the other.
- [ ] Delete or disable subscriptions after confirmed 404/410 provider responses.
- [ ] Add idempotency so one due reminder produces at most one delivery attempt per window.
- [ ] Add operational counts for attempted, delivered/accepted, expired, and failed subscriptions without notification content.
- [ ] Pass installed iOS tests for grant, deny, disable, reinstall, tap routing, background receipt, Focus mode, and timezone changes.
- [ ] Update Privacy/App Privacy declarations if the final native notification architecture changes processors or identifiers.

Do not weaken authentication or route limits to make notification QA easier.
