import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import ar from "../../client/src/i18n/ar";
import en from "../../client/src/i18n/en";
import ur from "../../client/src/i18n/ur";
import { comparePurchaseRequiredDates, remainingPurchaseCalendarDays } from "../../shared/purchaseItemNeedDate";
import { formatDateOnly, formatAvailableDuration, formatRemainingPurchaseDuration } from "../../client/src/lib/purchaseItemTiming";

const ui = vi.hoisted(() => ({ language: "ar" }));
const translations = { ar, en, ur };
vi.mock("../../client/src/contexts/LanguageContext", () => ({ useTranslation: () => ({
  t: translations[ui.language as keyof typeof translations], language: ui.language,
}) }));
import { PurchaseItemNeedFields } from "../../client/src/components/purchase/PurchaseItemNeedFields";

function evaluate(text: string, context: any) {
  return vm.runInNewContext(ts.transpileModule(`(${text})`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText, { React, ...context });
}
const formSource = readFileSync("client/src/pages/purchase/CreatePurchaseOrder.tsx", "utf8");
const formAst = ts.createSourceFile("Create.tsx", formSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let sourceSelect = "", catalogClick = "";
function findForm(node: ts.Node) {
  if (ts.isJsxElement(node)) {
    if (node.openingElement.tagName.getText(formAst) === "select" && node.openingElement.getText(formAst).includes("item.sourceType")) sourceSelect = node.getText(formAst);
    if (node.openingElement.tagName.getText(formAst) === "Button" && node.getText(formAst).includes("t.workflow.purchase.fromCatalog")) {
      const attr = node.openingElement.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(formAst) === "onClick") as ts.JsxAttribute;
      catalogClick = (attr.initializer as ts.JsxExpression).expression!.getText(formAst);
    }
  }
  ts.forEachChild(node, findForm);
}
findForm(formAst);

const pageSource = readFileSync("client/src/pages/purchase/PurchaseOrders.tsx", "utf8");
const pageAst = ts.createSourceFile("Orders.tsx", pageSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let card = "", filtered = "";
function findPage(node: ts.Node) {
  if (ts.isJsxElement(node) && node.openingElement.tagName.getText(pageAst) === "Card" && node.openingElement.getText(pageAst).includes("delegate-action-item:")) card = node.getText(pageAst);
  if (ts.isVariableDeclaration(node) && node.name.getText(pageAst) === "filteredDelegateActionableItems") {
    filtered = (node.initializer as ts.CallExpression).arguments[0].getText(pageAst);
  }
  ts.forEachChild(node, findPage);
}
findPage(pageAst);
const frame = ({ children }: any) => <div>{children}</div>;
const fixedNow = new Date("2026-10-15T12:00:00Z");
const fixture = { id: 2, purchaseOrderId: 7, purchaseOrderNumber: "PR-7", itemName: "Material", quantity: 3, unit: "حبة", actionMode: "purchase", requiredDate: "2026-10-18", requestedByName: "Test creator" };

describe("Actual item deadline controls", () => {
  it.each(["ar", "en", "ur"])("shows an editable duration and editable fixed date in %s", language => {
    ui.language = language;
    const t = translations[language as keyof typeof translations];
    const html = renderToStaticMarkup(<PurchaseItemNeedFields index={0} deliveryLeadDays={3} requiredDate="2026-10-18" onChange={() => {}} now={fixedNow} />);
    expect(html).toContain(t.purchaseOrders.deliveryLeadDays);
    expect(html).toContain('value="2026-10-18"');
    expect(html).not.toContain('readonly=""');
    expect(html).toContain(t.purchaseOrders.requiredDateSubmissionHint);
    expect(html).not.toContain('value="2026-10-19"');
  });
  it("passes explicit zero, whole days, and an empty value without silently replacing them", () => {
    const onChange = vi.fn();
    const tree = PurchaseItemNeedFields({ index: 0, deliveryLeadDays: 3, requiredDate: "2026-10-18", onChange, now: fixedNow });
    const inputs: React.ReactElement<any>[] = [];
    const walk = (node: React.ReactNode) => React.Children.forEach(node, child => {
      if (!React.isValidElement<any>(child)) return;
      const element = child as React.ReactElement<any>;
      if (["number", "date"].includes(element.props.type)) inputs.push(element);
      if (element.props.children) walk(element.props.children);
    });
    walk(tree);
    for (const value of ["0", "5", ""]) inputs[0].props.onChange({ target: { value } });
    expect(onChange.mock.calls).toEqual([
      [{ deliveryLeadDays: 0, requiredDate: "2026-10-15" }],
      [{ deliveryLeadDays: 5, requiredDate: "2026-10-20" }],
      [{ deliveryLeadDays: null, requiredDate: "" }],
    ]);
    inputs[1].props.onChange({ target: { value: "2026-10-21" } });
    expect(onChange).toHaveBeenLastCalledWith({ deliveryLeadDays: 6, requiredDate: "2026-10-21" });
    inputs[1].props.onChange({ target: { value: "" } });
    expect(onChange).toHaveBeenLastCalledWith({ deliveryLeadDays: null, requiredDate: "" });
  });
  it("keeps the saved historical date visible until a duration is entered", () => {
    ui.language = "ar";
    const html = renderToStaticMarkup(<PurchaseItemNeedFields index={0} deliveryLeadDays={null} requiredDate="2026-01-02" onChange={() => {}} now={fixedNow} />);
    expect(html).toContain('value="2026-01-02"');
    expect(html).toContain(ar.purchaseOrders.requiredDateSubmissionHint);
  });
  it("shows validation at the duration field and never displays an invalid preview", () => {
    const html = renderToStaticMarkup(<PurchaseItemNeedFields index={0} deliveryLeadDays={-2} requiredDate="" error="Invalid lead time" onChange={() => {}} now={fixedNow} />);
    expect(html).toContain('aria-invalid="true"'); expect(html).toContain("Invalid lead time");
    expect(html).not.toContain("2026-");
  });
});

describe("New catalog-only choice, with historical manual items preserved", () => {
  it.each([ar, en, ur])("hides New item and keeps Catalog available", t => {
    expect(sourceSelect).not.toBe("");
    const html = renderToStaticMarkup(evaluate(sourceSelect, { t, item: { sourceType: "catalog" }, isMaterialBoundItem: false }));
    expect(html).not.toContain(t.purchaseOrders.itemSourceManual);
    expect(html).toContain(t.purchaseOrders.itemSourceCatalog);
    expect((html.match(/<option/g) || []).length).toBe(1);
    expect(formSource).not.toContain("t.workflow.purchase.newItem");
  });
  it("keeps an old manual item visible and retains the actual catalog button action", () => {
    const html = renderToStaticMarkup(evaluate(sourceSelect, { t: ar, item: { sourceType: "manual", _existingId: 3 }, isMaterialBoundItem: false }));
    expect(html).toContain(ar.purchaseOrders.legacyManualItem);
    const setCatalogTargetIndex = vi.fn(), setShowCatalogPicker = vi.fn();
    evaluate(catalogClick, { idx: 4, setCatalogTargetIndex, setShowCatalogPicker })();
    expect(setCatalogTargetIndex).toHaveBeenCalledWith(4);
    expect(setShowCatalogPicker).toHaveBeenCalledWith(true);
  });
});

describe("Actual delegate card and filters", () => {
  it.each(["ar", "en", "ur"])("shows need date, remaining days and creator on the actual card in %s", language => {
    const t = translations[language as keyof typeof translations];
    const html = renderToStaticMarkup(evaluate(card, {
      Card: frame, CardContent: frame, Badge: frame, Button: frame, t, language, item: fixture,
      getLocalizedItemField: (item: any) => item.itemName, displayUnit: (value: string) => value,
      locale: "en-US", remainingDays: 3, availableDays: null, formatDateOnly, formatAvailableDuration, formatRemainingPurchaseDuration,
    }));
    expect(html).toContain(t.purchaseOrders.requiredDate);
    expect(html).toContain(t.purchaseOrders.remainingDuration);
    expect(html).toContain(formatRemainingPurchaseDuration(3, language));
    expect(html).toContain(t.common.createdBy); expect(html).toContain("Test creator");
  });
  it.each([0, -2])("shows today's or overdue status: %s", remainingDays => {
    const html = renderToStaticMarkup(evaluate(card, {
      Card: frame, CardContent: frame, Badge: frame, Button: frame, t: ar, language: "ar", item: fixture,
      getLocalizedItemField: (item: any) => item.itemName, displayUnit: (value: string) => value,
      locale: "en-US", remainingDays, availableDays: null, formatDateOnly, formatAvailableDuration, formatRemainingPurchaseDuration,
    }));
    expect(html).toContain(formatRemainingPurchaseDuration(remainingDays, "ar"));
  });
  it("sorts by the closest required date, retains all items and keeps action/search filters working", () => {
    const items = [fixture, { ...fixture, id: 1, requiredDate: "2026-10-14", actionMode: "estimate", requestedByName: "Earlier creator" }, { ...fixture, id: 3, requiredDate: null }];
    const context = {
      delegateActionableItems: items, delegateItemsSearch: "", delegateActionFilter: "all", delegateDateFilter: "all",
      delegateDateFrom: "", delegateDateTo: "", language: "en", getLocalizedItemField: (item: any) => item.itemName,
      comparePurchaseRequiredDates,
    };
    expect(evaluate(filtered, context)().map((item: any) => item.id)).toEqual([1, 2, 3]);
    expect(evaluate(filtered, { ...context, delegateActionFilter: "purchase" })().map((item: any) => item.id)).toEqual([2, 3]);
    expect(evaluate(filtered, { ...context, delegateItemsSearch: "earlier creator" })().map((item: any) => item.id)).toEqual([1]);
    expect(remainingPurchaseCalendarDays(fixture.requiredDate, fixedNow)).toBe(3);
  });
});
