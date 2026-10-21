import { defineConfig } from "vitest/config";
import previous from "../documents-center-perf/vitest.config.mjs";
export default defineConfig({ ...previous, plugins: [{ name: "forbid-live-db", enforce: "pre", load(id) {
  if (/server\/_core\/(db\/client|config|env)\.[cm]?ts$/.test(id.replaceAll("\\", "/"))) throw Error(`Live database/environment forbidden: ${id}`);
} }], test: { ...previous.test, include: [
  "server/tests/purchaseGroupedReceipt.test.ts",
  "server/tests/purchaseExecutionRefresh.test.ts",
  "server/tests/purchaseReceiptMembershipReads.test.ts",
  "server/tests/interactiveReadTransport.test.ts",
  "server/tests/receiptInventoryIdentityGovernance.test.ts",
] } });
