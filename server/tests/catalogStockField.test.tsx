import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import ar from "../../client/src/i18n/ar";
import en from "../../client/src/i18n/en";
import ur from "../../client/src/i18n/ur";
import type { CatalogStockSummary } from "../../shared/catalog-stock";

let language = "ar";
let translation: typeof ar | typeof en | typeof ur = ar;
vi.mock("../../client/src/contexts/LanguageContext", () => ({
  useTranslation: () => ({ t: translation, language, dir: language === "en" ? "ltr" : "rtl" }),
}));
import { CatalogStockField } from "../../client/src/components/purchase/CatalogStockField";

const units = [{ id: 1, nameAr: "حبة", nameEn: "Piece", nameUr: "عدد" }];
const stock: CatalogStockSummary = {
  catalogItemId: 1, totals: [{ unit: "حبة", quantity: 30 }],
  warehouses: [
    { warehouseId: 1, nameAr: "المستودع الرئيسي", nameEn: "Main warehouse", unit: "حبة", quantity: 20 },
    { warehouseId: 2, nameAr: "مخزن الفريق", nameEn: "Team warehouse", unit: "حبة", quantity: 10 },
  ],
};
const render = (patch: Partial<React.ComponentProps<typeof CatalogStockField>> = {}) =>
  renderToStaticMarkup(<CatalogStockField stock={stock} loading={false} failed={false} canRead={true} units={units} {...patch} />);

describe("Compact stock quantity field", () => {
  it.each([["ar", ar], ["en", en], ["ur", ur]] as const)("shows the total and a native expandable warehouse list in %s", (locale, t) => {
    language = locale; translation = t;
    const html = render();
    expect(html).toContain(t.purchaseOrders.catalogStock.label);
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).not.toContain("<details open");
    expect(html).toContain(locale === "ar" ? "المستودع الرئيسي" : "Main warehouse");
    expect(html).toContain(locale === "ar" ? "مخزن الفريق" : "Team warehouse");
    expect(html).not.toContain("<input");
  });
  it.each(["loading", "failed", "missing", "denied"])("does not present zero or stale quantities for %s state", state => {
    language = "ar"; translation = ar;
    const html = render({ loading: state === "loading", failed: state === "failed", stock: state === "missing" ? undefined : stock, canRead: state !== "denied" });
    expect(html).not.toContain("<details");
    expect(html).not.toContain("المستودع الرئيسي");
    expect(html).toContain('role="status"');
  });
  it("shows a confirmed empty stock result with its recorded unit", () => {
    language = "ar"; translation = ar;
    const html = render({ stock: { catalogItemId: 1, totals: [{ unit: "حبة", quantity: 0 }], warehouses: [] } });
    expect(html).toContain(ar.purchaseOrders.catalogStock.noStock);
    expect(html).toContain("<details");
  });
  it("discloses mixed units instead of presenting a misleading summed number", () => {
    language = "ar"; translation = ar;
    const html = render({ stock: { ...stock, totals: [...stock.totals, { unit: "كرتون", quantity: 2 }] } });
    expect(html).toContain(ar.purchaseOrders.catalogStock.mixedUnits);
    expect(html).toContain("كرتون");
    expect(html).toContain(" / ");
  });
});
