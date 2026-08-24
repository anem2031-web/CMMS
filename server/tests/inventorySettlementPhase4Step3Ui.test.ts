import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Main Phase 4 / Step 3 — minimum settlement UI and financial detail exposure", () => {
  it("shows Count Snapshot cost and adjustment value without exposing editable Snapshot cost", () => {
    const ui = read("client/src/pages/inventory/InventoryOperations.tsx");

    expect(ui).toContain("متوسط التكلفة المثبت عند فتح الجرد (Opening Snapshot)");
    expect(ui).toContain("لا يمكن تعديل تكلفة الـSnapshot من شاشة التسوية");
    expect(ui).toContain("d.averageCostSnapshot");
    expect(ui).toContain("d.diffValue");
    expect(ui).toContain("تكلفة Snapshot");
    expect(ui).not.toContain("value={d.averageCostSnapshot}");
  });

  it("keeps Manual valuation informational and does not add operator-entered cost", () => {
    const ui = read("client/src/pages/inventory/InventoryOperations.tsx");
    const router = read("server/routers/inventory/inventoryCount.router.ts");

    expect(ui).toContain("التسوية اليدوية المدعومة تستخدم متوسط التكلفة الحالي وقت الترحيل");
    expect(ui).toContain("ويعيد الـBackend قراءة القيمة الحالية عند التطبيق");
    expect(ui).toContain("قيمة تقديرية");
    expect(router).not.toContain("unitCostUsed: z.");
    expect(router).not.toContain("adjustmentValue: z.");
  });

  it("exposes the optional manual reference with the same 255-character boundary", () => {
    const ui = read("client/src/pages/inventory/InventoryOperations.tsx");

    expect(ui).toContain("const [settlementReference, setSettlementReference]");
    expect(ui).toContain("maxLength={255}");
    expect(ui).toContain("reference: !settlementSourceCountId ? settlementReference.trim() || undefined : undefined");
    expect(ui).toContain("المرجع:");
  });

  it("returns persisted valuation fields in Settlement details for audit/printing", () => {
    const db = read("server/_core/db/invoice-drafts.ts");

    expect(db).toContain("unitCostUsed: inventorySettlementItems.unitCostUsed");
    expect(db).toContain("adjustmentValue: inventorySettlementItems.adjustmentValue");
    expect(db).toContain("sourceCountType");
  });

  it("prints persisted unit cost, adjustment value, reference, and valuation basis", () => {
    const printer = read("client/src/lib/printInventoryOperationDocuments.ts");

    expect(printer).toContain("it.unitCostUsed");
    expect(printer).toContain("it.adjustmentValue");
    expect(printer).toContain("تكلفة الوحدة المستخدمة");
    expect(printer).toContain("قيمة التسوية");
    expect(printer).toContain("أساس التقييم");
    expect(printer).toContain("s.reference");
    expect(printer).toContain("متوسط التكلفة المثبت عند فتح الجرد (Opening Snapshot)");
  });
});
