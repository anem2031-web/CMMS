import { describe, it, expect, vi } from "vitest";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { listDelegateCompleted } from "../services/delegate-completed";
import { delegateCompletedInput } from "../../shared/delegate-completed";
import { isDelegateSupplyItemOpen } from "../../shared/delegateSupplyStage";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { router } from "../_core/trpc";
import { delegateProcedure } from "../routers/_shared/procedures";
vi.mock("../_core/db", () => ({}));

const actor = { id: 11, role: "delegate", isActive: 1 };
const own = { id: 1, purchaseOrderId: 7, parentId: 7, parentStatus: "closed", requestedById: 22, delegateId: 11, poNumber: "PR7", itemName: "Item", quantity: 2, unit: "piece", receivedAt: "2026-10-27" };
function fixture() {
  const queries: any[] = []; let data = [own]; let active = true;
  const dialect = new MySqlDialect();
  const database = { execute: vi.fn(async (q: any) => {
    const query = dialect.sqlToQuery(q); queries.push(query);
    if (query.sql.startsWith("SELECT id,role,isActive")) return [[{ ...actor, isActive: active ? 1 : 0 }]];
    if (query.sql.startsWith("SELECT COUNT")) return [[{ total: data.length }]];
    return [data];
  }) };
  return { database, queries, rows: (rows: any[]) => { data = rows; }, deactivate: () => { active = false; } };
}
const input = { page: 1, pageSize: 20, search: "" };
describe("delegate completed archive", () => {
  it("returns only the intended read fields and keeps open tracking unchanged", async () => {
    const f = fixture(); const result = await listDelegateCompleted(actor, input, f.database);
    expect(result.items).toEqual([{ id: 1, purchaseOrderId: 7, poNumber: "PR7", itemName: "Item", quantity: 2, unit: "piece", receivedAt: "2026-10-27" }]);
    expect(isDelegateSupplyItemOpen({ status: "purchased" })).toBe(true);
    expect(isDelegateSupplyItemOpen({ status: "delivered_to_warehouse" })).toBe(false);
    expect(f.queries).toHaveLength(3);
  });
  it.each(["warehouse", "accountant", "senior_management", "technician", "it_member", "admin", "owner"])("denies %s without querying records", async role => {
    const f = fixture(); await expect(listDelegateCompleted({ ...actor, role }, input, f.database)).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(f.queries).toHaveLength(0);
  });
  it("checks identity anew for consecutive requests", async () => {
    const f = fixture(); await listDelegateCompleted(actor, input, f.database); f.deactivate();
    await expect(listDelegateCompleted(actor, input, f.database)).rejects.toMatchObject({ code: "FORBIDDEN" }); expect(f.queries).toHaveLength(4);
  });
  it.each([{ ...own, delegateId: 22 }, { ...own, parentId: null }, { ...own, parentId: 99 }])("rejects foreign/missing parent scope independently", async row => {
    const f = fixture(); f.rows([own, row]); await expect(listDelegateCompleted(actor, input, f.database)).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("bounds pages before enrichment and escapes search wildcards in both queries", async () => {
    const f = fixture(); await listDelegateCompleted(actor, { page: 3, pageSize: 50, search: "bolt%_=" }, f.database);
    for (const q of f.queries.slice(1)) {
      expect(q.sql).toContain("INNER JOIN purchase_orders p ON p.id=i.purchaseOrderId");
      expect(q.sql).toContain("i.delegateId=?"); expect(q.params).toContain(11);
      expect(q.params).toContain("%bolt=%=_==%");
      expect(q.sql).toContain("'delivered_to_warehouse','delivered_to_requester'");
      expect(q.sql).toContain("e.warehouseReceivedAt IS NOT NULL");
    }
    expect(f.queries[2].sql).toContain("LIMIT ? OFFSET ?"); expect(f.queries[2].params.slice(-2)).toEqual([50,100]);
    expect(() => delegateCompletedInput.parse({ ...input, pageSize: 501 })).toThrow();
    expect(() => delegateCompletedInput.parse({ ...input, delegateId: 22 })).toThrow();
  });
  it("keeps a constant query count for repeated parents and consecutive large pages", async () => {
    const f = fixture(); f.rows(Array.from({ length: 50 }, (_, id) => ({ ...own, id })));
    for (let page = 1; page <= 20; page++) expect((await listDelegateCompleted(actor, { ...input, page, pageSize: 50 }, f.database)).items).toHaveLength(50);
    expect(f.queries).toHaveLength(60);
  });
  it("propagates infrastructure errors", async () => {
    await expect(listDelegateCompleted(actor, input, { execute: async () => { throw new Error("offline"); } })).rejects.toThrow("offline");
  });
  it("uses the real RPC middleware and strict input without granting other roles", async () => {
    const f = fixture();
    const file = "server/routers/purchase/purchase-orders.router.ts", source = ts.createSourceFile(file, readFileSync(file,"utf8"), ts.ScriptTarget.Latest,true);
    let code = ""; function walk(n: ts.Node) { if (ts.isPropertyAssignment(n) && n.name.getText(source) === "completedItems") code = n.initializer.getText(source); ts.forEachChild(n,walk); } walk(source);
    const endpoint = vm.runInNewContext(ts.transpileModule(`(${code})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, { delegateProcedure, delegateCompletedInput, listDelegateCompleted: (a: any,i: any) => listDelegateCompleted(a,i,f.database) });
    const api = router({ purchaseOrders: router({ completedItems: endpoint }) });
    const call = (role: string) => api.createCaller({ user: { ...actor, role } } as any).purchaseOrders.completedItems;
    expect((await call("delegate")(input) as any).items).toHaveLength(1);
    for (const role of ["warehouse","accountant","senior_management","technician","admin","owner"]) await expect(call(role)(input)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(call("delegate")({ ...input, delegateId: 22 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
