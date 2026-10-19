import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  envDir: false,
  plugins: [{ name: "forbid-live-approval-database", enforce: "pre", load(id) {
    if (/server\/_core\/(db\/client|config|env)\.[cm]?ts$/.test(id.replaceAll("\\", "/"))) throw new Error("Live database/environment is forbidden in PDF approval tests");
  } }],
  resolve: { alias: { "@": fileURLToPath(new URL("../../client/src", import.meta.url)), "@shared": fileURLToPath(new URL("../../shared", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: { include: ["server/tests/purchasePdfApproval.test.ts", "server/tests/delegatePricingBundles.test.ts", "server/tests/businessResourceBoundary.test.ts", "server/tests/businessMediaAccess.test.ts"], environment: "node", minWorkers: 1, maxWorkers: 1 },
});
