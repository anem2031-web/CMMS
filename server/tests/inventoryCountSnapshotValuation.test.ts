import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Main Phase 3 / Step 2 — inventory count snapshot valuation", () => {
  it("derives financial valuation from the opening averageCostSnapshot and never falls back to current cost", () => {
    const source = read("server/_core/db/invoice-drafts.ts");
    const helperStart = source.indexOf("async function attachCountOpeningValuation");
    const detailsStart = source.indexOf("export async function getCountOperationDetails", helperStart);
    const helperBlock = source.slice(helperStart, detailsStart);

    expect(helperBlock).toContain("snapshot.averageCostSnapshot");
    expect(helperBlock).toContain("systemValueSnapshot");
    expect(helperBlock).toContain("countedValueAtSnapshotCost");
    expect(helperBlock).toContain("diffValue");
    expect(helperBlock).toContain("hasOpeningCostSnapshot");
    expect(helperBlock).not.toContain("row.averageCost ||");
  });

  it("returns snapshot valuation fields with count details and discrepancies", () => {
    const source = read("server/_core/db/invoice-drafts.ts");
    const detailsStart = source.indexOf("export async function getCountOperationDetails");
    const listStart = source.indexOf("export async function listCountOperations", detailsStart);
    const detailsBlock = source.slice(detailsStart, listStart);
    const discrepanciesStart = source.indexOf("export async function getCountDiscrepancies");
    const settlementStart = source.indexOf("export async function applySettlement", discrepanciesStart);
    const discrepanciesBlock = source.slice(discrepanciesStart, settlementStart);

    expect(detailsBlock).toContain("attachCountOpeningValuation");
    expect(discrepanciesBlock).toContain("getCountOperationDetails(operationId)");
    expect(discrepanciesBlock).toContain("Number(item.diffQuantity || 0) !== 0");
  });

  it("renders financial count results from diffValue and displays the opening cost snapshot", () => {
    const ui = read("client/src/pages/inventory/InventoryOperations.tsx");
    const reportStart = ui.indexOf("تقرير الفروقات المالي — بقيمة Snapshot وقت فتح الجرد");
    const reportEnd = ui.indexOf("{/* ══ نافذة", reportStart);
    const reportBlock = ui.slice(reportStart, reportEnd > reportStart ? reportEnd : reportStart + 25000);

    expect(reportBlock).toContain("it.diffValue");
    expect(reportBlock).toContain("it.averageCostSnapshot");
    expect(reportBlock).toContain("متوسط التكلفة وقت الفتح");
    expect(reportBlock).not.toContain('diff * parseFloat(it.averageCost || "0")');
  });

  it("prints count valuation using averageCostSnapshot and diffValue", () => {
    const printSource = read("client/src/lib/printInventoryOperationDocuments.ts");
    const countStart = printSource.indexOf("export function buildCountHtml");
    const settlementStart = printSource.indexOf("export function buildSettlementHtml", countStart);
    const countBlock = printSource.slice(countStart, settlementStart);

    expect(countBlock).toContain("it.averageCostSnapshot");
    expect(countBlock).toContain("it.diffValue");
    expect(countBlock).toContain("التقييم المالي للفروقات — تكلفة Snapshot وقت فتح الجرد");
  });

  it("keeps counting and count completion non-posting; Inventory changes remain outside Step 2", () => {
    const source = read("server/_core/db/invoice-drafts.ts");
    const recordStart = source.indexOf("export async function recordCountItem");
    const completeStart = source.indexOf("export async function completeCountOperation", recordStart);
    const deleteStart = source.indexOf("export async function deleteCountOperation", completeStart);
    const recordBlock = source.slice(recordStart, completeStart);
    const completeBlock = source.slice(completeStart, deleteStart);

    expect(recordBlock).toContain("diffQuantity");
    expect(recordBlock).not.toContain("update(inventory)");
    expect(completeBlock).not.toContain("update(inventory)");
    expect(completeBlock).not.toContain("insert(inventoryTransactions)");
  });
});
