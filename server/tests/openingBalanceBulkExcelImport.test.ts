import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Bulk opening balance Excel import/export", () => {
  it("keeps the business template intentionally small and warehouse-scoped outside Excel", () => {
    const service = read("server/services/inventory/openingBalanceBulkExcel.service.ts");
    expect(service).toContain('header: "كود الصنف"');
    expect(service).toContain('header: "الكمية الافتتاحية"');
    expect(service).toContain('header: "تكلفة الوحدة"');
    expect(service).toContain('header: "تاريخ الانتهاء"');
    expect(service).not.toContain('header: "كود المستودع"');
    expect(service).not.toContain('header: "اسم المستودع"');
    expect(service).not.toContain('header: "ملاحظات"');
  });

  it("validates all rows before commit and commits the staging import atomically", () => {
    const service = read("server/services/inventory/openingBalanceBulkExcel.service.ts");
    expect(service).toContain("db.transaction");
    expect(service).toContain("if (!preview.valid)");
    expect(service).toContain("تعذر اعتماد الاستيراد");
    expect(service).toContain('quantity: 0');
    expect(service).toContain('totalCostValue: "0.00"');
    expect(service).toContain("بانتظار تطبيق التسوية وإنشاء LOT وQR");
  });

  it("does not post inventory or create LOTs during Excel import itself", () => {
    const service = read("server/services/inventory/openingBalanceBulkExcel.service.ts");
    expect(service).not.toContain("createOpeningBalanceInventoryLot");
    expect(service).not.toContain("inventoryTransactions");
    expect(service).not.toContain("applySettlement(");
  });

  it("exposes template, preview, commit and export endpoints on the existing inventory count router", () => {
    const router = read("server/routers/inventory/inventoryCount.router.ts");
    expect(router).toContain("openingBalanceTemplate");
    expect(router).toContain("openingBalanceImportPreview");
    expect(router).toContain("openingBalanceImportCommit");
    expect(router).toContain("openingBalanceExport");
  });

  it("keeps the existing opening-balance settlement gate as the only posting gate", () => {
    const db = read("server/_core/db/invoice-drafts.ts");
    expect(db).toContain("createOpeningBalanceInventoryLot");
    expect(db).toContain("الرصيد الافتتاحي يتطلب عملية جرد مصدر");
    expect(db).toContain("يجب إنهاء عملية الجرد وحفظها نهائياً قبل تطبيق التسوية");
  });
});
