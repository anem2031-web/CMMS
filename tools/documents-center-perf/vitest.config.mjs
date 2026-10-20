import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  envDir: false,
  plugins: [{ name: "forbid-live-database", enforce: "pre", load(id) {
    if (/server\/_core\/(db\/client|config|env)\.[cm]?ts$/.test(id.replaceAll("\\", "/"))) throw Error("Live database/environment forbidden in document-center tests");
  } }],
  resolve: { alias: { "@": fileURLToPath(new URL("../../client/src", import.meta.url)), "@shared": fileURLToPath(new URL("../../shared", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: { include: ["server/tests/documentsCenterPerformance.test.ts", "server/tests/documentsCenterSql.test.ts", "server/tests/purchasePackageFinancialDocumentsPhase2.test.ts", "server/tests/purchaseDelegatePricingDocumentsListPhase2.test.ts", "server/tests/approvalDocumentsUi.test.tsx", "server/tests/purchasePdfApproval.test.ts", "server/tests/delegatePricingBundles.test.ts", "server/tests/delegatePricingBundlesUi.test.tsx", "server/tests/businessRolesGuard.test.ts", "server/tests/businessResourceBoundary.test.ts", "server/tests/businessMediaAccess.test.ts"], environment: "node", minWorkers: 1, maxWorkers: 1 },
});
