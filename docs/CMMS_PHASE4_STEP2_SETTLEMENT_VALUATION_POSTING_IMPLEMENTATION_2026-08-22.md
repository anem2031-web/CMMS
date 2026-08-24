# CMMS — Main Phase 4 / Step 2 — Settlement Valuation & Posting Logic — Implementation

**Date:** 2026-08-22  
**Status:** ✅ **IMPLEMENTED / TARGETED CHECKS PASSED / RUNTIME VALIDATED IN STEP 3**  
**Scope:** 4.2.1 + 4.2.2 + 4.2.3 داخل Step 2 فقط. لا تعتبر هذه الوثيقة إغلاقًا لـMain Phase 4.

---

## 1) نقطة البداية ومصادر الحقيقة

- Live DB هي مصدر الحقيقة لهيكل وحالة البيانات.
- أحدث Full Project هو مصدر الحقيقة للكود.
- عند بداية Step 2 كانت Live DB تحتوي أصلًا:
  - `inventory_settlement_items.unitCostUsed DECIMAL(12,4) NULL`
  - `inventory_settlement_items.adjustmentValue DECIMAL(14,2) NULL`
  - `inventory_settlements.reference VARCHAR(255) NULL`
- لم يُعاد تشغيل ALTER ولم تُجرَ Migration أو DB cleanup ضمن Step 2.
- Main Phase 3 بقيت baseline مغلقة لا يجوز كسر frozen-diff / current-balance / Lot-freeze behavior فيها.

---

## 2) 4.2.1 — Schema + Settlement Inputs

تم تنفيذ التالي:

- مزامنة `drizzle/schema.ts` مع الأعمدة الثلاثة الموجودة مسبقًا في Live DB.
- إبقاء الحقول Nullable لحماية السجلات القديمة وعدم فرض Historical Backfill.
- إضافة `reference` اختياريًا إلى مدخل API بحد أقصى 255 حرفًا.
- حفظ `reference` في Settlement Header عند توفيره، و`NULL` عند غيابه.
- لم يُضف UI جديد للـreference في هذه الخطوة.

---

## 3) 4.2.2 — Valuation + Financial Posting

### Count Settlement — Surplus / Shortage

مصدر التكلفة المعتمد:

```text
unitCostUsed = inventory_count_snapshots.averageCostSnapshot
```

المطابقة تكون حسب:

```text
operationId + inventoryId + lotId
```

وفي المسار non-Lot تكون `lotId = NULL`.

القيمة:

```text
adjustmentValue = diffQuantity × unitCostUsed
newTotalCostValue = currentTotalCostValue + adjustmentValue
newAverageCost = newTotalCostValue / newInventoryQuantity   (when quantity > 0)
```

عند وصول الكمية إلى صفر تم الحفاظ على convention المشروع القائم: `totalCostValue = 0` وعدم القسمة على صفر، بدون اختراع Revaluation behavior جديد.

### Manual Settlement — المسار المدعوم فقط

```text
unitCostUsed = Current inventory.averageCost at posting
adjustmentValue = diffQuantity × Current Average Cost
```

ومتوسط التكلفة يبقى كما هو لأن الكمية والقيمة تتحركان على نفس Current Average Cost.

### Audit persistence

Settlement Items الجديدة تحفظ:

- `unitCostUsed`
- `adjustmentValue`

والـInventory Transaction الناتجة عن Count تستخدم نفس `unitCostUsed` حتى لا تختلف قيمة الحركة عن قيمة Settlement.

### حدود لم تتغير

- لا operator-entered manual unit cost.
- لا Manual Lot Settlement Workflow جديد.
- لا Historical Backfill / Cleanup.
- لا Approval Workflow جديد.
- Opening Balance احتفظ بأساس التكلفة الحالي الموجود له؛ لم يُخترع له Count Snapshot غير موجود.

---

## 4) 4.2.3 — Atomicity + Regression Protection

### Transaction boundary

قبل 4.2.3 كان Periodic Lot / Opening Balance يمران داخل DB Transaction، بينما legacy non-Lot path كان ينفذ `applyWith(db)` مباشرة.

بعد 4.2.3:

```text
all supported Settlement posting paths
→ db.transaction(async (tx) => applyWith(tx))
```

وبذلك تظل آثار Posting الدائمة على نفس transaction writer، ومنها حسب المسار:

- Settlement header.
- Settlement items.
- Inventory / Lot quantity updates.
- `totalCostValue` / `averageCost`.
- Inventory transaction/audit movement.
- Opening Balance Lot creation/linking.

### Settlement number allocation

تم نقل توليد رقم التسوية داخل نفس transaction writer عبر helper داخلي بدل توليده قبل Transaction.

هذا يمنع commit مستقل لسجل counter عن Posting. **ملاحظة:** لأن الجدول الحالي يعتمد MySQL `AUTO_INCREMENT`، فقد يستهلك المحرك id عند rollback ويترك gap في التسلسل. لم يتم تغيير DB schema أو accounting/numbering workflow لمحاولة جعل الأرقام gapless.

### Count source locking/finalization

لأي `from_count`:

- يتم `FOR UPDATE` على Count Operation داخل Transaction.
- يعاد التحقق أن العملية موجودة وحالتها `completed` قبل تطبيق Settlement.
- يبقى duplicate Settlement guard داخل نفس Transaction بعد القفل.

### Phase 3 protections preserved

تم الحفاظ على:

- finalized counted quantity immutable from Settlement input.
- frozen difference consistency check.
- تطبيق الفرق فوق current Lot / Inventory balance وليس reset لكمية العد القديمة.
- جميع discrepancies المحفوظة يجب أن تطبق معًا في Periodic Lot Count.
- duplicate applied Count Settlement rejection.
- Manual Aggregate Settlement guard عند Lots Enabled.
- Receipt Lots اللاحقة تبقى مستقلة.

---

## 5) التحقق المنفذ

تمت إضافة/تحديث source-regression tests لـ:

- Schema + optional reference (4.2.1).
- Snapshot valuation / financial posting (4.2.2).
- Transaction boundary / number allocation / Count lock / preserved guards (4.2.3).

تم إجراء targeted TypeScript syntax/transpile checks للملفات المعدلة، مع source assertions على الحمايات الأساسية.

لم يتم تنفيذ Runtime DB UAT داخل Step 2 نفسها؛ تم لاحقًا ضمن Step 3 تنفيذ Runtime UAT على Live DB بنجاح، بما يشمل Count Surplus/Shortage وSnapshot valuation وAtomicity/Rollback. المرجع: `docs/CMMS_PHASE4_SETTLEMENT_FINAL_CLOSURE_2026-08-22.md`.

---

## 6) ملفات الكود الأساسية المتأثرة عبر Step 2

- `drizzle/schema.ts`
- `server/routers/inventory/inventoryCount.router.ts`
- `server/_core/db/invoice-drafts.ts`
- `server/tests/inventorySettlementPhase4Step2Inputs.test.ts`
- `server/tests/inventorySettlementPhase4Step2Valuation.test.ts`
- `server/tests/inventorySettlementPhase4Step2Atomicity.test.ts`

---

## 7) الحالة النهائية بعد Step 3 Runtime UAT

```text
Main Phase 4 — Settlement Development
✅ COMPLETE / RUNTIME UAT PASSED / OFFICIALLY CLOSED

4.1 / Step 1 — Database Foundation
✅ COMPLETE / LIVE DB VERIFIED

4.2 / Step 2 — Settlement Valuation & Posting Logic
✅ IMPLEMENTED / TARGETED CHECKS PASSED / RUNTIME VALIDATED

4.3 / Step 3 — UI + Runtime UAT + Closure
✅ COMPLETE / RUNTIME UAT PASSED / CLOSED
```

Runtime closure evidence:

- `CNT-2026-60030` / `ADJ-2026-30008` — Count Surplus + Snapshot valuation after Current Average Cost change.
- `CNT-2026-60031` / `ADJ-2026-30009` — Count Shortage.
- `CNT-2026-60032` — forced in-transaction failure with complete rollback, then successful `ADJ-2026-30011` after removal of the UAT-only failpoint.
- Manual Aggregate Settlement guard remained active with Lots Enabled.

Final closure reference: `docs/CMMS_PHASE4_SETTLEMENT_FINAL_CLOSURE_2026-08-22.md`.

> **Main Phase 4 is closed. Do not start Main Phase 5 automatically.**
