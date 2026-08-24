import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("Main Phase 5.4.3 — Reconciliation Exception Report", () => {
  it("exposes the report page through the inventory reconciliation route", () => {
    const app = read("client/src/App.tsx");
    expect(app).toContain('import InventoryReconciliation from "@/pages/inventory/InventoryReconciliation"');
    expect(app).toContain('<Route path="/inventory/reconciliation" component={InventoryReconciliation} />');
  });

  it("uses the read-only 5.4.2 query and exposes no repair mutation", () => {
    const page = read("client/src/pages/inventory/InventoryReconciliation.tsx");
    expect(page).toContain("trpc.inventoryReconciliation.run.useQuery");
    expect(page).not.toContain("useMutation");
    expect(page).not.toMatch(/\b(insert|update|delete|repair|autofix)\s*\(/i);
    expect(page).toContain("لا توجد أي إجراءات إصلاح أو تعديل بيانات");
  });

  it("provides summary, filters, refresh, and exception review columns", () => {
    const page = read("client/src/pages/inventory/InventoryReconciliation.tsx");
    expect(page).toContain("إجمالي الفحوص");
    expect(page).toContain("فحوص ناجحة");
    expect(page).toContain("الاستثناءات");
    expect(page).toContain("تحديث الفحص");
    expect(page).toContain("warehouseFilter");
    expect(page).toContain("typeFilter");
    expect(page).toContain("الحالي");
    expect(page).toContain("المتوقع");
    expect(page).toContain("الفرق");
  });



  it("provides a downloadable concise PDF guide from the report header", () => {
    const page = read("client/src/pages/inventory/InventoryReconciliation.tsx");
    expect(page).toContain("تحميل دليل تقرير مطابقة المخزون (PDF)");
    expect(page).toContain('href="/guides/inventory-reconciliation-guide-ar.pdf"');
    expect(page).toContain('download="inventory-reconciliation-guide-ar.pdf"');
    expect(fs.existsSync(path.join(root, "client/public/guides/inventory-reconciliation-guide-ar.pdf"))).toBe(true);
  });

  it("adds a warehouse-facing navigation entry", () => {
    const layout = read("client/src/components/layout/DashboardLayout.tsx");
    expect(layout).toContain('labelKey: "nav.inventoryReconciliation"');
    expect(layout).toContain('path: "/inventory/reconciliation"');
  });
});
