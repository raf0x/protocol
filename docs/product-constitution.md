# MyPepProtocol Product Constitution

**Record once. Understand what changed, in context. Review the evidence when needed.**

This is the durable decision standard for MyPepProtocol. The dated [architecture audit](north-star-product-architecture.md) and [automation roadmap](automation-roadmap.md) describe how to pursue it from the current repository. They do not override these eight rules.

## 1. ENTER ONCE, DERIVE EVERYWHERE

An imported result, recorded protocol change, or corrected entry should become reusable source data. Labs, longitudinal observations, briefings, Analyst, and Doctor Report should consume consistent derived facts rather than require re-entry or reconstruct history independently.

Preserve source identity and provenance. Protocols, compounds, phases, interventions, treatment episodes, starts/stops, and blends remain distinct even when names resemble one another. Friendlier grouping must never merge their underlying records. Original entries and explicit corrections must remain distinguishable from calculated equivalents and generated explanations.

## 2. AI DOES THE WORK, NOT THE USER

The experience should reduce the work of assembling context, finding relevant evidence, and understanding recorded changes. Users should not need to inspect every chart or become expert prompt writers to obtain a concise explanation.

AI may synthesize supplied evidence; it must not invent measurements, reconstruct missing dosing history, or replace deterministic calculations. Automatic AI processing remains subject to explicit consent, revocation, authorization, and clear provider/data-use boundaries. Consent to one data scope is not permission to silently expand it. Deterministic intelligence remains usable without AI.

## 3. DETERMINISTIC LOGIC OWNS FACTS

Dates, identities, units, arithmetic, comparison eligibility, historical protocol states, evidence windows, confounders, and ranking inputs belong to inspectable code. AI text is never the system of record.

Medication dose, concentration, injection volume, and syringe markings are separate concepts. Medication mg, mcg, and IU must not be confused with mL or syringe units. Preserve save-first dosing and unverified legacy entries; do not guess conversions or reinterpret history automatically.

Current Protocol Changes observations use numerical lab biomarkers only. Weight, sleep, mood, energy, hunger, and journal scores remain available elsewhere. Future lifestyle and wearable sources need their own evidence models; a shared date does not make their measurement semantics interchangeable.

## 4. CONCLUSION BEFORE RAW DATA

Lead with a brief, qualified account of what changed and what remains uncertain. Make the measurements, dates, ranges, comparison window, and protocol context available for inspection immediately afterward. Do not force users to reconstruct a story from isolated numbers.

These are hypothetical communication examples, not account-specific findings:

| Less useful | Required direction |
| --- | --- |
| “LDL is 106 mg/dL.” | “LDL decreased from 131 → 112 → 106 mg/dL.” When the dates establish it: “Most of the recorded decrease occurred before the current protocol began, so the available history does not support attributing the majority of the change to that protocol.” This does not attribute the remaining change to treatment either. |
| “Hematocrit increased.” | “Hematocrit increased from 44.5% to 48.3%. A prior value of 48.1% had already been recorded, placing the latest result close to a previously observed level.” |
| “IGF-1 improved because of CJC/Ipamorelin.” | “IGF-1 increased across the recorded timeline, including after CJC/Ipamorelin began. The timing establishes sequence and temporal association, not causation.” |

## 5. LESS BUT BETTER

Prioritize a small number of supported observations. Repeated insufficient-data cards, equal emphasis on every measurement, and long unstructured event selectors make understanding harder.

Use progressive disclosure and deterministic, explainable ordering. Show one useful empty state where comparisons are unavailable. A visually prominent finding is not necessarily clinically important; presentation priority must not imply medical urgency or treatment advice.

## 6. UNCERTAINTY IS A FEATURE

**Never make causal claims from observational personal health timelines.** Such history supports sequence, temporal association, correlation, and contextual comparison. It does not establish treatment causation.

State missing measurements, incompatible units or assays, conflicting same-day readings, sparse follow-up, mutable historical plans, and overlapping interventions explicitly. Evidence strength describes the recorded support for an observation, not treatment efficacy, clinical significance, or statistical certainty.

Prefer “increased” and “decreased” to an unqualified “improved.” Distinguish a supplied lab reference range from the person's previously observed history. A familiar historical value does not establish safety, optimality, or clinical normality. Never label it “normal for this person.” Missing follow-up is missing evidence, not evidence of stability or no effect.

## 7. AUTOMATION SHOULD FEEL INVISIBLE

Routine derivation should happen without repeated setup, reconciliation, or context assembly. Invisible automation must never mean invisible health-data sharing, hidden record correction, or irreversible actions without appropriate user involvement.

“Approximately 99% automated” describes the desired experience, not a literal engineering KPI. Evaluate actual outcomes: no duplicate entry; fewer import corrections; less manual reconciliation; consistent facts across surfaces; no manual historical reconstruction when sources exist; and useful explanations without inspecting every chart. Request user intervention for genuine ambiguity, not to satisfy the architecture.

## 8. MANUAL ENTRY REMAINS AVAILABLE AS A FALLBACK

Preserve manual correction and confirmation for unusual PDFs, failed imports, uncommon biomarkers, legacy records, dosing ambiguity, and future integration failures. Users must be able to save what they know without manufacturing certainty.

Fallback must preserve raw input and clearly distinguish unverified information from confirmed facts. It should lead back into the same canonical sources and deterministic derivation path, not become a second disconnected record system. Reliable automation removes repetitive work while leaving the person in control of ambiguous information.
