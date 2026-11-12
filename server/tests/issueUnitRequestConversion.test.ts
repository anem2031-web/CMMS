import { MySqlDialect } from "drizzle-orm/mysql-core";
import type { SQL } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { materialStockUnitApproval } from "../../shared/maintenance-team-tickets/material-routing";
import {
  applyIssueUnitRequests,
  convertOpenIssueQuantity,
  planIssueUnitRequests,
} from "../services/inventory/issue-unit-request-conversion";

const input = { inventoryId: 11, catalogItemId: 4, warehouseId: 2, fromUnit: "كرتون", toUnit: "حبة", factor: 20 };
const dialect = new MySqlDialect();

function fixture({ archived = false, conflicting = false } = {}) {
  const writes: { statement: string; params: unknown[] }[] = [];
  const execute = async (query: SQL) => {
    const { sql: statement, params } = dialect.sqlToQuery(query);
    if (statement.startsWith("UPDATE")) {
      writes.push({ statement, params });
      return [{ affectedRows: 1 }];
    }
    if (statement.includes("FROM inventory i LEFT JOIN warehouses")) return [[
      { id: 11, warehouseId: 2, warehouseType: "main", unit: input.fromUnit, quantity: "3.000" },
      ...(conflicting ? [{ id: 12, warehouseId: 2, warehouseType: "main", unit: input.fromUnit, quantity: "1.000" }] : []),
    ]];
    if (statement.includes("FROM ticket_team_material_needs n JOIN")) return [[
      { id: 16, assignmentId: 5, warehouseId: 2, materialRound: 1, originalItemName: "صنف", reference: "MT-1", requestedQuantity: 3, usedQuantity: null },
    ]];
    if (statement.includes("FROM ticket_team_supply_links")) return [[
      { id: 90, needId: 16, sourceKind: "purchase", sourceId: 100, linkedQuantity: 2, status: "pending" },
    ]];
    if (statement.includes("FROM ticket_team_actions")) return [[
      { id: 30, assignmentId: 5, note: JSON.stringify({ type: "ticket_material_need", round: 1, originalName: "صنف", catalogItemId: 4, shortage: 2 }) },
    ]];
    if (statement.includes("FROM ticket_team_delivery_links")) return [[
      { id: 50, needId: 16, inventoryId: 11, issuedQuantity: 1, returnedQuantity: 0, unit: input.fromUnit },
    ]];
    if (statement.includes("FROM pmv2_item_actions") || statement.includes("FROM information_schema.COLUMNS")) return [[]];
    if (statement.includes("SELECT DISTINCT purchaseOrderItemId")) return [[{ purchaseOrderItemId: 100 }]];
    if (statement.includes("FROM purchase_order_items")) {
      expect(params).toEqual([11, 11, 100]);
      return [[{
        id: 100, reference: "PR-1", quantity: 3, unit: input.fromUnit, status: "delivered_to_warehouse",
        batchId: archived ? 4 : null, orderStatus: archived ? "received" : "partial_purchase",
        accountingApprovedAt: archived ? "2026-11-01" : null, managementApprovedAt: null,
        receivedQuantity: archived ? 3 : 1, receivedAt: "2026-11-01", deliveredQuantity: 0, returnedQuantity: 0,
        estimatedUnitCost: "20.00", actualUnitCost: "40.00", catalogItemId: 4, hasOtherInventoryReceipt: 0, hasSupplierReturn: 0, hasPricingBundle: 0,
      }]];
    }
    throw new Error(`Unexpected fixture query ${statement}`);
  };
  return { db: { execute }, writes };
}

describe("warehouse issue unit conversion of linked requests", () => {
  it("preserves the relationship between fulfilled and remaining quantities at exact supported precision", () => {
    expect(convertOpenIssueQuantity(3, 1, 20, true)).toEqual({ before: 2, after: 40, convertedTotal: 60, convertedFulfilled: 20 });
    expect(convertOpenIssueQuantity("0.300", "0.100", 0.5, false)).toEqual({ before: 0.2, after: 0.1, convertedTotal: 0.15, convertedFulfilled: 0.05 });
    expect(() => convertOpenIssueQuantity(3, 1, 0.5, true)).toThrow();
    expect(() => convertOpenIssueQuantity(1, 2, 20, true)).toThrow();
  });

  it("rebases partial linked ticket and purchase balances while keeping their source deliveries and finance totals", async () => {
    const { db, writes } = fixture();
    const plan = await planIssueUnitRequests(db, input);
    expect(plan.blockers).toEqual([]);
    expect(plan.affected).toMatchObject([
      { kind: "ticket", id: 16, beforeQuantity: 2, afterQuantity: 40 },
      { kind: "purchase", id: 100, beforeQuantity: 2, afterQuantity: 40 },
    ]);
    expect(writes).toEqual([]);
    await applyIssueUnitRequests(db, plan);
    const ticket = writes.find(write => write.statement.includes("UPDATE ticket_team_material_needs"));
    const purchase = writes.find(write => write.statement.includes("UPDATE purchase_order_items"));
    const action = writes.find(write => write.statement.includes("UPDATE ticket_team_actions"));
    expect(ticket?.params).toEqual([60, input.toUnit, 16]);
    expect(purchase?.params).toEqual([60, input.toUnit, 20, "1.00", "2.00", 100]);
    expect(purchase?.statement).not.toMatch(/TotalCost|status|batchId/);
    expect(writes.some(write => /UPDATE (ticket_team_delivery_links|inventory_transactions|warehouse_receipt_items)/.test(write.statement))).toBe(false);
    expect(materialStockUnitApproval(
      [{ assignmentId: 5, kind: "needs_material", note: String(action?.params[0]) }],
      { id: 16, assignmentId: 5, unit: input.toUnit },
    )).toMatchObject({ deliveryIds: [50], priorIssued: 1, factor: 20, fromUnit: input.fromUnit });
  });

  it("preserves the fully received and archived purchase, rebasing only operational ticket coverage", async () => {
    const { db, writes } = fixture({ archived: true });
    const plan = await planIssueUnitRequests(db, input, { lock: true });
    expect(plan.blockers).toEqual([]);
    await applyIssueUnitRequests(db, plan);
    expect(writes.some(write => write.statement.includes("UPDATE purchase_order_items"))).toBe(false);
    expect(writes.find(write => write.statement.includes("UPDATE ticket_team_supply_links"))?.params).toEqual([40, 90]);
  });

  it("prevents every write when a request may be fulfilled from another same-unit record", async () => {
    const { db, writes } = fixture({ conflicting: true });
    const plan = await planIssueUnitRequests(db, input);
    expect(plan.blockers[0]).toContain("MT-1");
    await expect(applyIssueUnitRequests(db, plan)).rejects.toThrow();
    expect(writes).toEqual([]);
  });

  it("binds a converted PMV2 shortage to its actual main stock for later purchase", async () => {
    const writes: unknown[][] = [];
    const db = { execute: async (query: SQL) => {
      const { sql: statement, params } = dialect.sqlToQuery(query);
      if (statement.startsWith("UPDATE")) { writes.push(params); return [{ affectedRows: 1 }]; }
      if (statement.includes("FROM inventory i LEFT JOIN warehouses")) return [[
        { id: 11, warehouseId: 2, warehouseType: "main", unit: input.fromUnit, quantity: "1.000" },
      ]];
      if (statement.includes("FROM pmv2_item_actions a JOIN")) return [[
        { id: 30, taskItemId: 21, reference: "PM-1", warehouseId: 5, note: JSON.stringify({
          version: 1, route: "material_request", catalogItemId: 4, teamWarehouseId: 5, materialRequestItemId: 44,
          requestedQuantity: 3, shortageQuantity: 3, availableQuantity: 0, unit: input.fromUnit,
        }) },
      ]];
      if (statement.includes("FROM pmv2_material_request_items")) return [[
        { id: 44, status: "waiting_warehouse", requestedQuantity: "3.000", receivedWarehouseQuantity: "0.000", issuedToTeamQuantity: "0.000" },
      ]];
      return [[]];
    } };
    const plan = await planIssueUnitRequests(db, input);
    expect(plan.blockers).toEqual([]);
    expect(plan.affected).toMatchObject([{ kind: "pmv2", id: 44, beforeQuantity: 3, afterQuantity: 60 }]);
    await applyIssueUnitRequests(db, plan);
    expect(JSON.parse(String(writes[0][0]))).toMatchObject({ materialRequestItemId: 44, unit: input.toUnit,
      approvedStockUnit: { inventoryId: 11, warehouseId: 2, unit: input.toUnit } });
    expect(writes[1]).toEqual([60, 0, input.toUnit, 44]);
  });
});
