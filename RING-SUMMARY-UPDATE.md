# Home ring selector update

- Rings now select one compact summary, showing the full name, existing dose/frequency/route display, active status and week.
- Removed the duplicate full protocol list.
- Selecting a ring neither scrolls nor opens the details disclosure.
- View details explicitly opens the existing disclosure below, without programmatic scrolling.
- Manually opening/closing the disclosure still works. If it is already open, selecting another ring updates its existing contents without forcing it closed.
- All compounds remain selectable: removed the previous nine-ring limit, since the rows no longer provide a secondary selection path.
- Ring accessible labels now say Select protocol; the selected summary is a polite live region.

Changed files: app/protocol/page.tsx (selection/open handlers only), components/today/ActiveProtocolList.tsx, components/today/TodayOverview.tsx, components/dashboard/CompoundRings.tsx, app/mobile-app.css, tests/today.test.mjs, and this report.

Validation: 62 tests passed; standalone TypeScript and production build passed. Focused lint passed for the changed Today components and tests. Existing legacy lint errors in the dashboard page and CompoundRings remain outside this focused UI update.

No database, dosing, phase, authentication or historical-data changes. No migration.

Mobile lag has not been reproduced or measured. No performance fix or real-device visual verification is claimed.
