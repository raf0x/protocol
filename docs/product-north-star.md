# MyPepProtocol Product North Star

**Finalized:** September 22, 2026  
**Status:** Stable product direction

## North Star

**Record once. Understand what changed, in context. Review the evidence when needed.**

MyPepProtocol is becoming a private, AI-native longitudinal health intelligence system for people managing peptides, hormone therapies, medications, labs, symptoms, weight, and related health interventions.

The product should eliminate approximately 99% of avoidable user work. Users should spend as little time as possible entering, organizing, maintaining, comparing, interpreting, or reconstructing their health history. MyPepProtocol should do that work and present the result as a short, clear, evidence-backed briefing.

MyPepProtocol must answer three questions exceptionally well:

1. What is my current health state?
2. What has changed?
3. What changed around my protocols, lifestyle, or other interventions?

## The ideal experience

**Connect, upload, or record once**  
→ MyPepProtocol organizes the record  
→ MyPepProtocol reconstructs the history  
→ MyPepProtocol identifies meaningful changes  
→ MyPepProtocol determines what evidence exists  
→ MyPepProtocol explains what matters and what remains uncertain  
→ The user reviews a short, clear briefing and can inspect the evidence

The product should not require users to maintain duplicate records, search through disconnected charts, or interpret everything themselves.

## Product promise

MyPepProtocol turns a user's own longitudinal health record into clear, contextual intelligence while preserving the evidence behind every important conclusion.

It should feel less like a tracker and more like a continuously maintained health intelligence layer over the user's own data.

## Who it serves

The primary user is a person actively managing one or more health protocols who needs a reliable record of treatments, preparation, dosing, schedules, inventory, labs, symptoms, weight, and outcomes over time.

The product also helps that user prepare for better conversations with a clinician by making the recorded history clear, structured, and traceable. It does not replace medical care.

## Product constitution

### 1. Enter once, derive everywhere

If the system already has information, never ask the user to enter it again. Canonical data feeds every relevant surface. Avoid redundant persistence unless there is a concrete operational reason.

### 2. AI does the work, not the user

Prefer import, parsing, inference, normalization, reconciliation, comparison, and summarization over forms, manual tagging, and duplicate entry. Ask the user only when the system cannot determine the answer safely or reliably.

### 3. Deterministic logic owns facts

Deterministic code owns dates, values, units, arithmetic, dose semantics, phase and protocol state, historical reconstruction, reference-range comparisons, measurement matching, intervention windows, confounders, evidence availability, and provenance. AI explains and synthesizes those facts. It does not invent them.

Medication dose, injection volume, and syringe markings are separate concepts and must never be conflated.

### 4. Conclusion before raw data

Show what matters, what changed, why it matters, what is stable, what is uncertain, how strong the evidence is, and what deserves attention before exposing raw data. Raw data remains available for drill-down and audit.

### 5. Less but better

Rank and compress aggressively. Do not surface information merely because it exists. Avoid noisy metrics, low-signal observations, excessive cards, repetitive empty states, and redundant explanations.

### 6. Uncertainty is a feature

Never manufacture confidence. Clearly distinguish known, observed, temporally associated, potentially related, confounded, weak evidence, insufficient evidence, and unknown. Do not present observational timing as causation.

### 7. Automation should feel invisible

The user should not feel that they are operating an AI chatbot. AI is infrastructure. The product experience is the useful outcome: data arrives, intelligence appears, and the user reviews what matters.

### 8. Manual entry remains available as a fallback

Automation reduces manual work but never removes the user's ability to correct, confirm, override, or enter information when automation is unavailable or uncertain.

## Interpretation standard

MyPepProtocol should explain longitudinal context, not merely repeat values.

Weak: “LDL is 106 mg/dL.”

Expected: “LDL decreased from 131 to 112 to 106 mg/dL. Most of the improvement occurred before the current pharmacologic protocol began, so the available history does not support attributing most of the change to the current protocol.”

Weak: “Hematocrit increased.”

Expected: “Hematocrit increased from 44.5% to 48.3%. A prior value of 48.1% was recorded before the current protocol, so the latest result is close to the user's earlier historical level rather than an entirely new elevation.”

Weak: “IGF-1 improved after CJC/Ipamorelin.”

Expected: “IGF-1 increased across the recorded timeline, including after CJC/Ipamorelin began. The timing supports an association, but the observational history cannot establish that the protocol caused the change.”

## Information hierarchy

Every intelligence surface should generally follow this order:

1. Conclusion
2. Context
3. Evidence and uncertainty
4. Raw data

The major product surfaces have distinct jobs:

- **Today:** What needs attention now.
- **Protocols:** What the user is taking, preparing, scheduling, or planning.
- **Timeline:** What happened and when.
- **Health:** What changed, what matters, and what evidence supports it.
- **Journal / Health Entries:** Create, edit, and manage user-recorded health observations.
- **Inventory:** What the user owns, independent from protocol status unless the user explicitly starts or plans a protocol.
- **Reports:** A concise, traceable record for review or clinician discussion.

## Trust and safety boundaries

MyPepProtocol may provide sophisticated organization and interpretation, but it must not:

- diagnose unsupported conditions;
- prescribe medication or protocol changes;
- invent clinical thresholds, dates, values, doses, or source history;
- claim causality from an observational personal timeline;
- silently compare incompatible units, assays, or measurements;
- imply that it replaces a licensed clinician.

Appropriate intelligence includes observed trends, supplied reference-range context, personal historical context, temporal associations, confounders, evidence quality, monitoring opportunities, missing-data identification, and questions worth discussing with a clinician.

## Strategic focus

The product should prioritize work that:

1. Reduces repeated or manual data entry.
2. Strengthens canonical, identity-safe longitudinal history.
3. Improves personal-baseline and cross-date comparison.
4. Ranks findings deterministically and explains them clearly.
5. Produces concise, proactive, evidence-backed briefings.
6. Makes every important conclusion traceable to its source.

Broad wearable integrations, Apple Health, EHR integrations, nutrition platforms, and complex notification systems remain deferred until the core intelligence experience is reliable, useful, and low-friction.

## North Star measure

The primary measure is:

**Useful briefings reviewed:** the number and percentage of active users who review an evidence-backed health briefing generated from their existing record without being required to re-enter information the system already has.

Supporting measures:

- time from account creation to first useful protocol or health insight;
- percentage of displayed facts derived from canonical data rather than duplicate entry;
- percentage of important conclusions with inspectable source evidence;
- successful import and normalization rate;
- user corrections required per imported or derived record;
- repeat briefing review and return usage;
- completion rate for the smallest essential recording workflows.

## Decision test for future work

A proposed feature should advance at least one of the three North Star questions and should preferably reduce user work, strengthen trust, or improve clarity.

Before approving work, ask:

1. Does it help the user understand current state, change, or intervention context?
2. Does it reuse canonical data instead of creating another record or workflow?
3. Can factual outputs be computed deterministically and audited?
4. Does it show uncertainty honestly?
5. Is it simpler than the experience it replaces?
6. Does it preserve manual correction and fallback?

If the answer is no, the feature should be redesigned, deferred, or rejected.

## Final product definition

MyPepProtocol is a private, AI-native longitudinal health intelligence system that helps people record health information once, understand what changed in context, and review the evidence behind every important conclusion.
