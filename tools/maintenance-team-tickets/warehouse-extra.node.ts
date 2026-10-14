import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { transformSync } from "esbuild";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { createDemo } from "../../server/maintenance-team-tickets/testing/fixture";
import { MaintenanceTeamTicketService } from "../../server/maintenance-team-tickets/service";
import type {
  MaterialGateway,
  SupplyResult,
} from "../../server/maintenance-team-tickets/ports";
import {
  ticketPurchaseQuantities,
  ticketPurchaseBreakdown,
  MAX_TICKET_PURCHASE_QUANTITY,
} from "../../shared/maintenance-team-tickets/purchase-quantities";
import { issued } from "../../shared/maintenance-team-tickets/model";
import { aggregateImprovementCosts } from "../../shared/improvement-execution";
import { improvementExecutionSummary } from "../../server/services/improvement-ideas/execution";

async function setup() {
  const d = createDemo();
  const a = await d.service.assign(1, {
    ...(await d.store.read()).tickets[0],
    teamId: 21,
  });
  let sequence = 0,
    calls = 0,
    fail = false,
    mismatch = false;
  const handoffs: any[] = [],
    verified = new Map<number, SupplyResult>();
  const service = new MaintenanceTeamTicketService({
    read: () => d.store.read(),
    transaction: work =>
      d.store.transaction(async (s, effects) => {
        const gateway: MaterialGateway = {
          ...effects,
          purchaseForm: async h => {
            handoffs.push(h);
            calls++;
            const source = await effects.purchase({
              operationKey: `purchase:${++sequence}`,
              destinationWarehouseId: 10,
              catalogItemId: h.catalogItemId,
              quantity: h.purchaseTotalQuantity,
              unit: h.unit,
              location: h.location,
            });
            verified.set(source.sourceId, source);
            if (fail) throw new Error("PO creation failed");
            return {
              id: source.sourceId + 1,
              poNumber: source.sourceNumber,
              source,
            };
          },
          verifySupply: async (_need, _kind, id) => ({
            ...verified.get(id)!,
            ...(mismatch ? { quantity: 999 } : {}),
          }),
          // Mirrors production: receipt reads the full PO, but confirms its canonical linked share.
          receivePurchase: async input => {
            const receipt = await effects.receivePurchase(input);
            return {
              ...receipt,
              quantity: s.supplies.find(x => x.sourceId === input.sourceId)!
                .quantity,
            };
          },
        };
        return work(s, gateway);
      }),
  });
  const command = async (key = `extra:${++sequence}`) => ({
    assignmentId: a.id,
    expectedRevision: (await d.store.read()).assignments[0].revision,
    operationKey: key,
  });
  await service.registerMaterialNeed(3, await command(), {
    catalogItemId: 103,
    quantity: 5,
    unit: "قطعة",
  });
  const needId = (await d.store.read()).needs[0].id;
  return {
    ...d,
    service,
    a,
    needId,
    command,
    handoffs,
    calls: () => calls,
    fail: () => {
      fail = true;
    },
    mismatch: () => {
      mismatch = true;
    },
  };
}
const form = (extra: unknown = 3) => ({
  ticketTeam: { warehouseExtraQuantity: extra },
  items: [{ quantity: 8 }],
});

test("5 technician + 3 warehouse = 8 ordered, while linked ticket coverage stays 5", async () => {
  const d = await setup();
  await d.service.purchaseFromForm(2, await d.command(), d.needId, form());
  const s = await d.store.read(),
    physical = await d.store.inspectPhysical();
  assert.equal(d.handoffs[0].technicianQuantity, 5);
  assert.equal(d.handoffs[0].purchaseTotalQuantity, 8);
  assert.equal(physical.supplies[0].quantity, 8);
  assert.equal(s.supplies[0].quantity, 5);
  assert.equal(s.needs[0].requested, 5);
  assert.match(s.actions.at(-1)!.note, /إضافة المستودع للتخزين: 3 قطعة/);
  assert.match(s.actions.at(-1)!.note, /إجمالي طلب الشراء: 8 قطعة/);
});
test("receipt, transfer, issue and repair never issue the warehouse extra to the ticket", async () => {
  const d = await setup();
  await d.service.purchaseFromForm(2, await d.command(), d.needId, form());
  let s = await d.store.read();
  await d.service.receivePurchase(2, await d.command(), s.supplies[0].id);
  await d.service.provideMaterial(2, await d.command(), d.needId, "transfer");
  await d.service.receiveMaterial(3, await d.command(), d.needId);
  s = await d.store.read();
  assert.equal(issued(s, d.needId), 5);
  const physical = await d.store.inspectPhysical();
  assert.equal(
    physical.lots
      .filter(x => x.catalogItemId === 103 && x.warehouseId === 10)
      .reduce((sum, x) => sum + x.quantity, 0),
    3
  );
  await d.service.submitOutcome(3, await d.command(), "fixed", {
    note: "تم الإصلاح",
    usages: [{ catalogItemId: 103, used: 5 }],
  });
  assert.equal((await d.store.read()).assignments[0].stage, "awaiting_review");
});
test("purchase replay is idempotent and changing the extra cannot reuse the same operation", async () => {
  const d = await setup(),
    c = await d.command();
  const first = await d.service.purchaseFromForm(2, c, d.needId, form());
  assert.deepEqual(
    await d.service.purchaseFromForm(2, c, d.needId, form()),
    first
  );
  assert.equal(d.calls(), 1);
  await assert.rejects(
    d.service.purchaseFromForm(2, c, d.needId, form(4)),
    /مرجع العملية/
  );
});
test("zero or omitted extra preserves shortage-only purchase", async () => {
  for (const payload of [form(0), {}]) {
    const d = await setup();
    await d.service.purchaseFromForm(2, await d.command(), d.needId, payload);
    assert.equal(d.handoffs[0].purchaseTotalQuantity, 5);
    assert.equal((await d.store.read()).supplies[0].quantity, 5);
  }
});
test("negative, fractional, string, infinite or oversized extras fail before any purchase", async () => {
  for (const extra of [
    -1,
    0.5,
    "3",
    Infinity,
    NaN,
    MAX_TICKET_PURCHASE_QUANTITY,
  ]) {
    const d = await setup(),
      before = await d.store.read();
    await assert.rejects(
      d.service.purchaseFromForm(2, await d.command(), d.needId, form(extra)),
      /كمية إضافة/
    );
    assert.equal(d.calls(), 0);
    assert.deepEqual(await d.store.read(), before);
  }
});
test("technician cannot request warehouse extra through the purchase service", async () => {
  const d = await setup();
  await assert.rejects(
    d.service.purchaseFromForm(3, await d.command(), d.needId, form()),
    /للمستودع/
  );
  assert.equal(d.calls(), 0);
});
test("failed PO creation or mismatched canonical total rolls back source, coverage and stock", async () => {
  for (const failure of ["create", "verify"]) {
    const d = await setup(),
      before = await d.store.read(),
      physical = await d.store.inspectPhysical();
    failure === "create" ? d.fail() : d.mismatch();
    await assert.rejects(
      d.service.purchaseFromForm(2, await d.command(), d.needId, form())
    );
    assert.deepEqual(await d.store.read(), before);
    assert.deepEqual(await d.store.inspectPhysical(), physical);
  }
});
test("existing available stock reduces ticket purchase only, never the warehouse extra", () => {
  const q = ticketPurchaseQuantities(5, 2, 3);
  assert.equal(q.purchaseTotalQuantity, 5);
  assert.match(
    ticketPurchaseBreakdown(q, "حبة"),
    /كمية الفني المطلوبة: 5 حبة؛ كمية الشراء للتذكرة: 2 حبة/
  );
});

const ticket = {
  id: 1,
  ticketNumber: "MT-1",
  status: "closed",
  actualCost: null,
};
const order = { id: 2, poNumber: "PR-2", ticketId: 1, status: "received" };
const item = {
  id: 3,
  purchaseOrderId: 2,
  itemName: "Material",
  status: "delivered_to_warehouse",
  actualTotalCost: "80.00",
  purchasedAt: "now",
  quantity: 8,
  ticketLinkedQuantity: 5,
};
test("actual ticket/improvement cost includes 5/8 of the PO, and does not double count its issue", () => {
  const result = aggregateImprovementCosts(
    [ticket],
    [order],
    [item],
    [
      {
        id: 4,
        ticketId: 1,
        purchaseOrderItemId: 3,
        type: "out",
        transactionType: "delivery",
        totalCost: "50.00",
      },
    ]
  );
  assert.equal(result.total, 50);
  assert.equal(result.lines.length, 1);
  assert.equal(result.complete, true);
  assert.equal(item.actualTotalCost, "80.00");
});
test("legacy and standalone purchasing costs stay full; bad linked shares cannot close an improvement", () => {
  assert.equal(
    aggregateImprovementCosts(
      [ticket],
      [order],
      [{ ...item, ticketLinkedQuantity: null }],
      []
    ).total,
    80
  );
  assert.equal(
    aggregateImprovementCosts([], [{ ...order, ticketId: null }], [item], [])
      .total,
    80
  );
  for (const ticketLinkedQuantity of [0, 9, 0.5, NaN]) {
    const result = aggregateImprovementCosts(
      [ticket],
      [order],
      [{ ...item, ticketLinkedQuantity }],
      []
    );
    assert.equal(result.complete, false);
    assert.equal(result.total, 0);
  }
  const rounded = aggregateImprovementCosts(
    [ticket],
    [order],
    [
      {
        ...item,
        quantity: 3,
        ticketLinkedQuantity: 1,
        actualTotalCost: "0.02",
      },
    ],
    []
  );
  assert.equal(rounded.total, 0.01);
});
test("warehouse extra is charged only if later issued to project tickets; returns and duplicates are reconciled", () => {
  const issue = {
    id: 4,
    ticketId: 1,
    purchaseOrderItemId: 3,
    type: "out",
    transactionType: "delivery",
    totalCost: "80.00",
  };
  const returned = {
    ...issue,
    id: 5,
    type: "in",
    transactionType: "return",
    totalCost: "10.00",
  };
  assert.equal(
    aggregateImprovementCosts(
      [ticket],
      [order],
      [item],
      [issue, issue, returned]
    ).total,
    70
  );
  const child = { ...ticket, id: 11, ticketNumber: "MT-child" };
  assert.equal(
    aggregateImprovementCosts(
      [ticket, child],
      [order],
      [item],
      [{ ...issue, ticketId: 11, totalCost: "30.00" }]
    ).total,
    80
  );
  const missing = aggregateImprovementCosts(
    [ticket],
    [order],
    [item],
    [{ ...issue, totalCost: null }]
  );
  assert.equal(missing.complete, false);
});
test("improvement reader uses persisted supply shares scoped to the PO ticket; no live query runs", async () => {
  const dialect = new MySqlDialect(),
    queries: string[] = [];
  const responses = [[ticket], [], [order], [item], []];
  const tx = {
    execute: async (q: any) => {
      queries.push(dialect.sqlToQuery(q).sql);
      return [responses.shift(), []];
    },
  };
  const summary = await improvementExecutionSummary(tx, {
    linkedTicketId: 1,
    estimatedMaterialsCost: "80",
    estimatedLaborCost: "0",
    estimatedServicesCost: "0",
  });
  assert.equal(summary.total, 50);
  const query = queries.find(q => q.includes("FROM purchase_order_items i"))!;
  assert.match(query, /SUM\(s.linkedQuantity\)/);
  assert.match(query, /q.ticketId=p.ticketId/);
  assert.match(query, /s.sourceKind='purchase'/);
});
test("canonical purchase writer stores the computed total and trusted breakdown together", async () => {
  const file = "server/routers/purchase/purchase-orders.router.ts",
    ast = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true
    );
  let callback: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(ast) === "createTicketMaterialPurchase"
    )
      callback = node.arguments[3];
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const js = transformSync(`const create = ${callback!.getText(ast)}`, {
    loader: "ts",
  }).code;
  let header: any, lines: any;
  const tx = {},
    input = {
      ticketId: 1,
      ticketItemId: 11,
      notes: "طلب المستودع",
      items: [{ catalogItemId: 103, quantity: 8, notes: "تفصيل" }],
    };
  const db = {
    createPurchaseOrder: async (data: any, current: any) => {
      assert.equal(current, tx);
      header = data;
      return 2;
    },
    createPOItems: async (data: any, current: any) => {
      assert.equal(current, tx);
      lines = data;
    },
    getPOItems: async () => [{ id: 3, quantity: 8 }],
  };
  const scope = {
    db,
    tx,
    input,
    poNumber: "PR-2",
    ctx: { user: { id: 2 } },
    purchaseContext: {},
    TeamTicketError: Error,
    ticketPurchaseBreakdown,
  };
  const create = new Function(...Object.keys(scope), `${js};return create`)(
    ...Object.values(scope)
  );
  await create({ ...ticketPurchaseQuantities(5, 5, 3), unit: "حبة" });
  assert.equal(lines[0].quantity, 8);
  assert.match(header.notes, /كمية الفني المطلوبة: 5 حبة/);
  assert.match(lines[0].notes, /إضافة المستودع للتخزين: 3 حبة/);
  assert.equal(input.items[0].notes, "تفصيل");
});
test("actual purchase form payload submits the calculated total; ordinary and PMV2 quantities stay unchanged", () => {
  const file = "client/src/pages/purchase/CreatePurchaseOrder.tsx",
    ast = ts.createSourceFile(
      file,
      fs.readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
  const declarations = new Map<string, string>();
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ["purchaseItemsForSubmit", "buildItemsPayload"].includes(
        node.name.getText(ast)
      )
    )
      declarations.set(node.name.getText(ast), node.initializer.getText(ast));
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const js = transformSync(
    Array.from(declarations)
      .map(([name, value]) => `const ${name} = ${value};`)
      .join("\n"),
    { loader: "ts" }
  ).code;
  for (const source of ["ordinary", "pmv2", "tickets"]) {
    const scope = {
      items: [
        {
          catalogItemId: 103,
          itemName: "Material",
          unit: "حبة",
          quantity: source === "ordinary" ? 9 : 5,
          requiredDate: "2026-10-12",
        },
      ],
      hasMaterialPurchaseContext: source !== "ordinary",
      materialCatalogItemId: 103,
      materialPurchaseTotalUnits: source === "tickets" ? 8 : 5,
    };
    const build = new Function(
      ...Object.keys(scope),
      `${js};return buildItemsPayload`
    )(...Object.values(scope));
    assert.equal(
      build()[0].quantity,
      source === "tickets" ? 8 : source === "pmv2" ? 5 : 9
    );
  }
});
