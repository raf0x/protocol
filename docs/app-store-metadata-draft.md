# App Store metadata draft

Draft date: September 11, 2026. This is working copy only. Recheck App Store Connect field limits, obtain legal review, and confirm the native build before submission.

## Identity

- App name: **MyPepProtocol**
- Primary category recommendation: **Health & Fitness**
- Secondary category candidate: **Medical**, only if counsel and App Review positioning support it. Health & Fitness is the safer primary position because the product records user-entered information and does not diagnose or prescribe.

Subtitle candidates:

1. `Protocols and health history`
2. `Track protocols over time`
3. `Your longitudinal health log`

Recommended subtitle: `Protocols and health history`

## Concise description

Track personal protocols, dosing schedules, journal check-ins, weight, and lab history in one private longitudinal record.

## Full description draft

MyPepProtocol helps you organize the health information you choose to record over time.

See what is scheduled today, keep active and completed protocols organized, record administration history, and review changes on a chronological timeline. Add journal check-ins and lab results to keep relevant records together. Create a clear, deterministic report to bring to an appointment.

Optional AI-assisted features can summarize selected recorded evidence only when you request them and give explicit permission. Supporting records and limitations remain visible, and permission can be revoked from Profile.

MyPepProtocol is a tracking and informational tool. It does not diagnose conditions, prescribe treatment, recommend doses, or replace professional medical care. In an emergency, contact local emergency services.

Key capabilities:

- Today view for scheduled protocol activity
- Active, completed, and phased protocol organization
- Longitudinal protocol, journal, weight, and lab timeline
- User-entered lab history and same-unit trend views
- Doctor-ready factual report and browser PDF export
- Optional, consent-gated AI summaries grounded in recorded evidence
- In-app account deletion and privacy controls

## Keyword candidates

`protocol tracker,health journal,medication log,lab results,wellness history,dose schedule,health report`

Validate final keywords for duplication, field length, localization, trademark, and medical-claim risk before submission.

## URLs

- Privacy URL: `https://[production-domain]/privacy`
- Support URL: `https://[production-domain]/support` **placeholder; page does not exist yet**
- Marketing URL: `https://[production-domain]/` optional

Do not submit the support placeholder. Create a maintained public support page with contact expectations before App Review.

## Age-rating considerations

- Complete Apple’s current questionnaire truthfully after the wrapper and content are final.
- The product is intended for adults and includes medication/protocol and health information.
- Confirm whether any Learn/admin content references controlled substances, mature medical topics, or user-generated content.
- Do not infer a final rating from source code. Counsel/product ownership must confirm intended age availability and regional requirements.
- Review Apple’s current [age-rating definitions](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions) at submission time.

## AI disclosure notes

- AI is optional, initiated by the user, and gated by explicit versioned permission.
- Selected relevant health evidence and the question/report context are sent to OpenAI.
- Generated analyst answers and report summaries are not saved in the application database by current code.
- AI output may be inaccurate and does not diagnose or replace care.
- Confirm OpenAI API retention/configuration and final native network behavior before declaring App Privacy answers.

## Health-data positioning

- Describe the app as user-entered tracking and longitudinal organization.
- Avoid efficacy, diagnosis, treatment, prevention, dosage recommendation, and clinical decision-support claims.
- Do not describe the app as HIPAA compliant, encrypted end-to-end, clinically validated, or a medical device without substantiation and review.
- Keep dose calculations framed as user-directed organization, with existing uncertainty and advisory behavior.

## Reviewer notes outline

1. Provide a dedicated disposable reviewer email and current one-time-code access instructions.
2. State that the account contains fictional data only and is isolated from production users.
3. List a short route: Today, Protocols, Timeline, Health, AI Analyst, Create report, Profile.
4. Explain that first AI use requires explicit consent; the reviewer may grant and revoke it in Profile.
5. Point to in-app account deletion in Profile and clearly warn that it permanently deletes the disposable account.
6. State that push reminders are intentionally deferred for V1 and are not a submitted feature.
7. Explain browser print/Save as PDF behavior if the native wrapper delegates that flow to iOS.
8. Provide a reachable support contact and production privacy URL.

## Counsel and owner checklist

- [ ] Counsel-approved Terms of Use exists and is linked publicly and in-app.
- [ ] Privacy Policy has final entity, jurisdiction, retention, backup, processor, and contact details.
- [ ] Support URL and response ownership are live.
- [ ] App name/subtitle/keywords have trademark review.
- [ ] Health and dosage positioning has App Review and legal review.
- [ ] App Privacy answers match production providers and native telemetry.
- [ ] Reviewer account and notes are tested from a clean device.
