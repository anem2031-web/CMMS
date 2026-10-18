import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { getTableName } from "drizzle-orm";
import { MySqlDialect } from "drizzle-orm/mysql-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getTicket: vi.fn(), names: vi.fn() }));
vi.mock("../_core/db", () => ({
  getDb: mocks.getDb, getTicketById: mocks.getTicket, getTicketItems: async () => [],
  isUserAssignedToTicketTasks: async () => false, getTicketHistory: async () => [{ changedById: 9 }],
  getInspectionResultsByTicket: async () => [{ inspectorId: 9 }],
}));
vi.mock("../_core/db/client", () => ({ getDb: mocks.getDb }));
vi.mock("../services/translation/translationEngine", () => ({ ensureStoredNameTranslations: mocks.names }));
import { readPmv2TicketReferences, readTicketExecutionReferences } from "../_core/authz/technician-resources";

const rows: Record<string, any[]> = {
  users: [{ id: 3, name: "الفني", role: "technician", isActive: 1, passwordHash: "NEVER RETURN", email: "private" }, { id: 9, name: "المبلغ", role: "operator", isActive: 1 }, { id: 99, name: "Unrelated", passwordHash: "NEVER RETURN" }],
  sites: [{ id: 4, name: "الموقع", nameEn: "East site", nameUr: "مشرقی مقام" }],
  sections: [{ id: 6, siteId: 4, name: "القسم", nameEn: "Electrical section", nameUr: "بجلی سیکشن", isActive: 1 }],
  technicians: [{ id: 10, name: "خارجي", nameEn: "External technician", nameUr: "بیرونی ٹیکنیشن" }],
  assets: [{ id: 12, name: "الأصل", sectionId: null, siteId: 4 }],
  center_categories: [{ id: 8, name: "التصنيف", isActive: 1 }],
};
let queries: Array<{ table: string; sql: string; params: unknown[] }>;
beforeEach(() => {
  vi.clearAllMocks(); queries = [];
  mocks.getTicket.mockImplementation(async (id: number) => ({ id, reportedById: 9, assignedToId: id === 11 ? 3 : 99, siteId: 4, sectionId: 6, assignedTechnicianId: 10, categoryId: 8, status: "in_progress" }));
  mocks.names.mockImplementation(async (entity: string, records: any[], language: string) => new Map(records.map(record => [record.id,
    language === "ar" ? record.name : record[language === "en" ? "nameEn" : "nameUr"] || `${entity}-${record.id}-${language}`,
  ])));
  mocks.getDb.mockResolvedValue({ select(fields: Record<string, unknown>) {
    const selection = { from(table: any) {
      const name = getTableName(table);
      const builder = { leftJoin: () => builder, where(condition: any) {
        const query = new MySqlDialect().sqlToQuery(condition);
        queries.push({ table: name, sql: query.sql, params: query.params });
        let selected = rows[name] || [];
        if (name === "users") selected = selected.filter(row => query.params.includes(row.id));
        return Promise.resolve(selected.map(row => Object.fromEntries(Object.keys(fields).map(key => [key, row[key]]))));
      } };
      return builder;
    } };
    return selection;
  } });
});
describe("Scoped display references retain task privacy and localization", () => {
  it("rejects another technician's ticket before reading directories", async () => {
    await expect(readTicketExecutionReferences({ id: 3, role: "technician" }, 12)).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it.each(["ar", "en", "ur"])("returns only related display users and keeps %s labels", async language => {
    const result = await readTicketExecutionReferences({ id: 3, role: "technician", preferredLanguage: language }, 11);
    expect(result.users.map(row => row.id)).toEqual([3, 9]);
    expect(JSON.stringify(result)).not.toContain("NEVER RETURN");
    expect(result.users[0]).not.toHaveProperty("email");
    expect(result.sites[0].name).toBe(language === "en" ? "East site" : language === "ur" ? "مشرقی مقام" : "الموقع");
    expect(result.technicians[0].name).toBe(language === "en" ? "External technician" : language === "ur" ? "بیرونی ٹیکنیشن" : "خارجي");
    expect(queries.find(query => query.table === "sites")?.params).toEqual([4]);
    expect(queries.find(query => query.table === "sections")?.params).toEqual([6]);
  });
  it.each(["en", "ur"])("keeps PMV2 fixed-asset targets without a section and %s references", async language => {
    const result = await readPmv2TicketReferences({ siteId: 4, sectionId: null, assetId: 12 }, language as "en" | "ur");
    expect(result.assets[0]).toMatchObject({ id: 12, sectionId: null, name: `ASSET-12-${language}` });
    expect(result.sites[0].name).toBe(language === "en" ? "East site" : "مشرقی مقام");
    expect(queries.find(query => query.table === "assets")?.params).toEqual([12]);
    const sectionQuery = queries.find(query => query.table === "sections")!;
    expect(sectionQuery.sql).toContain("siteId");
    expect(sectionQuery.params).toEqual([4, 1]);
  });
});

describe("Embedded technician forms avoid broad directory requests", () => {
  it.each(["TicketDetail", "CreateTicket"])("disables global lookups in %s only for the technician", page => {
    const file = `client/src/pages/tickets/${page}.tsx`;
    const ast = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const options: string[] = [];
    function walk(node: ts.Node) {
      if (ts.isCallExpression(node) && /^trpc\.(users|technicians|sites|sections|assets|purchaseOrders|centerCategories)\..*\.useQuery$/.test(node.expression.getText(ast))) {
        expect(node.arguments[1]).toBeDefined(); options.push(node.arguments[1].getText(ast));
      }
      ts.forEachChild(node, walk);
    }
    walk(ast); expect(options.length).toBeGreaterThanOrEqual(4);
    for (const option of options) {
      const js = ts.transpileModule(`(${option})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
      expect(vm.runInNewContext(js, { restrictedTechnician: true, user: { role: "technician" }, form: { siteId: "4" } }).enabled).toBe(false);
      expect(vm.runInNewContext(js, { restrictedTechnician: false, user: { role: "admin" }, form: { siteId: "4" } }).enabled).toBe(true);
    }
  });
});
