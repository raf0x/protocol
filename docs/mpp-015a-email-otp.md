# MPP-015A: Unified email OTP signup and login

Implemented locally on `main`, on top of the uncommitted MPP-015 work. Nothing staged, committed, deployed, or changed remotely in Supabase. No migration, analytics, protocol-semantic change, or onboarding redesign.

## Findings and evidence

### Confirmed from repository code

- The original login page already called `signInWithOtp({ email, options: { shouldCreateUser: true } })` directly through `lib/supabase.ts`. No separate `signUp`, server action, login API route, or OAuth initiation UI was found. Both new and existing emails already used this one request.
- The original code-entry screen called `verifyOtp({ email, token: code, type: 'email' })`. Installed `@supabase/supabase-js` / `auth-js` **2.103.0** supports these exact arguments. Requesting a code returns no session; successful verification persists the returned session before resolving.
- `@supabase/ssr` **0.10.2** `createBrowserClient` uses its cookie storage, PKCE, and session persistence. The callback's server client reads/writes through Next's async `cookies()` adapter. `proxy.ts` validates users and propagates refreshed cookies. These conventions remain in place; no manual token storage was introduced.
- The original UI had no resend action on code entry, lacked synchronous duplicate guards, displayed raw request errors, claimed a ten-minute expiry without tracked evidence, and navigated directly to `next` after OTP verification without checking ownership or requiring a returned session.
- MPP-015 routes `/onboarding` to `/protocol`. Today checks authenticated, unfiltered protocol ownership, then opens `/protocol/manage?new=1&onboarding=1` for an unseen empty account. `Not now` uses the existing per-user session dismissal marker. That flow and the MPP-014 canonical save remain unchanged.
- Existing callbacks support PKCE `code` exchange and token hashes of types `signup`, `invite`, `magiclink`, `recovery`, `email_change`, and `email`. No callback type was added or removed. This patch checks callback failures instead of silently treating an already-present session as successful link verification.
- No tracked Supabase Site URL, redirect allowlist, email templates, OTP settings, or profile-creation trigger definition was found. `capacitor.config.ts` identifies the app origin as `https://www.mypepprotocol.app`; it does **not** establish the Dashboard's Site URL. The original request supplied no `emailRedirectTo`; that remains unchanged for the numeric-code flow.
- The original `user_profiles` schema predates tracked migrations, as documented in `202609170001_lab_findings_seen_marker_v1.sql`. Its auth trigger timing cannot be established from this repository. No trigger was redesigned.

### Inferred from the reported production email

The subject “Confirm your email address” and a confirmation link are consistent with a link-based **Confirm signup** template being used for a new email. This likely explains the mismatch with “Send code.” It does not prove the deployed template contents, Site URL, redirect allowlist, or why that particular link failed to establish a usable application session. No deployed template or email was inspected by this implementation.

### Settings reported by Rafael in this task

| Setting | Reported production value |
| --- | --- |
| Email OTP length | 6 digits |
| Email OTP expiration | 3,600 seconds |
| Minimum interval per user | 60 seconds |
| Sending-email rate limit | 100; confirm the Dashboard's displayed quota window during rollout |
| Token refresh / token verification | 150 / 30 |
| Anonymous users / signups and sign-ins | 30 / 30 |

The UI defaults match the confirmed six digits and 60 seconds. It makes no numerical expiry promise. These are user-confirmed settings, not a claim that the agent inspected production.

## Resulting flow and security behavior

1. One email field and **Email me a code**. Only surrounding email whitespace is trimmed; case, plus addressing, and internal characters are not rewritten.
2. A successful request opens **Check your email** with **Enter the code sent to [email address].** Provider errors stay on the current screen with neutral copy, never raw account-existence messages.
3. One labeled text input accepts complete pasted codes, removes whitespace, preserves leading zeroes, and uses `inputMode="numeric"` and `autoComplete="one-time-code"`. Exact numeric length is checked at submission; invalid characters are rejected rather than silently stripped into another token.
4. **Verify code** calls the installed SDK with `type: 'email'`. A returned user and session access token are required before proceeding. The SDK writes the session using existing SSR cookie storage. The application adds no user/profile/protocol writes.
5. `lib/authPostAuth.ts` is the shared sign-in routing decision for OTP verification, existing sessions on the login page, and legacy sign-in/OAuth callbacks. It uses the existing MPP-015 `onboardingEligible` predicate and an owner-scoped `select('id').eq('user_id', userId).limit(1)` without a lifecycle filter. The query has a five-second abort signal.
6. A successful empty ownership read goes to `/onboarding`; MPP-015 owns the next screen and dismissal behavior. First-protocol entry takes precedence for an empty account. Any owned protocol retains the validated relative `next`, defaulting to `/protocol`. Ownership errors, missing results, and timeouts use that normal destination and never establish first-user eligibility; Today retains its independent retry/check.
7. Recovery, invitation, and email-change callbacks retain their existing safe action destination rather than being diverted through first-protocol setup. PKCE recovery intent from the installed SDK's verifier is also preserved. This app has no separate recovery/invite/email-change UI to add or redesign in this task.
8. Redirect validation rejects external, protocol-relative, backslash, control-character, malformed-percent, encoded unsafe, and auth-loop targets, including unsafe normalized dot-segment paths. Legitimate relative paths, queries, and hashes remain supported. Callback responses are not cached and do not forward referrers.
9. Synchronous refs guard send/verify requests before React renders, and a completed flag consumes successful verification once before routing. Changing email clears the input token and errors but retains cooldown deadlines. Resend uses the same `signInWithOtp` request and clears the old code field only after success; users are told to use the latest email. Supabase remains responsible for token replacement, expiry, and single use.
10. Rate-limit errors use a local retry countdown matching the 60-second minimum. The SDK does not expose a reliable Retry-After deadline through `AuthError`; project/IP quotas can last longer, so the UI explicitly permits another attempt after the timer without promising that Supabase will accept it. Provider limits remain authoritative.

For another environment, these optional **public build-time** values must match its Supabase settings; rebuild after changing them:

```dotenv
NEXT_PUBLIC_AUTH_EMAIL_OTP_LENGTH=6
NEXT_PUBLIC_AUTH_EMAIL_RESEND_SECONDS=60
```

They contain no secrets. Production already matches the defaults Rafael supplied. No new environment variables are required for that configuration.

## Rafael: Dashboard reconciliation

Use the production project in **Supabase Dashboard → Authentication → Email Templates** (some Dashboard versions group this under **Authentication → Email → Templates**).

Audit and update **both** of these templates. A fresh signup and a returning user may select different templates even though the application uses the same request. Supabase documents that the token variable determines code-based email content: [passwordless email flow](https://supabase.com/docs/guides/auth/auth-email-passwordless), [email template variables](https://supabase.com/docs/guides/auth/auth-email-templates).

| Template | Copy-ready subject |
| --- | --- |
| Confirm signup | Your MyPepProtocol sign-in code |
| Magic Link | Your MyPepProtocol sign-in code |

Paste this **same complete HTML body into both templates**:

```html
<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
  <body style="margin:0;padding:24px;background:#f5f5f7;font-family:Arial,sans-serif;color:#181820;">
    <table role="presentation" style="width:100%;max-width:480px;margin:0 auto;border-collapse:collapse;">
      <tr><td style="padding:28px 24px;background:#ffffff;border-radius:12px;">
        <p style="margin:0 0 24px;font-size:18px;font-weight:700;">MyPepProtocol</p>
        <h1 style="margin:0 0 16px;font-size:24px;line-height:1.3;">Your sign-in code</h1>
        <p style="margin:0 0 24px;font-size:16px;line-height:1.5;">Enter this code in MyPepProtocol to sign in:</p>
        <p style="margin:0 0 24px;padding:20px 8px;background:#f1f2f4;border-radius:8px;text-align:center;font-size:32px;font-weight:700;letter-spacing:4px;font-variant-numeric:tabular-nums;">{{ .Token }}</p>
        <p style="margin:0;font-size:14px;line-height:1.5;color:#555560;">If you did not request this, you can ignore this email.</p>
      </td></tr>
    </table>
  </body>
</html>
```

Do not leave an old button/link elsewhere in either template. These bodies intentionally contain no `{{ .ConfirmationURL }}`, `{{ .TokenHash }}`, authentication link, health information, account-existence language, or hard-coded expiry promise. Do not put the code in the subject. Confirm the actual delivered email, not only the template preview.

Leave **Reset Password / Password recovery**, **Invite user**, **Change email address**, **Reauthentication**, and security-notification templates untouched.

Verify manually before rollout:

- **Authentication → Sign In / Providers → Email**: email signup is enabled, **Confirm Email stays enabled**, OTP length remains **6**, expiration remains **3600**. Expiration also affects other email links; do not change it casually. [Supabase email OTP documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- **Authentication → Email → SMTP Settings**: minimum interval per user remains **60 seconds**; production SMTP/sender identity works for recipient addresses outside the project team. Do not copy credentials into this repository or chat.
- **Authentication → Rate Limits**: retain the configured quotas. Confirm the displayed time windows and SMTP capacity. The per-user resend interval is separate from the project email quota. [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits)
- **Authentication → URL Configuration**: record the existing Site URL and exact permitted redirect URLs. Reconcile with the deployed application origin and already-supported `/auth/callback` links. Do not add wildcard/external destinations. OTP entry does not require an email redirect; outstanding link behavior still depends on the old link's URL and, for PKCE, the requesting browser's verifier cookie.
- If a custom **Send Email hook** is enabled, verify its delivered content also renders the token for these two actions. A hook may determine content independently of Dashboard templates.
- Check whether email-template/provider tracking modifies authentication links in the untouched legacy templates. Do not assume previously issued links contain the callback parameters this repository supports. No new implicit-fragment callback handling was added.

### Profile trigger audit (read-only, manual)

In the Dashboard SQL editor, Rafael can inspect trigger definitions without reading user data or changing the database:

```sql
select t.tgname,
       pg_get_triggerdef(t.oid) as trigger_definition,
       pg_get_functiondef(t.tgfoid) as function_definition
from pg_trigger t
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'auth' and c.relname = 'users' and not t.tgisinternal;
```

If an unconditional `AFTER INSERT ON auth.users` trigger creates a profile, it runs when the initial OTP request creates the unconfirmed auth user, before successful OTP verification. Consequences: a profile can represent an unverified or abandoned signup; profile counts alone do not establish activation; a failing trigger can block new signup. Such a profile must not grant access independently of the authenticated session and owner RLS. Conditional triggers may behave differently. Inspect the actual function and owner policies before drawing conclusions. This patch performs no profile insert/upsert and does not alter triggers or RLS.

## Deployment order

1. Save the current subjects/HTML for the two templates and record current provider/URL settings privately. Preserve the running deployment for rollback. Include the existing MPP-015 changes as a reviewed dependency; MPP-015A imports its eligibility helper and relies on its onboarding entry.
2. Rehearse the complete flow in a staging project with the same six-digit/60-second settings and both code templates. Keep Confirm Email on. Validate a truly unused email and an established account with an owned protocol.
3. Deploy the reviewed MPP-015 + MPP-015A application bundle first. It supports numeric OTPs and retains valid legacy callback paths. Run the local/build checks below before deployment. No database migration is needed.
4. Immediately update **Confirm signup** and **Magic Link** as one coordinated change window. Until both are saved, the code/link mismatch can still affect some requests. Avoid sending launch traffic during this interval. Do not disable verification or auto-confirm accounts to bridge it.
5. Run the production checks below using controlled test accounts. Release traffic only after both account types receive codes and establish sessions from one request. Keep the callback for outstanding emails; do not expire or rewrite existing users/tokens manually.

## Rollback

- If the application deployment regresses, roll back that deployment. The prior login already supported six-digit email OTP verification, so retain the two code templates if staging confirms compatibility with the rollback version. Do not discard the working-tree MPP-015 work or revert unrelated commits.
- If template delivery fails, restore both backed-up subjects/bodies together and stop the rollout. Restoring link templates restores the reported mismatch until corrected; it is a temporary operational fallback, not resolution of MPP-015A.
- Keep provider settings, Confirm Email, RLS, and callback support intact. No schema rollback, user deletion, auth-user mutation, token copying, or manual confirmation is part of rollback.

## Post-change acceptance checklist

- [ ] Truly unused email: exactly one request, code email (correct branded subject/body, six digits, no confirmation link), same-screen verification, confirmed email and usable authenticated session, direct MPP-015 first-protocol entry. No second email request.
- [ ] Existing email with owned protocol: identical outward request/code UI and email copy, successful session, normal destination. Repeat with Planned, Scheduled, Active, and completed ownership.
- [ ] Valid relative `next` retains path/query/hash for an existing owner; external, protocol-relative, encoded-backslash/slash, malformed, and auth-loop values do not redirect externally.
- [ ] Invalid and expired codes each show one inline error, preserve the email, and allow a new request after cooldown. Test expiry in staging without changing production expiry.
- [ ] Resend unavailable for 60 seconds; successful resend uses the same request, clears the old input, and the latest code works. Verify Supabase's actual prior-code supersession behavior with controlled staging accounts rather than promising a client-enforced invalidation rule.
- [ ] A used code cannot establish another session. Rate-limited requests/verification do not claim delivery or expose account existence. Use staging for rate-limit testing rather than exhausting production quotas.
- [ ] Fast taps/Enter produce one request and one verification. Browser refresh after verification retains authentication; protected routes recognize the SSR session. No duplicate profiles/onboarding records/protocols result.
- [ ] iPhone Safari and Capacitor: numeric keyboard, whole-code paste, leading zeroes, one-time-code autofill, readable errors/VoiceOver, visible focus, safe areas, and reachable Verify action with the keyboard. Inspect widths 320, 375, and 390 px.
- [ ] `Use a different email` returns to email entry, preserves the cooldown, and removes the old token. MPP-015 `Not now` still returns to Today and does not immediately reopen onboarding.
- [ ] Previously issued valid confirmation/Magic Link emails still work where their URL format and PKCE verifier are supported. Test OAuth PKCE and any configured recovery/invite/email-change flows using their existing safe destinations; their templates remain untouched.
- [ ] Inspect the actual profile trigger timing; distinguish unconfirmed signup/profile counts from completed authentication. Do not add analytics as part of this patch.

## Local validation

- `node --test tests/auth-email-otp.test.mjs`: **56 passed**. Redirect attacks, lifecycle-independent ownership, safe query failures, callback types and cookies, normalization/error mapping, and a real installed Supabase SDK request/verify/session-cookie round trip against a local fake HTTP transport.
- `node tests/auth-email-otp.browser.cjs`: **66 browser assertions passed**, plus accessible-name inspection. Actual React login component and CSS, mocked Supabase/router only. New/existing requests, rapid taps/Enter, request errors, invalid/expired/missing-session verification, rate limits, resend, changing email, leading zeroes/paste, safe next, initial session routing, focus, enlarged text, short keyboard viewport, and 320/375/390 px layout. No real emails were sent. iOS autofill/VoiceOver and provider single-use semantics remain real-device/staging checks.
- `node --test tests/protocol-onboarding.test.mjs tests/protocol-quick-start.test.mjs tests/today.test.mjs`: **48 passed**; MPP-015 retained.
- `tests/app-store-readiness.test.mjs`: **36 passed, 5 pre-existing failures**. All five reproduced from committed HEAD in an isolated snapshot: print controls, privacy disclosures, demo fixture wording, privacy/support links, and the outdated assertion that Capacitor must be absent. All authentication checks in that file pass. No unrelated repairs made.
- `npm run build`: **passed**, including Next.js TypeScript validation and prerendering. Network access was used only for the existing Google Font build dependency.
- Focused ESLint on the five changed authentication TypeScript files: **passed with no findings**. `git diff --check`: **passed**.
- `node tests/protocol-onboarding.browser.cjs`: **passed**, with zero runtime errors. Existing MPP-015 first-protocol entry, `Not now`, canonical saves, success, persistent rings, and mobile controls remain functional in the local mocked browser fixture.

MPP-015A files: `app/auth/login/page.tsx`, `app/auth/login/login.module.css`, `app/auth/callback/route.ts`, `lib/authRedirect.ts`, `lib/authPostAuth.ts`, `lib/emailOtp.ts`, `tests/auth-email-otp.test.mjs`, `tests/auth-email-otp.browser.cjs`, and this document. The callback already contained MPP-015 changes; review its combined diff. All other existing MPP-015 and unrelated working-tree changes are preserved. No `git add .` or other staging was performed.
