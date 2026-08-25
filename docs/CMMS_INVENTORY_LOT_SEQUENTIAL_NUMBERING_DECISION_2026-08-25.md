# CMMS — Inventory LOT Sequential Numbering Decision

**Date:** 2026-08-25  
**Status:** APPROVED / IMPLEMENTED FOR FUTURE LOTS ONLY

## Decision

New inventory LOT codes use a LOT-specific, per-year sequential counter:

```text
LOT-2026-00001
LOT-2026-00002
LOT-2026-00003
```

The sequence restarts for a new calendar year, for example `LOT-2027-00001`.

## Boundaries

- Applies to **new LOTs only**.
- No historical LOT renumbering or backfill.
- Existing `trackingToken` / QR identity remains independent and UUID-based.
- Manual LOT lookup by `lotCode` remains supported.
- `inventory_lot_number_counter` is dedicated to LOT numbering only.
- This does **not** implement or reopen Centralized Document Numbering.
- `receipt_number_counter` remains deferred/not introduced.
- Counter increment occurs inside the same DB transaction as LOT creation to protect concurrent creation.

## Live DB verification / change control

Before implementation, Live DB was checked manually. `inventory_lots.lotCode` is unique, no existing LOT matched `^LOT-[0-9]{4}-[0-9]{5}$`, and the dedicated counter table was then created manually with user approval. The project schema/migration was updated afterward to reflect that accepted Live DB state.
