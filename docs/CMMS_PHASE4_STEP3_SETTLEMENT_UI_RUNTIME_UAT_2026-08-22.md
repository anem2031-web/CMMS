# CMMS — Main Phase 4 / Step 3 — Settlement UI + Runtime UAT + Closure

**Date:** 2026-08-22  
**Final status:** ✅ **COMPLETE / RUNTIME UAT PASSED / CLOSED**  
**Main Phase 4:** ✅ **COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED**

---

## 1) Minimum UI implemented

### Count Settlement preview

- تعرض `averageCostSnapshot` كتكلـفة التقييم للجرد الدوري.
- تعرض قيمة فرق التسوية قبل Posting.
- توضح أن Count Settlement تعتمد **Opening Snapshot Average Cost** وليس Current Average Cost.
- Snapshot Cost غير قابلة للتعديل.
- لا تغيير على قاعدة Phase 3: Settlement تطبق frozen diff فوق Current Lot/Inventory balance ولا تعيد الرصيد إلى Counted Quantity قديمة.

### Manual Settlement preview — only when existing workflow permits it

- تعرض Current Quantity / Current Average Cost / estimated adjustment value.
- الـBackend يعيد قراءة Current Average Cost وقت Posting.
- لا يوجد Manual Unit Cost input.
- Manual Aggregate Settlement يبقى محجوبًا عند Lots Enabled.

### Reference / details / print

- `reference` اختياري في Manual Settlement بحد 255 حرفًا.
- Count linkage تبقى عبر `sourceCountOperationId` دون تكرار غير ضروري.
- Settlement detail/print تعرض `unitCostUsed` و`adjustmentValue` والمرجع عند وجوده وأساس التقييم.
- السجلات التاريخية التي حقول Phase 4 فيها `NULL` تبقى بدون Backfill.

---

## 2) Targeted verification before Runtime UAT

PASS for targeted TypeScript syntax/transpile and source assertions covering:

- Snapshot cost/value in Count preview.
- Snapshot cost non-editable.
- Manual preview remains Current Average Cost based and informational only.
- optional `reference` max 255.
- persisted `unitCostUsed` / `adjustmentValue` in detail/print path.
- no operator-entered financial valuation input.
- Manual Lot guard remains.
- duplicate Count Settlement guard remains.
- Step 2 DB transaction boundary remains.

Full project Vitest / full `tsc --noEmit` is not claimed from the implementation workspace because no local `node_modules` installation was available there.

---

## 3) Runtime UAT — Case A: Count Surplus (+) with Current Average Cost change

```text
Count                 CNT-2026-60030
operationId           60030
inventoryId           210174
lotId                 16
lot                    LOT-2026-C3B7086A
Opening Qty            2.000
Opening Snapshot Cost 10.0000
Counted Qty            3.000
Diff                   +1.000
Count Value            +10.00
```

A later Receipt changed the current state:

```text
RCV-2026-420142
receivedQuantity       3.000
unitCost              40.0000
current Inventory Qty 15.000
current Average Cost  16.0000
current Total Value   240.00
```

The Count screen still showed `2.000 @ 10.0000` and `+1 = +10.00`.

**PASS:** Opening Snapshot remained fixed after later receipts/cost change.

After Final Save and before Settlement:

```text
Inventory Qty 15.000
Average Cost  16.0000
Total Value   240.00
Lot 16 Qty      2.000
```

**PASS:** Final Save did not post stock/value.

Pre-settlement Issue from Lot 16 was blocked because `CNT-2026-60030` had an unsettled difference.

**PASS:** Lot freeze.

Settlement preview showed Snapshot `10.0000` and value `+10.00`, then:

```text
ADJ-2026-30008
before lot qty         2.000
diff                  +1.000
after lot qty          3.000
unitCostUsed          10.0000
adjustmentValue       +10.00
Inventory Qty         16.000
Average Cost          15.6250
Total Value           250.00
SUM Lot Balances      16.000
```

**PASS:** Count Settlement used Opening Snapshot Cost rather than Current Average Cost `16.0000`.

After Settlement, `DLV-2026-300202` succeeded from the same Count Lot. Final observed state after that delivery:

```text
Inventory Qty         15.000
Average Cost          15.6250
Total Value           234.38
Lot 16 Qty              2.000
SUM Lot Balances      15.000
```

**PASS:** unfreeze + inventory/lot invariant.

A retry of the same Count Settlement was rejected with:

> تم تطبيق تسوية لهذا الجرد مسبقاً؛ لا يمكن تطبيق فرق الجرد مرتين

**PASS:** duplicate guard.

---

## 4) Runtime UAT — Case B: Count Shortage (-)

```text
Count                 CNT-2026-60031
operationId           60031
inventoryId           210252
lotId                 17
lot                    LOT-2026-83C1CC02
Opening Qty            2.000
Opening Snapshot Cost  8.5714
Counted Qty            1.000
Diff                   -1.000
Count Value            -8.57
```

After Final Save and before Settlement:

```text
Inventory Qty 7.000
Average Cost  8.5714
Total Value   60.00
Lot 17 Qty     2.000
```

**PASS:** Final Save did not post stock/value.

Pre-settlement Issue from Lot 17 was blocked because the difference was unsettled.

**PASS:** Lot freeze.

Settlement preview showed Snapshot `8.5714`, diff `-1.000`, value `-8.57`.

Applied:

```text
ADJ-2026-30009
before lot qty        2.000
diff                 -1.000
after lot qty         1.000
unitCostUsed           8.5714
adjustmentValue       -8.57
Inventory Qty          6.000
Average Cost           8.5717
Total Value           51.43
SUM Lot Balances       6.000
```

**PASS:** negative Snapshot valuation and resulting quantity/value/average cost.

After Settlement, `DLV-2026-300203` succeeded. Final observed state:

```text
Inventory Qty          5.000
Average Cost           8.5717
Total Value           42.86
Lot 17 Qty              0.000
SUM Lot Balances       5.000
```

**PASS:** unfreeze + inventory/lot invariant.

---

## 5) Runtime UAT — Atomicity / rollback

Isolated test:

```text
Count                 CNT-2026-60032
operationId           60032
inventoryId           210200
lotId                 9
lot                    LOT-2026-DD6F05FB
Opening Qty            3.000
Counted Qty            4.000
Diff                   +1.000
Snapshot Cost          1.0000
Adjustment Value      +1.00
```

A temporary UAT-only failpoint restricted to `operationId=60032` intentionally failed inside the posting transaction before commit.

After the forced failure, Live DB verification showed:

```text
Inventory Qty                         3.000
Average Cost                          1.0000
Total Value                           3.00
Lot Qty                               3.000
SUM Lot Balances                      3.000
Settlement rows for Count             0
Settlement item rows for Count        0
Adjustment transactions after save    0
```

**PASS:** complete rollback; no partial state remained.

The failpoint was then removed, the server restarted, and the same Count was posted normally:

```text
ADJ-2026-30011
before lot qty         3.000
diff                  +1.000
after lot qty          4.000
unitCostUsed            1.0000
adjustmentValue        +1.00
Inventory Qty           4.000
Average Cost            1.0000
Total Value             4.00
Lot Qty                 4.000
SUM Lot Balances        4.000
```

**PASS:** normal posting succeeded after removal of the test-only failpoint.

---

## 6) Runtime UAT — Manual Settlement boundary

Lots are enabled in the deployed environment. The **independent/manual settlement without Count** button is visible but disabled.

**PASS:** existing Manual Aggregate Settlement guard remains.

No Manual Lot workflow was added, and no arbitrary operator-entered unit cost was introduced.

Manual Positive/Negative posting and `reference` persistence were not runtime-exercised because the approved current workflow blocks Manual Aggregate Settlement when Lots are enabled. This matches the approved conditional UAT rule and is not a closure blocker.

---

## 7) Additional UAT setup observation — not a Phase 4 blocker

During preparation, `PR-2026-0395` had two PO items with `catalogItemId=NULL` despite matching active Catalog Items. Fresh tests showed the current flow behaving correctly:

- `PR-2026-0396`: Catalog link saved on creation.
- `PR-2026-0397`: both Catalog links saved on creation.
- `RCV-2026-420140`: both receipt items inherited matching PO Catalog links.

No historical repair/backfill or Purchase workflow code change was performed.

---

## 8) Step 3 closure

Runtime requirements passed:

- Count Surplus (+) ✅
- Count Shortage (-) ✅
- Snapshot valuation after Current Average Cost change ✅
- Final Save does not post Settlement ✅
- Lot freeze before Settlement ✅
- Lot unfreeze after Settlement ✅
- duplicate Count Settlement guard ✅
- `unitCostUsed` / `adjustmentValue` persistence ✅
- quantity/value/average cost result ✅
- `inventory.quantity = SUM(inventory_lot_balances.quantity)` ✅
- Atomicity / rollback with no partial DB state ✅
- Manual Settlement guard under Lots ✅

```text
Main Phase 4 / Step 3
✅ COMPLETE / RUNTIME UAT PASSED / CLOSED

Main Phase 4 — Settlement Development
✅ COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED
```

Final closure reference: `docs/CMMS_PHASE4_SETTLEMENT_FINAL_CLOSURE_2026-08-22.md`.

**Do not start Main Phase 5 automatically.**
