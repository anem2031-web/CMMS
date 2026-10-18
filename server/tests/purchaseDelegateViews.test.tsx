import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { canRoleAccessPurchaseSupplyTracking } from "../../shared/roles";
import ar from "../../client/src/i18n/ar";
import en from "../../client/src/i18n/en";
import ur from "../../client/src/i18n/ur";

const source = readFileSync("client/src/pages/purchase/PurchaseOrders.tsx", "utf8");
const ast = ts.createSourceFile("PurchaseOrders.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let tabs = "", view = "", itemClick = "", buttonClick = "", badge = "";
function find(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "view") view = node.initializer!.getText(ast);
  if (ts.isJsxElement(node)) {
    const text = node.getText(ast);
    if (node.openingElement.getText(ast).includes('className="flex gap-2 flex-wrap"') && text.includes("actionableTab")) tabs = text;
    if (node.openingElement.tagName.getText(ast) === "Card" && node.openingElement.getText(ast).includes("delegate-action-item:")) {
      const getClick = (element: ts.JsxOpeningElement) => {
        const attr = element.attributes.properties.find(p => ts.isJsxAttribute(p) && p.name.getText(ast) === "onClick") as ts.JsxAttribute;
        return (attr.initializer as ts.JsxExpression).expression!.getText(ast);
      };
      itemClick = getClick(node.openingElement);
      for (const child of node.children) {
        const childWalk = (n: ts.Node) => {
          if (ts.isJsxElement(n) && n.openingElement.tagName.getText(ast) === "Button") buttonClick = getClick(n.openingElement);
          if (ts.isJsxElement(n) && n.openingElement.tagName.getText(ast) === "Badge") badge = n.getText(ast);
          ts.forEachChild(n, childWalk);
        };
        childWalk(child);
      }
    }
  }
  ts.forEachChild(node, find);
}
find(ast);
function evaluate(code: string, context: any) {
  return vm.runInNewContext(ts.transpileModule(`(${code})`, { compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022 } }).outputText, { React, ...context });
}
const Button = ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>;
function renderTabs(role: string, translation: typeof ar | typeof en | typeof ur = ar) {
  if (!tabs || !view || !itemClick || !buttonClick || !badge) throw new Error("Actual page UI was not found");
  return renderToStaticMarkup(evaluate(tabs, {
    Button, History: () => null, Truck: () => null, user: { role }, t: translation, view: "items", setView: () => {},
    isDelegatePricingActionRole: role === "delegate", canAccessMyItemsTracking: !["maintenance_manager", "general_maintenance_manager", "construction_procurement_manager"].includes(role),
    canAccessSupplyTracking: canRoleAccessPurchaseSupplyTracking(role), actionableDisplayCount: 0, delegateActionableItemsCount: 2, myRequestedItemsCount: 0, supplyTrackingCount: 3,
  }));
}
describe("Delegate tabs from the actual purchase page", () => {
  it.each([ar, en, ur])("shows only the two agreed tabs in each language", translation => {
    const html = renderTabs("delegate", translation);
    expect((html.match(/<button/g) || []).length).toBe(2);
    expect(html).toContain(translation.workflow.purchase.delegateItemsTab);
    expect(html).toContain(translation.workflow.purchase.myItemsFollowupTab);
    expect(html).not.toContain(translation.workflow.purchase.supplyTrackingTab);
    expect(html).not.toContain(translation.workflow.purchase.actionableTab);
    expect(html).not.toContain(translation.workflow.purchase.allOrdersTab);
  });
  it.each(["actionable", "tracking", "all", "items", "supply"])("normalizes the saved delegate view %s to an allowed tab", selectedView => {
    expect(evaluate(view, { user: { role: "delegate" }, selectedView })).toBe(selectedView === "supply" ? "supply" : "items");
  });
  it.each(["owner", "admin", "warehouse", "maintenance_manager", "general_maintenance_manager", "construction_procurement_manager", "purchase_requester"])("preserves the existing views and tab names for %s", role => {
    expect(evaluate(view, { user: { role }, selectedView: "actionable" })).toBe("actionable");
    const html = renderTabs(role);
    expect(html).toContain(ar.workflow.purchase.actionableTab);
    expect(html).toContain(ar.workflow.purchase.allOrdersTab);
    expect(html).not.toContain(ar.workflow.purchase.delegateItemsTab);
    if (canRoleAccessPurchaseSupplyTracking(role)) expect(html).toContain(ar.workflow.purchase.supplyTrackingTab);
  });
});
describe("Existing item navigation and purchase action", () => {
  it.each(["estimate", "purchase"])("retains item-level navigation for %s from card and button", actionMode => {
    const setLocation = vi.fn(), item = { id: 17, purchaseOrderId: 25, actionMode };
    evaluate(itemClick, { item, setLocation })();
    const stopPropagation = vi.fn();
    evaluate(buttonClick, { item, setLocation })({ stopPropagation });
    expect(stopPropagation).toHaveBeenCalledOnce();
    expect(setLocation.mock.calls).toEqual([[`/purchase-orders/25?action=${actionMode}&itemId=17`], [`/purchase-orders/25?action=${actionMode}&itemId=17`]]);
  });
  it.each([ar, en, ur])("uses the same purchase label before and during partial purchase", translation => {
    for (const purchaseOrderStatus of ["approved", "partial_purchase"]) {
      const html = renderToStaticMarkup(evaluate(badge, { Badge: ({ children }: any) => <span>{children}</span>, t: translation, item: { actionMode: "purchase", purchaseOrderStatus } }));
      expect(html).toContain(translation.workflow.purchase.delegateNeedsPurchase);
    }
    expect(translation.workflow.purchase.delegateContinuePurchase).toBe(translation.workflow.purchase.delegateNeedsPurchase);
  });
});
