import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { requiresBranchTransferConfirmation } from "../../shared/branch-transfer-confirmation";
const source = fs.readFileSync("client/src/pages/inventory/WarehouseTransfer.tsx", "utf8");
const ast = ts.createSourceFile("WarehouseTransfer.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler: ts.FunctionDeclaration | undefined;
function find(node: ts.Node) { if (ts.isFunctionDeclaration(node) && node.name?.text === "handleSubmitAll") handler = node; ts.forEachChild(node, find); }
find(ast); if (!handler) throw Error("Transfer handler not found");
const code = ts.transpileModule(`(${handler.getText(ast)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
function fixture(branch = true) {
  const cart = [{ inventoryId: 1, itemName: "A", quantity: 2, lotTrackingToken: "lot-a" }, { inventoryId: 2, itemName: "B", quantity: 1, lotTrackingToken: "lot-b" }];
  const mutateAsync = vi.fn(async () => ({ batchNumber: "TR-1", results: [{ success: true, transferNumber: "TR-A" }, { success: false, message: "insufficient stock" }] }));
  const context = { transferBusy: { current: false }, materialHandoff: null, materialTransferPosted: false,
    fromWarehouseId: "1", toWarehouseId: "2", cart, operationNotes: "test", lotsEnabled: true,
    sourceWarehouse: { id: 1, type: branch ? "branch" : "main" }, targetWarehouse: { id: 2, type: "branch" },
    transferFingerprint: "current-input", requiresBranchTransferConfirmation, createBatchMut: { mutateAsync },
    setBranchConfirmation: vi.fn(), setIsSubmitting: vi.fn(), setLastResult: vi.fn(), setCart: vi.fn(), setOperationNotes: vi.fn(), refetchCards: vi.fn(),
    toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() },
  };
  const run = vm.runInNewContext(code, context) as (fingerprint?: string) => Promise<void>;
  return { context, run, mutateAsync };
}
describe("Actual transfer handler confirmation and existing partial-result semantics", () => {
  it("does not post any transfer until branch-to-branch confirmation", async () => {
    const f = fixture(); await f.run(); expect(f.context.setBranchConfirmation).toHaveBeenCalledWith("current-input"); expect(f.mutateAsync).not.toHaveBeenCalled();
    expect(f.context.setIsSubmitting).not.toHaveBeenCalled();
  });
  it("requires fresh confirmation after the form changes", async () => {
    const f = fixture(); await f.run("old-input"); expect(f.mutateAsync).not.toHaveBeenCalled(); expect(f.context.setBranchConfirmation).toHaveBeenCalledWith("current-input");
  });
  it("posts the existing batch once after confirmation and retains failed items only", async () => {
    const f = fixture(); await Promise.all([f.run("current-input"), f.run("current-input")]);
    expect(f.mutateAsync).toHaveBeenCalledTimes(1); expect(f.mutateAsync.mock.calls[0][0]).toMatchObject({ fromWarehouseId: 1, toWarehouseId: 2, items: [{ fromInventoryId: 1, quantity: 2, lotTrackingToken: "lot-a" }, { fromInventoryId: 2, quantity: 1, lotTrackingToken: "lot-b" }] });
    const update = f.context.setCart.mock.calls[0][0] as (items: any[]) => any[];
    expect(update(f.context.cart)).toEqual([f.context.cart[1]]); expect(f.context.transferBusy.current).toBe(false);
  });
  it("keeps other transfer directions on their existing path", async () => {
    const f = fixture(false); await f.run(); expect(f.mutateAsync).toHaveBeenCalledTimes(1); expect(f.context.setBranchConfirmation).not.toHaveBeenCalledWith("current-input");
  });
});
