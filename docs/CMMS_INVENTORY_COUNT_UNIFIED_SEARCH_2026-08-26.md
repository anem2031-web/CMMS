# CMMS — Unified Inventory Count Search

Date: 2026-08-26

## Approved scope

Unify item lookup in inventory count screens without changing inventory posting, settlement, valuation, historical data, or Lot creation rules.

### Periodic count with Lots

QR remains the primary counting method. A secondary search is available by:

- Catalog item code
- Arabic item name
- English item name
- Manufacturer barcode
- Printed Lot number (`LOT-YYYY-NNNNN`)
- Lot QR tracking token
- Catalog tree node + descendants

Search candidates are restricted to the immutable opening snapshot of the active count. Selecting a search result resolves the known Lot and opens the existing quantity-count dialog; it does not create a new Lot or read a post-opening Lot into the count.

### Opening balance

Catalog selection supports:

- Catalog item code
- Arabic item name
- English item name
- Manufacturer barcode when a barcode is known from linked Inventory history or a resolved Catalog Item Candidate
- Catalog tree node + descendants

A Lot number is not searchable before posting an opening balance because the Opening Balance Lot/QR does not exist until the existing settlement is applied.

## Change-control notes

- No schema change.
- No SQL required.
- No historical backfill or renumbering.
- No inventory quantity/value write added by search.
- Existing opening-balance Excel import/export behavior remains unchanged.
- Existing periodic-count QR path remains unchanged and primary.
