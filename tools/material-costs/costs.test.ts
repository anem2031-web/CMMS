import { test } from "node:test";
import assert from "node:assert/strict";
import { materialCostEvents, summarizeMaterialCosts, groupMaterialCosts, type MaterialCostIssue } from "../../shared/material-execution-costs";
import { receiptConversionPreview, receiptInOrderUnits } from "../../shared/receipt-conversion";

function issue(patch: Partial<MaterialCostIssue> = {}): MaterialCostIssue {
  return { id: 1, transactionId: 10, deliveryId: 20, deliveryNumber: "DLV-1", source: "ticket_named", sourceId: 4, sourceItemId: 40,
    sourceNumber: "MT-1", siteId: 1, siteName: "موقع", sectionId: 2, sectionName: "قسم", assetId: 3, assetName: "أصل",
    itemName: "لمبة", unit: "حبة", lotCode: "LOT-1", quantity: "3.000", lotUnitCost: "15.0000", allocatedValue: "45.00",
    financialValue: "36.00", createdAt: "2026-10-15 10:00:00", receiverName: "فني", returns: [], ...patch };
}
test("cartons convert at receiving; stock and unit cost retain the invoice base value", () => {
  assert.deepEqual(receiptConversionPreview(2, 300, 20), { stockQuantity: 40, issueUnitCost: 15 });
  assert.deepEqual(receiptConversionPreview(3, 300, 1), { stockQuantity: 3, issueUnitCost: 300 });
  assert.deepEqual(receiptConversionPreview(1, 300, 5), { stockQuantity: 5, issueUnitCost: 60 });
});
test("order by piece, actual receipt by carton: PO quantities/prices remain expressed in the original piece unit", () => {
  assert.deepEqual(receiptInOrderUnits({ orderUnit: "حبة", receivedUnit: "كرتون", issueUnit: "حبة", quantity: 2, unitCost: 300, factor: 20 }), { quantity: 40, unitCost: 15 });
  assert.deepEqual(receiptInOrderUnits({ orderUnit: "كرتون", receivedUnit: "كرتون", issueUnit: "حبة", quantity: 2, unitCost: 300, factor: 20 }), { quantity: 2, unitCost: 300 });
  assert.equal(receiptInOrderUnits({ orderUnit: "باكت", receivedUnit: "كرتون", issueUnit: "حبة", quantity: 2, unitCost: 300, factor: 20 }), null);
});
for (const factor of [0, -1, NaN, Infinity]) test(`invalid conversion ${factor} cannot produce stock`, () => {
  assert.equal(receiptConversionPreview(2, 300, factor), null);
});
test("fractional receipt and zero-priced documented material are supported", () => {
  assert.deepEqual(receiptConversionPreview(0.5, 100, 10), { stockQuantity: 5, issueUnitCost: 10 });
  assert.deepEqual(receiptConversionPreview(1, 0, 10), { stockQuantity: 10, issueUnitCost: 0 });
  assert.equal(receiptConversionPreview(0.001, 1, 0.001), null);
});
test("lot cost differs explicitly from inventory average, with return at original lot snapshot", () => {
  const events = materialCostEvents([issue({ returns: [{ id: 1, number: "RTN-1", quantity: 1, financialValue: "12.00", createdAt: "2026-10-16 10:00:00" }] })]);
  assert.deepEqual(summarizeMaterialCosts(events), { issued: 45, returned: 15, net: 30, financialNet: 24, difference: 6, incomplete: 0, events: 2 });
});
test("two lots of the same catalog item keep separate prices, never current catalog or PO values", () => {
  const events = materialCostEvents([issue({ quantity: 2, lotUnitCost: 10, allocatedValue: 20, financialValue: 30 }),
    issue({ id: 2, transactionId: 11, deliveryId: 21, lotCode: "LOT-2", quantity: 2, lotUnitCost: 20, allocatedValue: 40, financialValue: 30 })]);
  assert.equal(summarizeMaterialCosts(events).net, 60);
  assert.equal(groupMaterialCosts(events, "document")[0].net, 60);
});
test("repeated family/task references do not count a physical movement twice", () => {
  assert.equal(summarizeMaterialCosts(materialCostEvents([issue(), issue(), issue({ source: "ticket_team" })])).net, 45);
});
test("full return absorbs fractional-cent residue and nets zero", () => {
  const data = issue({ quantity: 3, lotUnitCost: "0.3333", allocatedValue: "1.00", financialValue: "1.00",
    returns: [1, 2, 3].map(id => ({ id, number: `R${id}`, quantity: 1, createdAt: `2026-10-${15 + id} 10:00:00`, financialValue: id === 3 ? ".34" : ".33" })) });
  const events = materialCostEvents([data]);
  assert.deepEqual(events.filter(event => event.eventType === "return").map(event => event.returned).sort(), [.33, .33, .34]);
  assert.equal(summarizeMaterialCosts(events).net, 0);
});
test("return-only reporting period credits the return, with no historic reissue or purchase", () => {
  const events = materialCostEvents([issue({ returns: [{ id: 1, number: "RTN", quantity: 1, financialValue: 12, createdAt: "2026-11-01 10:00:00" }] })], { from: "2026-11-01", to: "2026-11-30" });
  assert.equal(events.length, 1); assert.equal(summarizeMaterialCosts(events).net, -15);
});
test("returns before the selected period still participate in cent allocation", () => {
  const events = materialCostEvents([issue({ quantity: 3, lotUnitCost: ".3333", allocatedValue: "1.00", returns: [
    { id: 1, number: "R1", quantity: 2, financialValue: ".66", createdAt: "2026-10-16" },
    { id: 2, number: "R2", quantity: 1, financialValue: ".34", createdAt: "2026-11-01" },
  ] })], { from: "2026-11-01" });
  assert.equal(events[0].returned, .33);
});
test("unknown costs stay incomplete instead of silently substituting average or today's price", () => {
  const events = materialCostEvents([issue({ lotUnitCost: null, allocatedValue: null })]);
  assert.equal(events[0].incomplete, true); assert.equal(events[0].difference, null);
  assert.equal(summarizeMaterialCosts(events).incomplete, 1);
});
test("impossible over-return is flagged, never silently overcredits a ticket", () => {
  const events = materialCostEvents([issue({ returns: [{ id: 1, number: "R", quantity: 4, financialValue: 48, createdAt: "2026-10-16" }] })]);
  assert.equal(events[0].incomplete, true); assert.equal(summarizeMaterialCosts(events).returned, 0);
});
test("site/section/asset aggregation sums once and keeps unassigned assets separate", () => {
  const events = materialCostEvents([issue(), issue({ id: 2, transactionId: 11, deliveryId: 21, assetId: null, assetName: "" })]);
  assert.equal(groupMaterialCosts(events, "site")[0].net, 90);
  assert.equal(groupMaterialCosts(events, "section")[0].net, 90);
  assert.equal(groupMaterialCosts(events, "asset").length, 2);
});
test("named/team modes aggregate under the same ticket; PMV2 and independent remain distinct", () => {
  const events = materialCostEvents(["ticket_named", "ticket_team", "pmv2", "independent"].map((source, i) => issue({ source: source as any, transactionId: 100 + i, deliveryId: 200 + i })));
  assert.equal(groupMaterialCosts(events, "document").length, 3);
  assert.equal(groupMaterialCosts(events, "document").find(group => group.id === "ticket:4")?.net, 90);
  assert.equal(summarizeMaterialCosts(events).net, 180);
});
