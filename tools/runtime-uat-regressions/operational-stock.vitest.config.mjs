import { defineConfig } from "vitest/config";
import base from "../maintenance-team-tickets/execution-vitest.config.mjs";
export default defineConfig({ ...base, test: { ...base.test, include: [
  "server/tests/operationalIssues.test.ts", "server/tests/operationalIssuesUi.test.tsx",
  "server/tests/operationalStockProcurement.test.ts", "server/tests/operationalStockUi.test.tsx",
  "server/tests/branchTransferConfirmation.test.ts",
  "server/tests/purchaseItemNeedDate.test.ts",
] } });
