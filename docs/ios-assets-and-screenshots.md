# iOS assets and screenshot specification

Audit date: September 11, 2026

## Repository asset inventory

| File | Format | Dimensions | Alpha | Purpose | Status |
| --- | --- | ---: | --- | --- | --- |
| `app/favicon.ico` | ICO, four frames | 16, 32, 48, 256px | ICO container | Browser favicon | Ready |
| `public/apple-touch-icon.png` | PNG RGB | 180×180 | None | Safari/iOS Home Screen | Ready |
| `public/icon-192.png` | PNG RGB | 192×192 | None | PWA regular icon | Ready |
| `public/icon-512.png` | PNG RGB | 512×512 | None | PWA regular icon | Ready |
| `public/icon-maskable-192.png` | PNG RGB | 192×192 | None | PWA maskable icon | Ready |
| `public/icon-maskable-512.png` | PNG RGB | 512×512 | None | PWA maskable icon | Ready |
| `public/app-store-icon-1024.png` | PNG RGB | 1024×1024 | None | App Store source | Technically ready; final owner approval required |
| `public/journal-screenshot.png` | WebP RGB | 721×1568 | None | Legacy marketing capture | Not an App Store asset |
| `public/journal-screenshot2.png` | PNG RGBA | 432×988 | Opaque alpha channel | Legacy marketing capture | Not an App Store asset |
| `public/journal-screenshot3.png` | PNG RGBA | 573×956 | Opaque alpha channel | Legacy marketing capture | Not an App Store asset |
| `public/protocol.png` | PNG RGBA | 1151×2265 | Opaque alpha channel | Legacy marketing capture | Not an App Store asset |

The icon family preserves the existing green serif `P` on the established near-black/navy surface. It contains no small text, medical cross, or clinical credentialing. The master has generous central padding and an opaque edge-to-edge background. Regular and maskable manifest entries use separate files so a future maskable adjustment cannot accidentally alter the regular icon.

Before submission, inspect the 1024px source at 100%, 60px, and 29px; preview circle, squircle, and rounded-square masks; and obtain final brand-owner approval. Do not add rounded corners to the source. Apple applies the platform mask.

## Web launch behavior

- Manifest launch background and theme color: `#090e16`.
- Standalone start route: `/protocol`.
- Viewport uses `viewport-fit=cover` and the app shell reserves top/bottom safe areas.
- No device-specific Apple startup images are used. This avoids brittle PWA splash hacks.
- Private application pages remain network-only in the service worker. Offline launch shows the static `/offline` explanation rather than stale health records.

## Future native launch screen

Create the native launch screen only after the Capacitor project exists.

- Use a solid `#090e16` background in the native asset catalog.
- Center the existing mark at roughly 22% to 28% of the shortest screen dimension.
- Use aspect-fit and generous constraints so the mark never touches a safe area.
- Do not show health values, a loading spinner, version text, taglines, or a simulated app screen.
- Support light appearance only if the final app launches light mode before the web theme is known. Otherwise use the dark launch surface consistently.
- Validate cold and warm launches on compact, standard, and Max iPhones without per-device images.

## App Store screenshot production rules

Apple currently accepts one to ten screenshots in PNG or JPEG and does not permit alpha/transparency. Confirm exact accepted dimensions again at submission time using Apple’s [screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications).

Primary capture set:

- 6.9-inch portrait at one accepted native size, preferably 1320×2868 when captured from a matching simulator/device.
- 6.3-inch portrait at one accepted native size, such as 1206×2622 or 1179×2556 for a matching simulator/device.
- If iPad distribution remains enabled, create a separate native iPad set after the wrapper’s supported-device decision. Do not stretch iPhone captures.
- Export RGB PNG or high-quality JPEG with no alpha.
- Use one consistent dark appearance, fixed locale, full battery/network chrome policy, and the same fictional account.
- Never capture a production user account, notifications containing health data, real email, real provider name, filenames, or account identifiers.

## Six-screen fictional capture plan

All records below belong to the fictional reviewer persona **Morgan Lee**. These values are screenshot direction only and must live in the isolated review account, never in production UI code.

| Order | Screen | Ideal state | Fictional content | Capture note |
| ---: | --- | --- | --- | --- |
| 1 | Today | A useful dose is due, rings are visible, no warnings | Three active example protocols; next scheduled entry at 8:00 PM; weekly progress partially complete | Dark mode. Show app value in the first viewport without a technical dosing warning. |
| 2 | Protocols | Active and completed sections both populated | Three active protocols with structured mass/IU examples and one completed protocol | Dark mode. Use confirmed fictional values and no ambiguous legacy entry. |
| 3 | Timeline | Multiple months and categories | A protocol start, confirmed change, weight entry, and journal entry across three months | Dark mode. Do not imply medical causation. |
| 4 | Health/Labs | Two panels with a useful same-unit trend | Fictional CBC/metabolic values, fictional provider `Example Health Lab`, no imported filename | Dark mode. Avoid alarming or diagnostic claims. |
| 5 | AI Health Analyst | Consent already granted in the disposable review account; one grounded answer visible | Neutral question about recorded changes; evidence links and limitations visible | Dark mode. The answer must use only fictional review data. |
| 6 | Doctor Report | Deterministic report populated and ready to print | Fictional current protocols, labs, journal signals, and limitations | Capture app preview and separately QA the white PDF output. Do not show browser print chrome in store media. |

Suggested caption themes: `See today at a glance`, `Keep protocols organized`, `Build a longitudinal history`, `Follow recorded lab trends`, `Ask with evidence attached`, and `Bring a clear record to appointments`. Avoid claims that the app diagnoses, treats, prevents, optimizes, or guarantees health outcomes.

## Screenshot sanitization gate

Before export, a second person must verify:

- [ ] The signed-in identity is Morgan Lee or another approved fictional persona.
- [ ] No Rafael name, email, ID, notes, provider, filename, or health history appears.
- [ ] No production Supabase project is open in the capture build.
- [ ] Every date and value belongs to the documented fixture.
- [ ] Status bar, notifications, keyboard suggestions, and browser history reveal no personal data.
- [ ] Export has exact accepted dimensions and no alpha channel.
- [ ] Claims match current product behavior and remain non-medical.
