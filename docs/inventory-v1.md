# MPP-006: independent inventory

Inventory lives at `/protocol/inventory`, linked from Today (`/protocol`). Users download the Excel template, fill it outside the app, upload it, review every row, and explicitly confirm valid new rows. Manual entry uses the same review and confirmation path. V1 supports viewing and confirmed deletion; editing and inventory-to-protocol linking remain follow-ups.

## Source of truth

`inventory_items` records owned containers and their strength, dates, lot, preparation status, and notes. It does not reference a protocol or compound. Existing compounds require a protocol and contain dosing/preparation setup, so reusing them would incorrectly create treatment identity for stock that is not in use.

`compounds.vials_in_stock` remains the existing protocol-specific scalar. This migration does not backfill it, reinterpret it, or add it to inventory totals. Neither data source updates the other. Vial strength uses mg, mcg, or medication IU; it never means syringe markings, injection volume, BAC water volume, or an administered dose.

## Template and validation

`public/templates/mypepprotocol-inventory.xlsx` contains one `Inventory` sheet, instructions, one stable header row, and one `EXAMPLE` row that is always excluded. Form, strength unit, and reconstitution status have dropdowns. The workbook contains no formulas, macros, personal data, or activation fields.

The values-only OOXML reader uses `fflate` and `fast-xml-parser`. Only `.xlsx` files up to 2,000,000 bytes and 500 item rows are accepted. Expansion is bounded to 100 ZIP entries, 4 MB per entry, and 10 MB total. Macro/binary content, external workbook links, XML entities/DOCTYPE, and formula cells are rejected; formulas are never evaluated. Date cells accept ISO text or Excel date serials. Required fields, enums, strength/unit pairing, positive whole quantities, dates, and reconstitution consistency are checked before a preview is offered.

Rows with warnings may be imported after review. Invalid and duplicate rows are excluded. Duplicate detection compares **every normalized saved field**, including quantity, notes, dates, lot, units, and case. Leading/trailing whitespace is removed; omitted form/status become `other`/`unknown`. Numerically equivalent strengths match. Matching names alone are never merged. The database rechecks exact duplicates at confirmation to handle another tab or a concurrent import.

## Database and privacy

Apply `supabase/migrations/202609210001_inventory.sql` through the normal deployment process before enabling the UI. It creates `inventory_items`, `inventory_imports`, owner RLS, constraints, an identity trigger, and `import_inventory_v1`. The migration can be rerun; it performs no historical backfill or writes to existing tables.

Clients can read/delete their inventory through RLS, but cannot insert/update tables directly. The narrowly scoped security-definer RPC requires authentication and explicit confirmation, accepts only inventory fields, supplies ownership from `auth.uid()`, validates constraints, and commits atomically. There is no protocol creation, activation, schedule, dose, phase, or event call.

Each preview gets a request UUID that is retained for retries. `inventory_imports` stores the owner, UUID, payload fingerprint, timestamp, and result counts, not the payload or workbook. Replaying the same confirmed request returns its prior result; reusing the UUID for different rows fails. Even a retry after deleting an imported item does not recreate it. Uploaded workbook bytes remain in browser memory and are not uploaded or stored; only confirmed valid normalized item fields reach Supabase.

## Validation and rollout

- `node --test tests/inventory.test.mjs tests/inventory-sql.test.mjs`
- The SQL test uses `DOSING_PGLITE_PATH` pointing to PGlite's `dist/index.js`, or the existing ignored `.mpp007-test` runtime. Without a runtime it explicitly skips; CI should supply one. It verifies migration reruns, ownership, constraints, atomic rollback, duplicate requests, deletion/retries, and unchanged protocol-related tables.
- Run TypeScript, production build, and lint comparison against HEAD before committing.
- Before production: apply the migration in a test Supabase environment, complete a real Excel save/upload round trip, and verify authenticated preview/import/retry/delete on desktop and mobile. Check two-account isolation and download availability after deployment. This implementation does not apply production migrations.
